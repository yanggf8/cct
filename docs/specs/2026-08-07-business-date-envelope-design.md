# Business date on the report envelope

Date: 2026-08-07
Status: approved in principle. **Both prerequisites have shipped** (1d3ed29, 87cda45);
the envelope field itself is not yet implemented.
Target: `src/routes/report-routes.ts`, `src/routes/jobs-routes.ts`,
`src/modules/trading-calendar.ts`, and the consumer at
`~/a/claw-skills/crates/cct`

Revision 3. Revision 1 was reviewed against the code it described and four of its
claims were wrong; revision 2 fixed those; an adversarial review of revision 2
found four more, two of which are prerequisites rather than details. The record
of what each revision got wrong is kept at the end, because "a date rule written
without checking the code that implements it" is the failure this design exists
to prevent, and the spec managed to commit it twice.

## Problem

One concept — *which trading day is this report about* — is spelled differently
in every layer, and every reader re-derives it.

**Storage** holds it under a different column name per table:

| Table | Column | Defined at |
|---|---|---|
| `report_snapshots` | `report_date` | `schema/current-schema.sql:135` |
| `scheduled_job_results` | `scheduled_date` | `schema/current-schema.sql:144` |
| `job_executions` | `scheduled_date` | `d1-job-storage.ts:754` |

**The API payloads** each pick their own spelling, inside `data`:

| Route | Field | At |
|---|---|---|
| pre-market | `date` — the snapshot's own date | `report-routes.ts:900` |
| pre-market (placeholder) | `date` — *today* | `report-routes.ts:1046` |
| intraday | `scheduled_date` | `report-routes.ts:1227` |
| end-of-day (success) | **often nothing** — the D1 payload is returned as-is | `report-routes.ts:1318` |
| end-of-day (placeholder) | `date` — *today* | `report-routes.ts:1337` |
| weekly | neither; `week_start` / `week_end` | `report-routes.ts:579` |

**"Today in ET" has four implementations**, three correct by different routes and
one correct only by accident:

| Where | How | Verdict |
|---|---|---|
| `modules/scheduler.ts:60` `getESTDateString` | `Intl` `en-CA` in zone | correct |
| `modules/trading-calendar.ts:174` `getCurrentDateET` | `formatToParts` in zone, rebuilt and read back with local-time accessors — symmetric, no UTC enters | correct |
| `modules/handlers/date-utils.ts:13` `getTodayInZone` | `Intl` `en-CA` in zone | correct |
| `modules/d1-job-storage.ts` (before this change) | `new Date(x.toLocaleString(…))` → `toISOString()` | **agrees only because Workers run TZ=UTC** |

There are also **two different exported functions named `getCurrentTimeET`** —
`trading-calendar.ts:128` returns a `Date`, `handlers/date-utils.ts` returns
`{hour, minute}`.

**The consumer** guesses twice over. `crates/cct/src/api.rs:111` discards
everything but `data`, so nothing outside `data` can reach it at all; then
`freshness.rs` reads `data["date"]`, which only pre-market has, and compares it
against a date the skill computes itself in UTC (`main.rs:59`).

Two distinct failures follow, both observed.

**1. The reader re-derives the day, and derives it wrong.** Until 2026-08-07
these routes answered `new Date().toISOString().split('T')[0]` — a UTC date —
while the jobs write under the ET business date. For the four to five hours after
00:00 UTC the UTC calendar day is already tomorrow while the ET session is still
today, and that window is exactly when end-of-day work lands. The reader asked D1
for a day the writer never used, found nothing, and synthesised its "EOD analysis
not yet available" placeholder over data that existed.

**2. The identity of the content is conflated with the time of the request.**
`date: today` at `report-routes.ts:1337` is not the date of the analysis; it is
the date the caller asked. When the lookup misses, the placeholder still announces
a date with full confidence, so "there is no data for this day" and "here is this
day's data" arrive in the same shape. That is what made a dead pipeline look like
a working one for 50 days (2026-06-08 to 07-27).

The same conflation runs through the display side. `render.rs:143`
`eod_session_date` falls through `date`, `_scheduled_date`, `timestamp`,
`marketCloseTime`, `generated_at` and finally `now`, taking the first ten
characters of whichever it finds. `timestamp` is an ISO **UTC** instant, so
truncating it launders a UTC date into a business date, and `now` is the skill's
own UTC day. The chain exists only because no field states the answer.

A stop-the-bleeding change shipped as c139b76: `marketToday()`
(`report-routes.ts:74`) delegates to `getCurrentDateET()`, and the UTC
derivations at `:107`, `:723`, `:1102`, `:1315` and the weekly anchor at `:123`
use it. `getD1FallbackData` no longer round-trips through a locale string. It
stops the current bleed and nothing more.

## Prerequisites

Two defects found while reviewing this design had to be fixed **before**
`business_date` could mean anything. Neither was caused by this design; both
made it undeliverable. **Both have now shipped**, each as its own change with
its own test, and each test fails against the code it replaced.

### P1 — The weekly window did not contain its own day on Mondays and Tuesdays — *shipped, 1d3ed29*

`getWeekString` and `getWeekStartDate` (`report-routes.ts:1533`, `:1539`) are not
inverses. `getWeekString` counts days from Jan 1 and divides by seven;
`getWeekStartDate` reverses that and then snaps to Monday. Reproduced under
TZ=UTC:

| Day | `getWeekString` | window from `getWeekStartDate` | contains the day |
|---|---|---|---|
| 2026-08-03 Mon | `2026-W31` | 2026-07-27 … 2026-08-02 | **no** |
| 2026-08-04 Tue | `2026-W31` | 2026-07-27 … 2026-08-02 | **no** |
| 2026-08-05 Wed | `2026-W32` | 2026-08-03 … 2026-08-09 | yes |

So `GET /api/v1/reports/weekly` on a Monday or Tuesday reads the *previous*
week's daily rows. A `business_date` on that response would faithfully describe
the wrong window. The `T12:00:00Z` anchor added in c139b76 fixes only the
UTC-versus-ET boundary and did nothing here.

Fixed in 1d3ed29: both directions now derive from the same Monday, under
ISO-8601 numbering, and the pair moved to `trading-calendar` beside
`isTradingDay`. `npm run test:week-round-trip` states the property over every
date from 2025-12-01 to 2027-01-31.

### P2 — The API write path keyed the business day in UTC — *shipped, 87cda45*

The cron writer uses ET (`getESTDateString`, `scheduler.ts:60`). The
manually-triggered job path does not:

```
src/routes/jobs-routes.ts:834   let scheduledDate = new Date().toISOString().split('T')[0];
src/routes/jobs-routes.ts:945   const actualToday = new Date().toISOString().split('T')[0];
```

`jobs-routes.ts:943` states the intent in a comment — *"scheduled_date: the market
date this report is FOR"* — and the next line computes a UTC date. A manual
`POST /api/v1/jobs/pre-market` at 02:00 UTC writes the row under `2026-08-07`
while the ET trading day is `2026-08-06`, so the reader this design fixes still
misses it. Same pattern at `:1133`, `:1409` and in
`modules/pre-market-data-bridge.ts:476,865,887,903`.

Revision 2 put these in "out of scope" behind the words *"addressed if and when
one is shown to key a business day."* They were then shown to. Writer and reader
must agree on the same business date, or the envelope field records the
disagreement instead of removing it.

Fixed in 87cda45: ten sites across `jobs-routes.ts` and
`pre-market-data-bridge.ts` now take the date from `getCurrentDateET`.
`npm run test:business-date-sources` freezes the clock at 2026-08-07T02:00:00Z
and pins the answer, then bans the UTC idiom in the three files where every
"today" keys a business day.

## Design

### 1. One date authority, with a stated boundary

- **`modules/trading-calendar.ts` answers "what day is the market on".** It
  already owns trading days, NYSE holidays and market hours. `getCurrentDateET()`
  is the market business date; everything serving or storing market data uses it,
  readers and writers alike.
- **`modules/handlers/date-utils.ts` answers "what day did this request ask
  for"** — `?date`, `?tz`, the saved Durable Object preference. A property of the
  request, not of the market.

`getESTDateString` and `getTodayInZone` are correct but redundant. They are not
deleted here; no new caller may be added to either.

### 2. `business_date` in `metadata`, on every successful report response

```json
{
  "success": true,
  "timestamp": "2026-08-07T00:16:14.266Z",
  "data": { "...": "unchanged" },
  "metadata": {
    "version": "v1",
    "source": "d1_snapshot",
    "business_date": "2026-08-06",
    "has_content": true
  }
}
```

`metadata.business_date` is the identity of the content; `timestamp` is when the
response was produced. Separate fields because they are separate facts.

**The rule, stated so it cannot be read two ways:**

> When `has_content` is `true`, `business_date` is the `report_date` /
> `scheduled_date` of the row that supplied the content. It is **never** the day
> the request was made. When `has_content` is `false`, `business_date` is the
> trading day that was looked for, and no content is present to contradict it.

Without that prohibition a stale pre-market hit — content from 2026-08-05 served
on 2026-08-06 — could be labelled `business_date: "2026-08-06"`, and a consumer
trusting the envelope would read a two-day-old briefing as today's.

**Why `metadata` and not the top level.** The envelope is built by
`ApiResponseFactory.success` / `.cached` / `.error`
(`modules/api-v1-responses.ts:57,87,101`), shared by every route in the worker.
A top-level field changes that signature for all of them to serve four routes.
`metadata` is already a per-call-site `Record<string, any>` carrying provenance
(`source`, `version`, `ttl`), so both fields land beside `source` with **no
change to the shared factory**.

**Error responses are out of the contract.** `ApiResponseFactory.error` carries no
metadata, and a request that cannot be answered has no business date — e.g.
`GET /api/v1/reports/weekly/2099-W01` returns 404 (`report-routes.ts:500`). The
contract binds `success` and `cached` envelopes. `has_content: false` is for a
*valid* day with no data, which is a different thing from an invalid request.

**Format and timezone.** `YYYY-MM-DD`, always ET, always formatted in the zone.
ET is the market's own time, so the trading day *is* the ET date; never derived
from UTC, never round-tripped through it. Three forms to reject in review:

- `new Date(d.toLocaleString('en-US', {timeZone}))` → `.toISOString().split('T')[0]`
  — agrees only because Workers run TZ=UTC, and it shifts a *date-only* string
  back one day (verified: `"2026-08-06"` → `"2026-08-05"`).
- `new Date().toISOString().split('T')[0]` — a UTC date.
- `someIsoTimestamp.slice(0, 10)` — the UTC date of an instant, which is how
  `eod_session_date` currently launders one.

Where an hour is needed alongside the date, use `hourCycle: 'h23'`, not
`hour12: false`. Both yield `"00"` at midnight on current ICU (verified, Node 24),
but `hour12: false` has historically yielded `"24"`, and `new Date(y, m, d, 24, …)`
rolls into the next day — moving the business date at the moment it flips.

### 3. Weekly's business date

One rule for four reports. Weekly's value is **the last trading day within the
week's window that is not in the future**, via `trading-calendar.isTradingDay`
(`trading-calendar.ts:55`), which the weekly path does not currently consult.

Explicitly **not `week_end`**: `endDate` is `startDate + 6 days`
(`report-routes.ts:451`) with `startDate` snapped to Monday, so `week_end` is
always a Sunday. Nor is it "the Friday" — a holiday Friday makes Thursday the
answer. This is only definable once P1 makes the window correct.

### 4. Consumer change

Three layers, not one. Revision 2 named only the third.

1. **`crates/cct/src/api.rs`** — `unwrap_envelope` returns `Some(data)` and drops
   the envelope (`api.rs:111`), so `metadata` never reaches the skill. It must
   return the payload together with the provenance the envelope carries. Its
   existing warnings already read `metadata.source`, so the envelope is in hand
   at that point; only the return type changes.
2. **`crates/cct/src/main.rs:59`** — `today` is `Timestamp::now().in_tz("UTC")`.
   The comparison timezone must follow the field read (table below).
3. **`freshness.rs` / `render.rs`** — staleness compares `business_date`;
   `eod_session_date`'s five-key fallback chain collapses to reading
   `business_date`, which removes the `timestamp`-truncation path entirely.

| Field read | Compare / display against |
|---|---|
| `metadata.business_date` | today in `America/New_York` |
| fallback `data["date"]` | today in UTC (what the old route served) |

Binding the timezone to the field's provenance is what makes the two repos
deployable in either order:

- **Worker first.** The skill has not shipped, discards `metadata` anyway, falls
  back to `data["date"]` and compares in UTC — unchanged. One narrow exposure:
  pre-market's placeholder branch now emits an ET `date`, so a *manual* run
  between 00:00 and 05:00 UTC would call a fresh report stale. The pre-market
  cron runs at 15:35 UTC, where ET and UTC agree.
- **Skill first.** No `business_date` is present, so it falls back and compares in
  UTC against the UTC date the old route still serves — correct. Switching the
  skill's `today` to ET *unconditionally* would instead break this order in the
  reverse direction, calling fresh reports stale for the same hours the original
  bug covered. That is precisely why the rule is per-field, not global.

`jiff` is built with `tzdb-bundle-always` (`crates/cct/Cargo.toml:18`) and other
crates already use named zones, so `America/New_York` needs nothing from the host
and works inside the nanoclaw container.

## Testing

Modelled on `tests/validation/test-cache-hit-contract.mjs`, which exists for the
same class of defect and states its invariant over every site rather than the one
that broke.

1. ~~Week-number round trip (P1)~~ — shipped as `test:week-round-trip`.
2. ~~Writer/reader agreement (P2)~~ — shipped as `test:business-date-sources`.
3. **Envelope contract, end to end.** Real dispatchers against a stubbed Durable
   Object and D1, asserting on the serialized wire response: every report route
   returns `metadata.business_date`; it matches `YYYY-MM-DD`; with
   `has_content: true` it equals the row's date and **not** the request day; on a
   miss it equals the day requested with `has_content: false`.
4. **The timezone boundary, pinned.** At `2026-08-07T00:16:14Z` — ET evening of
   2026-08-06 — every route answers `business_date: "2026-08-06"`. Fails against
   the pre-change code, which is what makes it a regression test.
5. **Weekly's definition.** A week whose Friday is an NYSE holiday resolves to
   Thursday; a week in progress resolves to the last trading day already past;
   the answer is never a Saturday or Sunday.
6. **Static inventory.** A report route that omits `business_date` fails the
   suite, so "all four, no exceptions" cannot decay back into exceptions.
7. **Cross-repo contract**, in `crates/cct`: one case per row of the
   provenance-follows-timezone table, plus both deploy orders — including the
   combination revision 2 assumed away, a skill comparing in ET against a worker
   still serving UTC.

Wired into `npm run verify`. `npm run typecheck` must stay clean.

## Decisions taken

1. **Additive, not a replacement.** `date` and `scheduled_date` stay inside `data`
   unchanged, so the dashboard and the deployed skill keep working. Removal is a
   later decision.
2. **No D1 migration.** Storage already records the business date; renaming live
   columns is risk without payoff. Unification happens at the envelope.
3. **All four reports, no exceptions.**
4. **`business_date`**, not `trading_date` or `session_date`.
5. **`metadata`, not top level** — §2.
6. **P1 and P2 shipped first**, as their own changes with their own tests. They
   are independently correct fixes and did not depend on the envelope work.

## Out of scope

- **Renaming the D1 columns** — decision 2.
- **Removing `date` / `scheduled_date` from `data`** — decision 1.
- **Deleting the redundant `getESTDateString` / `getTodayInZone` and the two
  clashing `getCurrentTimeET` exports.** Recorded so they are not rediscovered as
  a mystery; consolidating them touches the writer path and the dashboard.
- **The remaining `toISOString().split('T')[0]` sites** — cache keys, chart
  ranges, API query windows — where a UTC day is harmless. The write-path sites
  that key a business day are **no longer** in this list; see P2.
- **`normalizeToETDate` in `d1-job-storage.ts`**, which shifts a date-only string
  back one day (verified: `"2026-08-06"` → `"2026-08-05"`). Its only writer,
  `updateD1JobStatus`, has no callers, so `getD1JobStatus`
  (`handlers/briefing-handlers.ts:119`) reads a `scheduled_date` live code never
  writes. Dead path, separate cleanup.

## What the earlier revisions got wrong

Kept because it is the same failure the design addresses: stating a date rule
without checking the code that would implement it.

**Revision 1** — put `business_date` at the top level without noticing the
envelope comes from a factory shared with every route; defined weekly's value as
"the last trading day of the window" when the only date to hand, `week_end`, is
always a Sunday; omitted that the comparison timezone must follow the field read,
so a skill-first deploy would have broken in the reverse direction; and counted
three ET implementations where there are four.

**Revision 2** — named only `freshness.rs` as the consumer change, missing that
`api.rs` discards the envelope entirely, so **no** envelope field could have
reached the skill; declared the weekly business date definable when the weekly
window itself is wrong on Mondays and Tuesdays (P1); dismissed the write-path UTC
sites as unproven when `jobs-routes.ts:834` keys a business day in UTC against
its own comment (P2); and left "from the row" versus "the day looked for"
readable as a contradiction on the stale-hit path.
