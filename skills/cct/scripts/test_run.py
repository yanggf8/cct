#!/usr/bin/env python3
"""Tests for the CCT skill's pre-market freshness gate.

Run directly, no pytest or runner needed:

    python3 skills/cct/scripts/test_run.py

Importing run.py pulls in the shared claw-skills libs (delivery, trace_marker)
via run._resolve_skills_lib(). On a host where neither $CLAW_SKILLS_LIB nor
~/a/claw-skills/lib exists, that import fails and these tests cannot run — the
same resolution the deployed skill depends on.
"""
import json
import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run


# Captured verbatim from the live API on 2026-07-28:
#   GET /api/v1/reports/pre-market  ->  .data
# The pipeline had been dead since 2026-06-08, so this is the exact shape of a
# stale-but-content-bearing payload. The original bug survived precisely because
# nothing ever asserted against a genuine degraded response.
STALE_PAYLOAD_JSON = """
{
    "type": "pre_market_briefing",
    "market_status": "pre_market",
    "date": "2026-06-08",
    "is_stale": true,
    "key_insights": [
        "Pre-market analysis complete",
        "Data from 2026-06-08",
        "Note: Using previous day data"
    ],
    "high_confidence_signals": [
        {"symbol": "AAPL",  "sentiment": "bullish", "confidence": 0.95,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": "High confidence signal"},
        {"symbol": "MSFT",  "sentiment": "bullish", "confidence": 0.815,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": "High confidence signal"},
        {"symbol": "GOOGL", "sentiment": "bullish", "confidence": 0.95,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": "High confidence signal"},
        {"symbol": "TSLA",  "sentiment": "bullish", "confidence": 0.865,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": "High confidence signal"},
        {"symbol": "NVDA",  "sentiment": "bullish", "confidence": 0.95,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": "High confidence signal"}
    ],
    "all_signals": [
        {"symbol": "AAPL",  "sentiment": "bullish", "confidence": 0.95,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": ""},
        {"symbol": "MSFT",  "sentiment": "bullish", "confidence": 0.815,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": ""},
        {"symbol": "GOOGL", "sentiment": "bullish", "confidence": 0.95,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": ""},
        {"symbol": "TSLA",  "sentiment": "bullish", "confidence": 0.865,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": ""},
        {"symbol": "NVDA",  "sentiment": "bullish", "confidence": 0.95,
         "primary_model": "GPT-OSS 120B", "primary_confidence": null,
         "mate_model": "DeepSeek-R1 32B", "mate_confidence": null,
         "status": "success", "reason": ""}
    ],
    "high_confidence_count": 5,
    "data_source": "d1_snapshot",
    "generated_at": "2026-06-08T12:30:00.000Z",
    "symbols_analyzed": 5
}
"""

# The day the stale payload above was captured. 2026-06-08 -> 2026-07-28 = 50 days.
CAPTURE_DAY = date(2026, 7, 28)


def stale_payload(**overrides) -> dict:
    """The real stale payload, with optional top-level overrides.

    Pass a key with value None to delete it (JSON null is not used at the top
    level of this payload, so there is no ambiguity).
    """
    data = json.loads(STALE_PAYLOAD_JSON)
    for key, value in overrides.items():
        if value is None:
            data.pop(key, None)
        else:
            data[key] = value
    return data


def fresh_payload(today: date = CAPTURE_DAY, **overrides) -> dict:
    """The same payload as it would look on a healthy day."""
    defaults = {
        "date": today.isoformat(),
        "is_stale": False,
        # The captured insights name the snapshot date ("Data from 2026-06-08").
        # Scrub them so a formatter that later renders key_insights cannot
        # quietly pollute the fresh-path assertions.
        "key_insights": ["Pre-market analysis complete"],
    }
    defaults.update(overrides)
    return stale_payload(**defaults)


class PreMarketFreshness(unittest.TestCase):
    """pre_market_freshness() is the single source of truth for staleness."""

    def test_fresh_payload_is_not_stale(self):
        f = run.pre_market_freshness(fresh_payload(), today=CAPTURE_DAY)
        self.assertFalse(f.is_stale)
        self.assertEqual(f.source_date, "2026-07-28")

    def test_real_stale_payload_is_stale_with_age(self):
        f = run.pre_market_freshness(stale_payload(), today=CAPTURE_DAY)
        self.assertTrue(f.is_stale)
        self.assertEqual(f.source_date, "2026-06-08")
        self.assertEqual(f.age_days, 50)

    def test_old_date_is_stale_even_when_server_omits_the_flag(self):
        """Rule 3 cross-checks rule 1.

        The server sets is_stale on only two code paths. A future path that
        forgets it must not silently reopen this bug.
        """
        f = run.pre_market_freshness(stale_payload(is_stale=None), today=CAPTURE_DAY)
        self.assertTrue(f.is_stale)
        self.assertEqual(f.age_days, 50)

    def test_server_flag_wins_even_when_date_is_today(self):
        f = run.pre_market_freshness(
            stale_payload(date=CAPTURE_DAY.isoformat(), is_stale=True), today=CAPTURE_DAY
        )
        self.assertTrue(f.is_stale)
        self.assertIsNone(f.age_days)

    def test_missing_date_fails_closed(self):
        f = run.pre_market_freshness(stale_payload(date=None, is_stale=None), today=CAPTURE_DAY)
        self.assertTrue(f.is_stale)
        self.assertIsNone(f.source_date)
        self.assertIsNone(f.age_days)

    def test_unparseable_date_fails_closed(self):
        f = run.pre_market_freshness(
            stale_payload(date="not-a-date", is_stale=None), today=CAPTURE_DAY
        )
        self.assertTrue(f.is_stale)
        self.assertIsNone(f.source_date)

    def test_future_date_is_stale_without_negative_age(self):
        f = run.pre_market_freshness(
            stale_payload(date="2026-08-01", is_stale=None), today=CAPTURE_DAY
        )
        self.assertTrue(f.is_stale)
        self.assertIsNone(f.age_days)


class HasPreMarketData(unittest.TestCase):
    """The status predicate gates on content AND freshness."""

    def test_fresh_with_content_is_ok(self):
        self.assertTrue(run.has_pre_market_data(fresh_payload(), today=CAPTURE_DAY))

    def test_real_stale_payload_is_degraded(self):
        """The regression this whole change exists for."""
        self.assertFalse(run.has_pre_market_data(stale_payload(), today=CAPTURE_DAY))

    def test_old_date_without_server_flag_is_degraded(self):
        """Rule 3 must gate the predicate too, not only the freshness helper.

        Without this, a server that stops emitting is_stale would sail back
        through has_pre_market_data() even though pre_market_freshness() knows
        better.
        """
        self.assertFalse(
            run.has_pre_market_data(stale_payload(is_stale=None), today=CAPTURE_DAY)
        )

    def test_fresh_but_empty_is_degraded(self):
        """Regression guard: the pre-existing empty-payload rule still holds."""
        empty = fresh_payload(
            symbols_analyzed=0, high_confidence_signals=[], all_signals=[]
        )
        self.assertFalse(run.has_pre_market_data(empty, today=CAPTURE_DAY))


class FormatPreMarket(unittest.TestCase):
    """The delivered body must not stamp today's date on old data."""

    def test_fresh_header_shows_source_date_without_warning(self):
        body = run.format_pre_market(fresh_payload(), today=CAPTURE_DAY)
        self.assertIn("2026-07-28", body)
        self.assertNotIn("過期", body)

    def test_stale_header_shows_source_date_and_age(self):
        body = run.format_pre_market(stale_payload(), today=CAPTURE_DAY)
        header = body.splitlines()[0]
        self.assertIn("2026-06-08", header)
        self.assertIn("50", header)
        self.assertIn("過期", header)
        # The bug: today's date must not appear anywhere in a stale report.
        self.assertNotIn("2026-07-28", body)

    def test_stale_without_age_omits_day_count(self):
        body = run.format_pre_market(
            stale_payload(date=CAPTURE_DAY.isoformat(), is_stale=True), today=CAPTURE_DAY
        )
        header = body.splitlines()[0]
        self.assertIn("過期", header)
        self.assertNotIn("天前", header)

    def test_missing_date_renders_unknown(self):
        body = run.format_pre_market(
            stale_payload(date=None, is_stale=None), today=CAPTURE_DAY
        )
        header = body.splitlines()[0]
        self.assertIn("日期不明", header)
        self.assertIn("過期", header)

    def test_signals_still_render(self):
        """The gate marks the report; it does not gut it."""
        body = run.format_pre_market(stale_payload(), today=CAPTURE_DAY)
        self.assertIn("AAPL", body)
        self.assertIn("分析標的：5 支", body)


# ── end-of-day ────────────────────────────────────────────────────────────────

# The real EOD payload, captured from the live API on 2026-07-30:
#   GET /api/v1/reports/end-of-day?run_id=2026-07-29_end-of-day_9ac6e86f-...
#
# It is a prediction *scorecard* — flat, camelCase, and carrying no
# `daily_summary` at all. The shape format_eod() was originally written against
# is the empty placeholder that report-routes.ts:1195-1214 synthesises when no
# snapshot matches the requested date, which is the only thing anyone had ever
# seen. So the skill reported `degraded` on a perfectly good report.
EOD_FIXTURE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "testdata", "eod-2026-07-29.json"
)


def real_eod(**overrides) -> dict:
    """The captured scorecard, with optional top-level overrides (None deletes)."""
    with open(EOD_FIXTURE, encoding="utf-8") as f:
        data = json.load(f)
    for key, value in overrides.items():
        if value is None:
            data.pop(key, None)
        else:
            data[key] = value
    return data


# What the route returns when it finds no snapshot for the requested date.
# Content-free by construction — this must stay `degraded`.
EOD_PLACEHOLDER = {
    "type": "end_of_day_summary",
    "date": "2026-07-30",
    "market_status": "closed",
    "daily_summary": {
        "symbols_analyzed": 0,
        "overall_sentiment": "neutral",
        "key_events": ["Market closed", "EOD analysis not yet available"],
    },
    "tomorrow_outlook": {
        "sentiment": "neutral",
        "confidence": 0.5,
        "key_factors": ["Awaiting market close data"],
    },
}


class HasEodData(unittest.TestCase):
    def test_real_scorecard_counts_as_data(self):
        """The regression: a complete scorecard was being reported as degraded."""
        self.assertTrue(run.has_eod_data(real_eod()))

    def test_placeholder_is_degraded(self):
        self.assertFalse(run.has_eod_data(EOD_PLACEHOLDER))

    def test_scorecard_without_symbols_analyzed_still_counts(self):
        """Don't hang the whole verdict on one optional counter."""
        self.assertTrue(run.has_eod_data(real_eod(symbols_analyzed=None)))

    def test_legacy_daily_summary_shape_still_counts(self):
        """Back-compat: honour the documented shape if the route ever serves it."""
        self.assertTrue(run.has_eod_data({"daily_summary": {"symbols_analyzed": 3}}))


class FormatEod(unittest.TestCase):
    def test_header_uses_session_date_not_today(self):
        """Same lesson as pre-market: never stamp today's date on older data."""
        header = run.format_eod(real_eod()).splitlines()[0]
        self.assertIn("2026-07-29", header)

    def test_renders_grade_and_high_confidence_hit_rate(self):
        body = run.format_eod(real_eod())
        self.assertIn("D", body)
        self.assertIn("0/2", body)
        self.assertIn("5 支", body)

    def test_renders_every_signal_with_its_outcome(self):
        body = run.format_eod(real_eod())
        for ticker in ("AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"):
            self.assertIn(ticker, body)
        self.assertIn("✓", body)  # MSFT and TSLA were called right
        self.assertIn("✗", body)  # AAPL, GOOGL, NVDA were not

    def test_renders_laggards(self):
        body = run.format_eod(real_eod())
        self.assertIn("NVDA", body)
        self.assertIn("-3.6%", body)

    def test_renders_tomorrow_outlook(self):
        body = run.format_eod(real_eod())
        self.assertIn("偏空", body)
        self.assertIn("AAPL (78% confidence)", body)

    def test_placeholder_still_renders_without_crashing(self):
        body = run.format_eod(EOD_PLACEHOLDER)
        self.assertTrue(body.startswith("📊 CCT 收盤報告"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
