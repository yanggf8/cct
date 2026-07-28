# CCT pre-market freshness gate

Date: 2026-07-28
Status: approved, implementing
Target: `skills/cct/scripts/run.py`

## Problem

`has_pre_market_data()` decides `[skill-status:ok]` vs `degraded` purely on
whether the payload carries content:

```python
def has_pre_market_data(data: dict) -> bool:
    return bool(data.get("symbols_analyzed")
                or data.get("high_confidence_signals")
                or data.get("all_signals"))
```

The pre-market route falls back to the latest D1 snapshot when today's job never
ran (`report-routes.ts:671-685`), setting `date` to the snapshot date and
`is_stale = sourceDate !== today`. Stale data still carries full content, so the
predicate returns `True` and the skill reports `ok`.

`format_pre_market()` compounds it: the header prints
`datetime.now(timezone.utc)` rather than `data["date"]`, so the delivered
message stamps *today's* date on the snapshot.

Observed 2026-07-28: the GitHub Actions scheduler
(`.github/workflows/trading-system.yml`) has been `disabled_inactivity` since
its last successful run on 2026-06-08, so no analysis job has run in 50 days.
Intraday and end-of-day correctly report `degraded` (empty payloads). Pre-market
reports `ok` and delivers 2026-06-08 buy signals headed `2026-07-27`.

Empty reports are a visible outage. Stale reports dressed as today's analysis
are active misinformation, which makes this the more dangerous of the two.

## Design

One pure helper is the single source of truth for staleness; both the status
predicate and the formatter read it, so the rendered body and the emitted
marker can never disagree about the same payload.

```python
class Freshness(NamedTuple):
    source_date: str | None   # data["date"] as received, None if absent/unparseable
    is_stale: bool
    age_days: int | None      # today - source_date, None unless positive

def pre_market_freshness(data: dict, today: date | None = None) -> Freshness
```

`today` is injectable so tests are deterministic without freezing the clock.
It defaults to `datetime.now(timezone.utc).date()`.

### Staleness criterion

Stale if **any** of:

1. `data["is_stale"]` is truthy — the server's own verdict.
2. `data["date"]` is absent, not a string, or not parseable as `YYYY-MM-DD`.
3. the parsed date is not equal to `today` (UTC).

Rule 1 alone would be simpler, but the server sets `is_stale` on only two code
paths (`report-routes.ts:762`, `:1186`). A future path that forgets the flag
would silently reopen this exact bug, so rule 3 cross-checks it independently.
Rule 2 makes "cannot prove freshness" fail closed.

**Rule 3 compares in UTC to match the report route, not the job writer.** The
two sides of the server already disagree:

- Jobs are *written* under an ET business date — `scheduler.ts:60-69`
  (`getESTDateString`, `America/New_York`), used at `:221`.
- The pre-market route *reads* with `new Date().toISOString().split('T')[0]`
  (`report-routes.ts:605`) — UTC — and that comparison is what sets `is_stale`.

The skill matches the route. Do **not** "fix" this by switching the skill to ET
while the route stays on UTC: that would make the skill contradict the very
flag rule 1 reads, which is worse than the present mismatch.

The pre-market cron fires at 13:35 UTC (09:35 ET), the same calendar day in
both zones, so the scheduled path carries no false-stale risk.

A *manual* run between 00:00 UTC and ET midnight (04:00 UTC in EDT, 05:00 in
EST) can mark a report stale that is still the current ET trading day's. The
server reports `is_stale: true` in that window regardless, so the skill agrees
with the API rather than inventing a verdict. Pre-existing server semantics,
not something this gate introduces.

### Changes

| Function | Change |
|----------|--------|
| `pre_market_freshness()` | new; pure, injectable clock |
| `has_pre_market_data()` | returns substantive content **and** not stale |
| `format_pre_market()` | header prints `data["date"]`; appends a staleness warning |

Header rendering:

- fresh: `📊 CCT 盤前報告｜2026-07-28`
- stale with known age: `📊 CCT 盤前報告｜2026-06-08  ⚠️ 資料已過期（50 天前）`
- stale, age unknown or non-positive: `📊 CCT 盤前報告｜2026-06-08  ⚠️ 資料已過期`
- date absent or unparseable: `📊 CCT 盤前報告｜日期不明  ⚠️ 資料已過期`

### Out of scope

- `intraday` / `eod` / `weekly` predicates and formatters. Those routes do not
  emit `is_stale`, and their empty states already report `degraded` correctly.
- Re-enabling the GitHub Actions scheduler. Tracked separately; this gate must
  land first, because once the pipeline resumes the stale path stops being
  reachable and the bug goes back into hiding.

### Deliberate trade-offs

- **Stale is `degraded`, not `failed`.** Consistent with the existing empty-payload
  rule in `SKILL.md`: `failed` triggers repair/retry, and retrying cannot make
  the pipeline generate a report it never generated. The same holds for stale
  data — a retry returns the same snapshot.
- **The report is still delivered.** The gate changes the marker and the header,
  not whether the user gets a message. A silently dropped report is worse than a
  labelled stale one.
- **Freshness is computed twice per run** (once by the formatter, once by the
  predicate). Restructuring all four formatters to thread a shared `today`
  through the `MODES` table is not worth it for a divergence window that only
  opens if UTC midnight falls between two adjacent statements — unreachable on
  the 13:35 UTC schedule.

## Consequence on deploy

Until the GitHub Actions scheduler is re-enabled, pre-market will report
`degraded` every weekday and the cron will alert. That is correct: it *is*
serving stale data. Expect the first pre-market red since the pipeline died.

## Testing

`skills/cct/scripts/test_run.py`, plain `unittest`, runnable directly with
`python3 test_run.py` — matching the `claw-skills` `lib/test_*.py` convention.
`a/cct` has no Python test infrastructure today; this is the first.

The stale fixture is the **real payload captured from the live API on
2026-07-28**, not an invented shape. The original bug survived because nothing
ever asserted against a genuine degraded response.

| # | Case | Expected |
|---|------|----------|
| 1 | fresh date, content present | not stale, `has_pre_market_data` True, header shows source date, no warning |
| 2 | real 2026-06-08 payload (`is_stale: true`) | stale, predicate False, header `2026-06-08` + `（50 天前）` |
| 3 | old date, `is_stale` **absent** | stale — server-flag-independent cross-check |
| 4 | `is_stale: true`, date == today | stale, warning without day count |
| 5 | `date` key missing | stale, header `日期不明` |
| 6 | `date` unparseable | stale, header `日期不明` |
| 7 | fresh date, zero content | predicate False — regression guard on existing empty-payload behaviour |

Note: `test_run.py` imports `run.py`, which resolves the shared `delivery` /
`trace_marker` libs via `_resolve_skills_lib()`. On a host without
`~/a/claw-skills/lib` (or `$CLAW_SKILLS_LIB`) the import fails and the tests
cannot run. This mirrors how the skill itself is deployed.
