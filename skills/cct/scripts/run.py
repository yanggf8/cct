#!/usr/bin/env python3
"""CCT skill: fetch 4-moment trading intelligence and deliver to Telegram."""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import date, datetime, timezone
from typing import NamedTuple


def _resolve_skills_lib() -> str:
    """Locate the shared nullclaw skills lib (delivery / trace_marker / telegram).

    This repo deliberately does NOT vendor those modules — they carry the
    delivery retry/deadline contract and are maintained in claw-skills.

    Resolution order:
      1. $CLAW_SKILLS_LIB — explicit override.
      2. ../../lib relative to this file — the deployed layout
         (~/.nullclaw/skills/cct/scripts/run.py → ~/.nullclaw/skills/lib,
         itself a symlink into claw-skills). Never realpath() this: the
         unresolved symlink path is exactly what makes it work.
      3. ~/a/claw-skills/lib — running straight out of this repo, where
         there is no sibling skills/lib.
    """
    candidates = []
    override = os.environ.get("CLAW_SKILLS_LIB")
    if override:
        candidates.append(override)
    candidates.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
    candidates.append("~/a/claw-skills/lib")
    for candidate in candidates:
        path = os.path.abspath(os.path.expanduser(candidate))
        if os.path.isdir(path):
            return path
    # Nothing found — return the last candidate so the import fails loudly
    # with a path in the traceback rather than a bare ModuleNotFoundError.
    return os.path.abspath(os.path.expanduser(candidates[-1]))


SKILLS_LIB = _resolve_skills_lib()
sys.path.insert(0, SKILLS_LIB)
from delivery import deliver_or_fail
from trace_marker import emit_skill_status, emit_trace

CCT_BASE = "https://tft-trading-system.yanggf.workers.dev"
CONFIG_PATH = os.environ.get("CLAW_CONFIG") or os.path.expanduser("~/.nullclaw/config.json")

SENTIMENT_EMOJI = {"bullish": "看漲 🟢", "bearish": "看跌 🔴", "neutral": "中性 ⚪"}


def load_api_key() -> str:
    try:
        with open(CONFIG_PATH) as f:
            return json.load(f).get("cct", {}).get("api_key", "yanggf")
    except Exception:
        return "yanggf"


def get(path: str) -> dict | None:
    url = f"{CCT_BASE}{path}"
    req = urllib.request.Request(
        url,
        headers={"X-API-Key": load_api_key(), "User-Agent": "nullclaw-cct/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            parsed = json.loads(resp.read().decode())
            if not parsed.get("success"):
                return None
            data = parsed.get("data")
            # Some routes carry a second envelope inside the payload: weekly
            # serves a DO-cache miss as outer success:true wrapping inner
            # success:false + error. Test for an explicit False — the other
            # routes omit the key entirely and must not be caught here.
            if isinstance(data, dict) and data.get("success") is False:
                print(f"[WARN: CCT payload error] {data.get('error', 'unknown')}",
                      file=sys.stderr, flush=True)
                return None
            return data
    except urllib.error.HTTPError as e:
        # Diagnostics → stderr: stdout is the delivered body + contract markers.
        print(f"[WARN: CCT HTTP {e.code}] {e.read().decode(errors='replace')[:120]}",
              file=sys.stderr, flush=True)
        return None
    except Exception as e:
        print(f"[WARN: CCT unavailable - {e}]", file=sys.stderr, flush=True)
        return None


def fmt_sentiment(s: str) -> str:
    return SENTIMENT_EMOJI.get(s.lower(), s)


# ── formatters ────────────────────────────────────────────────────────────────

class Freshness(NamedTuple):
    """Whether a pre-market payload describes today's analysis.

    source_date — data["date"] as received, or None if absent/unparseable.
    age_days    — days between source_date and today, only when positive.
    """

    source_date: str | None
    is_stale: bool
    age_days: int | None


def pre_market_freshness(data: dict, today: date | None = None) -> Freshness:
    """Single source of truth for pre-market staleness.

    The pre-market route falls back to the latest D1 snapshot when today's job
    never ran (report-routes.ts:671-685), so a payload can carry a full set of
    signals and still describe a market day weeks in the past. Stale if any of:

      1. the server says so via is_stale,
      2. the date is absent or unparseable — freshness cannot be proven,
      3. the date is not today.

    Rule 3 is not redundant with rule 1: the server sets is_stale on only two
    code paths, so a future path that forgets the flag would otherwise reopen
    this bug silently.

    Rule 3 compares in UTC deliberately, to match the report route: it derives
    its own `today` as `new Date().toISOString().split('T')[0]`
    (report-routes.ts:605), and that comparison is what sets is_stale. Jobs are
    *written* under an ET business date (scheduler.ts:60-69, getESTDateString),
    so writer and reader already disagree upstream. Do not "fix" this to ET
    without also changing the route — matching only one side would make the
    skill contradict the very flag it cross-checks.

    `today` is injectable so callers (and tests) get a deterministic answer.
    """
    if today is None:
        today = datetime.now(timezone.utc).date()

    raw = data.get("date")
    parsed = None
    if isinstance(raw, str):
        try:
            parsed = date.fromisoformat(raw)
        except ValueError:
            parsed = None

    if parsed is None:
        return Freshness(source_date=None, is_stale=True, age_days=None)

    age = (today - parsed).days
    return Freshness(
        source_date=raw,
        is_stale=bool(data.get("is_stale")) or parsed != today,
        age_days=age if age > 0 else None,
    )


def format_pre_market(data: dict, today: date | None = None) -> str:
    fresh = pre_market_freshness(data, today)
    # The source date, never today's — a stale snapshot stamped with today's
    # date reads as current analysis, which is worse than no report at all.
    header = f"📊 CCT 盤前報告｜{fresh.source_date or '日期不明'}"
    if fresh.is_stale:
        header += (
            f"  ⚠️ 資料已過期（{fresh.age_days} 天前）" if fresh.age_days
            else "  ⚠️ 資料已過期"
        )
    lines = [header, ""]

    # Overall market sentiment from signal aggregation
    overall = data.get("overall_sentiment", {})
    sentiment = overall.get("sentiment", data.get("market_sentiment", ""))
    confidence = overall.get("confidence", data.get("confidence", 0))
    analyzed = data.get("symbols_analyzed", 0) or len(data.get("trading_signals", {}))

    if sentiment:
        lines.append(f"市場情緒：{fmt_sentiment(sentiment)}（信心 {int(float(confidence) * 100)}%）")
    if analyzed:
        lines.append(f"分析標的：{analyzed} 支")
    lines.append("")

    # High-confidence signals
    signals = data.get("high_confidence_signals", [])
    if signals:
        lines.append("🎯 高信心訊號（≥70%）")
        for s in signals[:8]:
            sym = s.get("symbol", "")
            sent = fmt_sentiment(s.get("sentiment", "neutral"))
            conf = int(float(s.get("confidence", 0)) * 100)
            reason = s.get("reason", s.get("reasoning", ""))
            line = f"  • {sym} {sent} {conf}%"
            if reason:
                line += f" — {reason[:80]}"
            lines.append(line)
    else:
        msg = data.get("message", "")
        lines.append(f"⏳ {msg}" if msg else "今日尚無高信心訊號")

    return "\n".join(lines)


def format_intraday(data: dict) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"📊 CCT 盤中報告｜{now}", ""]

    market_open = data.get("market_status", "") == "open"
    lines.append(f"市場狀態：{'開盤中 🟢' if market_open else '休市 ⚫'}")

    perf = data.get("current_performance", {})
    sentiment = perf.get("market_sentiment", data.get("sentiment_label", ""))
    if sentiment:
        lines.append(f"即時情緒：{fmt_sentiment(sentiment)}")

    tracking = perf.get("tracking_predictions", "")
    if tracking and tracking != "Morning predictions being monitored":
        lines.append(f"預測追蹤：{tracking}")

    # Signal breakdown if present
    bullish = data.get("bullish_signals", 0)
    bearish = data.get("bearish_signals", 0)
    if bullish or bearish:
        lines.append("")
        lines.append(f"看漲 {bullish} 支｜看跌 {bearish} 支")

    # High-confidence signals if present
    signals = data.get("high_confidence_signals", [])
    if signals:
        lines.append("")
        lines.append("🎯 高信心訊號")
        for s in signals[:5]:
            sym = s.get("symbol", "")
            sent = fmt_sentiment(s.get("sentiment", "neutral"))
            conf = int(float(s.get("confidence", 0)) * 100)
            lines.append(f"  • {sym} {sent} {conf}%")

    # Surface API message when no substantive data is available
    has_data = sentiment or bullish or bearish or signals
    if not has_data:
        msg = data.get("message", "")
        if msg:
            lines.append(f"\n⏳ {msg}")

    return "\n".join(lines)


def format_eod(data: dict) -> str:
    date = data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    lines = [f"📊 CCT 收盤報告｜{date}", ""]

    summary = data.get("daily_summary", {})
    sentiment = summary.get("overall_sentiment", "")
    analyzed = summary.get("symbols_analyzed", 0)
    bullish = summary.get("bullish_signals", 0)
    bearish = summary.get("bearish_signals", 0)
    confidence = summary.get("confidence", 0)

    if sentiment:
        conf_str = f"（信心 {int(float(confidence) * 100)}%）" if confidence else ""
        lines.append(f"今日總結：{fmt_sentiment(sentiment)}{conf_str}")
    if analyzed:
        lines.append(f"分析標的：{analyzed} 支")
    if bullish or bearish:
        neutral = analyzed - bullish - bearish if analyzed else 0
        neutral_str = f"｜中性 {neutral} 支" if neutral > 0 else ""
        lines.append(f"看漲 {bullish} 支｜看跌 {bearish} 支{neutral_str}")

    # Key events
    events = summary.get("key_events", [])
    real_events = [e for e in events if e not in (
        "Market closed", "Daily analysis complete", "Tomorrow's outlook prepared"
    )]
    if real_events:
        lines.append("")
        for e in real_events[:3]:
            lines.append(f"  • {e}")

    # High-confidence signals
    signals = data.get("high_confidence_signals", [])
    if signals:
        lines.append("")
        lines.append("🎯 高信心訊號")
        for s in signals[:6]:
            sym = s.get("symbol", "")
            sent = fmt_sentiment(s.get("sentiment", "neutral"))
            conf = int(float(s.get("confidence", 0)) * 100)
            reason = s.get("reason", s.get("reasoning", ""))
            line = f"  • {sym} {sent} {conf}%"
            if reason:
                line += f" — {reason[:80]}"
            lines.append(line)

    # Tomorrow outlook
    outlook = data.get("tomorrow_outlook", {})
    outlook_sentiment = outlook.get("sentiment", "")
    outlook_conf = outlook.get("confidence", 0)
    if outlook_sentiment and outlook_sentiment != "neutral":
        lines.append("")
        conf_str = f"（信心 {int(float(outlook_conf) * 100)}%）" if outlook_conf else ""
        lines.append(f"明日展望：{fmt_sentiment(outlook_sentiment)}{conf_str}")

    # No pending-message branch here: handleEndOfDayReport never emits a
    # `message` field — its empty state is a placeholder daily_summary. The
    # empty case is reported via has_eod_data() → [skill-status:degraded].
    return "\n".join(lines)


def format_weekly(data: dict) -> str:
    week_start = data.get("week_start", "")
    lines = [f"📊 CCT 週報｜{week_start}", ""]

    report = data.get("report", data)  # top-level or nested under "report"
    overview = report.get("weekly_overview", {})
    sentiment_trend = overview.get("sentiment_trend", "")
    avg_conf = overview.get("average_confidence", 0)

    if sentiment_trend:
        lines.append(f"本週趨勢：{fmt_sentiment(sentiment_trend)}（平均信心 {int(float(avg_conf) * 100)}%）")

    weekly_summary = report.get("weekly_summary", {})
    weekly_return = weekly_summary.get("weekly_return", None)
    volatility = weekly_summary.get("volatility", None)
    if weekly_return is not None:
        sign = "+" if weekly_return >= 0 else ""
        lines.append(f"週平均回報：{sign}{weekly_return:.2f}%")
    if volatility is not None:
        lines.append(f"波動率：{volatility:.2f}%")

    highlights = overview.get("key_highlights", [])
    if highlights:
        lines.append("")
        for h in highlights[:3]:
            lines.append(f"  • {h}")

    # Daily breakdown
    breakdown = report.get("daily_breakdown", [])
    if breakdown:
        lines.append("")
        lines.append("📅 每日紀錄")
        for day in breakdown:
            date = day.get("date", "")
            day_sent = fmt_sentiment(day.get("sentiment", "neutral"))
            count = day.get("signal_count", 0)
            lines.append(f"  {date}  {day_sent}  訊號 {count}")

    # Performance summary
    perf = report.get("performance_summary", {})
    accuracy = perf.get("accuracy_rate", 0)
    total_signals = perf.get("total_signals", 0)
    if accuracy:
        lines.append("")
        lines.append(f"準確率：{int(float(accuracy) * 100)}%  總訊號：{total_signals}")

    # Next week outlook
    next_week = report.get("next_week_outlook", {})
    next_sentiment = next_week.get("sentiment", weekly_summary.get("next_week_sentiment", ""))
    if next_sentiment:
        lines.append("")
        lines.append(f"下週展望：{fmt_sentiment(next_sentiment)}")

    # Ditto: handleWeeklyReport has no `message` field either, and its
    # cache-miss envelope is already rejected in get().
    return "\n".join(lines)


# ── substantive-content predicates (ok vs degraded) ───────────────────────────
# The CCT API answers 200 + success:true even when a job never ran or outright
# failed — src/routes/report-routes.ts turns a `status === 'failed'` job into a
# success envelope carrying only a message. Deciding ok/degraded on "did we get
# a payload" would therefore report ok while the pipeline is broken, so each
# mode tests for real analysis content instead. Each empty state has a
# different shape: pre-market/intraday zero out counters, eod zeroes a nested
# counter and carries no message at all, weekly loses `report` entirely.

def has_pre_market_data(data: dict, today: date | None = None) -> bool:
    """Real analysis content, for today.

    Content alone proves nothing here: the D1 fallback serves a complete set of
    signals from whatever day last succeeded, so a stale payload is
    indistinguishable from a fresh one except by date/is_stale. Stale is
    `degraded` rather than `failed` for the same reason an empty payload is —
    a retry returns the same snapshot.
    """
    has_content = bool(data.get("symbols_analyzed")
                       or data.get("high_confidence_signals")
                       or data.get("all_signals"))
    return has_content and not pre_market_freshness(data, today).is_stale


def has_intraday_data(data: dict) -> bool:
    return bool(data.get("total_symbols") or data.get("symbols"))


def has_eod_data(data: dict) -> bool:
    summary = data.get("daily_summary") or {}
    return bool(summary.get("symbols_analyzed") or data.get("high_confidence_signals"))


def has_weekly_data(data: dict) -> bool:
    report = data.get("report", data)  # top-level or nested, as format_weekly reads it
    if not isinstance(report, dict):
        return False
    return bool(report.get("weekly_overview") or report.get("daily_breakdown"))


# ── mode → endpoint + formatter + content predicate ───────────────────────────

MODES = {
    "pre-market": ("/api/v1/reports/pre-market", format_pre_market, "盤前報告", has_pre_market_data),
    "intraday":   ("/api/v1/reports/intraday",   format_intraday,   "盤中報告", has_intraday_data),
    "eod":        ("/api/v1/reports/end-of-day",  format_eod,        "收盤報告", has_eod_data),
    "weekly":     ("/api/v1/reports/weekly",      format_weekly,     "週報",     has_weekly_data),
}


def main() -> None:
    parser = argparse.ArgumentParser(description="CCT 4-moment trading intelligence")
    parser.add_argument("--mode", required=True, choices=list(MODES),
                        help="pre-market | intraday | eod | weekly")
    parser.add_argument("--deliver-to", default=None, help="Telegram chat ID")
    parser.add_argument("--account", default="main", help="Telegram account name")
    args = parser.parse_args()

    endpoint, formatter, label, has_data = MODES[args.mode]
    data = get(endpoint)

    if data is None:
        msg = f"📭 CCT {label}尚未產生或暫時無法存取"
        status = "degraded"
    else:
        msg = formatter(data)
        # Payload present but empty/placeholder is still a degraded run — see
        # the predicates above for why a payload alone proves nothing.
        status = "ok" if has_data(data) else "degraded"

    deliver_or_fail(args.deliver_to, msg, account=args.account)

    emit_skill_status(status)
    emit_trace()


if __name__ == "__main__":
    main()
