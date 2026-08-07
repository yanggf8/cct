# Business Date Envelope — Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `metadata.business_date` and `metadata.has_content` on every report response of the cct worker, so no consumer ever re-derives which trading day a report is about.

**Architecture:** A single helper in `report-routes.ts` produces both fields; every response site spreads it into the metadata object it already passes to `ApiResponseFactory`. The value always comes from the row that supplied the content — never from the clock — and on a miss it is the day that was looked for, paired with `has_content: false`. No change to the shared response factory: `metadata` is already a per-call-site `Record<string, any>`.

**Tech Stack:** TypeScript on Cloudflare Workers, D1, Durable Objects. Tests are plain Node ESM under `tests/validation/`, bundled through esbuild, run via `npm run verify`.

**Source spec:** `docs/specs/2026-08-07-business-date-envelope-design.md`. Both of its prerequisites already shipped (1d3ed29, 87cda45).

**Scope:** Worker only. The Rust consumer in `~/a/claw-skills/crates/cct` is a separate plan — the spec's deploy-ordering analysis makes the two independently shippable in either order.

## Global Constraints

- The trading day is the **ET** date, derived in ET directly via `getCurrentDateET()` from `modules/trading-calendar.ts`. Never `new Date().toISOString().split('T')[0]`, never a `toLocaleString` → `new Date` → `toISOString` round trip, never `someIsoTimestamp.slice(0, 10)`.
- `business_date` format is `YYYY-MM-DD`.
- **When `has_content` is `true`, `business_date` is the date of the row that supplied the content, never the day of the request.** When `has_content` is `false`, it is the trading day that was looked for.
- Additive only: `data.date` and `data.scheduled_date` keep their current values. Nothing inside `data` changes in this plan.
- `ApiResponseFactory` (`src/modules/api-v1-responses.ts`) is shared by every route in the worker. Do not change its signature.
- Error responses are outside the contract — `ApiResponseFactory.error` carries no metadata, and a request that cannot be answered has no business date.
- `npm run typecheck` must stay clean. A pre-commit hook runs it.
- Never fabricate financial numbers or add fallback values (repo rule, CLAUDE.md).

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/routes/report-routes.ts` | The five report routes and the new `businessDateMeta` helper | Modify |
| `src/modules/trading-calendar.ts` | Market calendar; gains `lastTradingDayOfWeek` | Modify |
| `tests/validation/test-business-date-envelope.mjs` | The envelope contract, driven end to end | Create |
| `package.json` | `test:business-date-envelope` script, wired into `verify` | Modify |

---

### Task 1: The helper, and end-of-day — the route the incident came from

**Files:**
- Modify: `src/routes/report-routes.ts` (add helper after `marketToday`, line ~78; sites at `:1302`, `:1324`, `:1361`)
- Create: `tests/validation/test-business-date-envelope.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `businessDateMeta(businessDate: string, hasContent: boolean): { business_date: string; has_content: boolean }` — module-private to `report-routes.ts`, used by every later task.

- [ ] **Step 1: Write the failing test**

Create `tests/validation/test-business-date-envelope.mjs`. The harness mirrors `test-cache-hit-contract.mjs`, which bundles through esbuild because the import graph reaches decorators that Node's type stripping cannot parse.

```js
// Guard: every report response states which trading day it is about.
//
// Reports used to publish that day under three different names inside `data`
// (`date`, `scheduled_date`, or nothing), and the end-of-day placeholder
// published the day of the *request* as though it were the day of the analysis.
// A consumer could not tell "no data for this day" from "here is this day".
//
// Run: npm run test:business-date-envelope

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'cct-bd-'));

function bundled(relSource) {
  const outfile = join(outDir, relSource.replace(/[/\\]/g, '_') + '.mjs');
  execFileSync(
    join(repo, 'node_modules/.bin/esbuild'),
    [join(repo, relSource), '--bundle', '--format=esm', '--platform=neutral', `--outfile=${outfile}`],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  return import(outfile);
}

const { handleReportRoutes } = await bundled('src/routes/report-routes.ts');

/** A DO namespace stub that serves `stored` for every get and swallows writes. */
function envWith(stored) {
  const stub = {
    fetch: async (url) => {
      const action = new URL(url).pathname.slice(1);
      return { json: async () => (action === 'get' ? { value: stored } : { ok: true }) };
    },
  };
  return {
    ENVIRONMENT: 'test',
    FEATURE_FLAG_DO_CACHE: 'true',
    CACHE_DO: { idFromName: () => 'id', get: () => stub },
  };
}

async function reports(path, stored = null, query = '') {
  const request = new Request(`https://do${path}${query}`);
  const res = await handleReportRoutes(request, envWith(stored), path, {});
  return JSON.parse(await res.text());
}

let failed = 0;
const check = (name, fn) =>
  fn().then(
    () => console.log(`  ok   ${name}`),
    (e) => {
      console.log(`  FAIL ${name}\n       ${e.message}`);
      failed++;
    }
  );

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── end-of-day ───────────────────────────────────────────────────────────────
//
// With no D1 binding on the stub env, the route takes its miss path and
// synthesises the placeholder. That is the exact response that alerted as
// `contract_degraded` with no way to tell it from a real report.

await check('end-of-day: a miss states the day it looked for, and says it found nothing', async () => {
  const body = await reports('/api/v1/reports/end-of-day');
  assert.match(body.metadata.business_date, DATE, 'business_date must be YYYY-MM-DD');
  assert.equal(body.metadata.has_content, false, 'a synthesised placeholder is not content');
});

await check('end-of-day: the placeholder does not claim content by carrying a date alone', async () => {
  const body = await reports('/api/v1/reports/end-of-day');
  // The old payload announced `data.date` with full confidence on a miss. The
  // envelope has to disagree with it, or nothing has been fixed.
  assert.equal(body.metadata.has_content, false);
  assert.ok('business_date' in body.metadata, 'the day looked for is still stated');
});

process.exit(failed === 0 ? 0 : 1);
```

Add the script:

```json
"test:business-date-envelope": "node tests/validation/test-business-date-envelope.mjs"
```

and extend `verify` by inserting ` && npm run test:business-date-envelope` immediately after `npm run test:business-date-sources`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:business-date-envelope`
Expected: FAIL — `Cannot read properties of undefined (reading 'business_date')` or `business_date must be YYYY-MM-DD`, because `metadata` has no such key yet.

- [ ] **Step 3: Add the helper**

In `src/routes/report-routes.ts`, immediately after the `marketToday()` function (~line 78):

```ts
/**
 * The two provenance fields every report envelope carries.
 *
 * `business_date` is the identity of the content — the ET trading day it is
 * about — and `has_content` says whether any content was found for it. They are
 * a pair because either alone is ambiguous: a date with no content reads as a
 * report about that day, which is how a dead pipeline looked healthy for 50
 * days, and content with no date leaves every consumer to re-derive the day.
 *
 * `businessDate` must come from the row that supplied the content. Passing
 * today's date on a hit would relabel a stale snapshot as current, which is the
 * failure this field exists to remove. On a miss, today's date is correct: it is
 * the day that was looked for, and `hasContent: false` says so.
 */
function businessDateMeta(businessDate: string, hasContent: boolean): { business_date: string; has_content: boolean } {
  return { business_date: businessDate, has_content: hasContent };
}
```

- [ ] **Step 4: Apply it to the three end-of-day sites**

At `:1302` (run-id snapshot), inside the metadata object passed to `ApiResponseFactory.success(runSnapshot.data, { … })`, add as the first entry:

```ts
            ...businessDateMeta(runSnapshot.scheduledDate, true),
```

At `:1324` (`ApiResponseFactory.success(d1Result.data, { … })`) add as the first entry:

```ts
            ...businessDateMeta(d1Result.sourceDate, true),
```

`getD1FallbackData` already returns `sourceDate` — the row's own date, which is exactly the field required and is *not* the requested day when the answer came from a fallback.

At `:1361` (the placeholder) add as the first entry:

```ts
          ...businessDateMeta(today, false),
```

`today` here is `marketToday()`, assigned at `:1315`.

- [ ] **Step 5: Run tests**

Run: `npm run test:business-date-envelope`
Expected: both checks `ok`.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/routes/report-routes.ts tests/validation/test-business-date-envelope.mjs package.json
git commit -m "feat(reports): end-of-day states which trading day it is about

The placeholder the route synthesises on a miss announced `data.date` with the
same confidence a real report does, so \"no data for this day\" and \"here is this
day\" arrived in the same shape. metadata.business_date now carries the day, and
has_content says whether anything was found for it.

On a hit the date comes from the row — getD1FallbackData already returns
sourceDate — never from the clock, so a fallback answer cannot be relabelled as
current."
```

---

### Task 2: Pre-market, including the stale-hit trap

**Files:**
- Modify: `src/routes/report-routes.ts` (sites at `:736`, `:777`, `:1030`, `:1058`)
- Modify: `tests/validation/test-business-date-envelope.mjs`

**Interfaces:**
- Consumes: `businessDateMeta` from Task 1.

- [ ] **Step 1: Write the failing test**

Append to `tests/validation/test-business-date-envelope.mjs`, before the `process.exit` line:

```js
// ── pre-market ───────────────────────────────────────────────────────────────

/** A briefing in the shape all three writers of `pre_market_report_<date>` store. */
function briefing(overrides = {}) {
  return {
    type: 'pre_market_briefing',
    timestamp: '2026-08-05T12:00:00.000Z',
    market_status: 'pre_market',
    date: '2026-08-05',
    is_stale: false,
    key_insights: ['Pre-market analysis complete'],
    high_confidence_signals: [{ symbol: 'MSFT', sentiment: 'bullish', confidence: 0.95 }],
    all_signals: [{ symbol: 'MSFT', sentiment: 'bullish', confidence: 0.95 }],
    data_source: 'd1_snapshot',
    symbols_analyzed: 4,
    ...overrides,
  };
}

await check('pre-market: a cache hit reports the day the content is about', async () => {
  // The trap. The cache key is built from today, but the payload inside it
  // describes 2026-08-05. Labelling the envelope with today would tell a
  // consumer that a day-old briefing is current — the precise relabelling this
  // field exists to prevent.
  const body = await reports('/api/v1/reports/pre-market', briefing());
  assert.equal(body.metadata.business_date, '2026-08-05');
  assert.equal(body.metadata.has_content, true);
});

await check('pre-market: a miss states the day it looked for and finds nothing', async () => {
  const body = await reports('/api/v1/reports/pre-market', null);
  assert.match(body.metadata.business_date, DATE);
  assert.equal(body.metadata.has_content, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:business-date-envelope`
Expected: the two end-of-day checks pass; both new pre-market checks FAIL on `undefined`.

- [ ] **Step 3: Apply the helper to the four pre-market sites**

At `:736` — `ApiResponseFactory.success(runSnapshot.data, { … })` — add as the first metadata entry:

```ts
              ...businessDateMeta(runSnapshot.scheduledDate, true),
```

At `:777` — `ApiResponseFactory.cached(cached, 'hit', { … })` — add as the first metadata entry:

```ts
              ...businessDateMeta((cached as any)?.date ?? today, true),
```

The cached object is the briefing itself, which carries its own `date`. Falling back to `today` covers a cache entry written before this field existed; it never silently relabels, because a briefing without a date cannot be shown to be stale either way.

At `:1030` — `ApiResponseFactory.success(response, { source: 'd1_fallback', … })` — add as the first metadata entry:

```ts
            ...businessDateMeta(sourceDate, true),
```

`sourceDate` is in scope here; it is the date of the D1 row, and it differs from `today` exactly when `isStale` is true.

At `:1058` — `ApiResponseFactory.success(emptyResponse, { source: 'empty', … })` — add as the first metadata entry:

```ts
          ...businessDateMeta(today, false),
```

- [ ] **Step 4: Run tests**

Run: `npm run test:business-date-envelope`
Expected: four checks `ok`.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/routes/report-routes.ts tests/validation/test-business-date-envelope.mjs
git commit -m "feat(reports): pre-market states the day its content is about

Four response sites, and the interesting one is the cache hit: the key is built
from today but the briefing inside it may describe an earlier day, so the
envelope takes the date from the payload, not from the clock. The D1 fallback
takes sourceDate for the same reason — it differs from today exactly when the
answer is stale, which is when mislabelling would do the most damage."
```

---

### Task 3: Intraday

**Files:**
- Modify: `src/routes/report-routes.ts` (sites at `:1122`, `:1249`)
- Modify: `tests/validation/test-business-date-envelope.mjs`

**Interfaces:**
- Consumes: `businessDateMeta` from Task 1.

- [ ] **Step 1: Write the failing test**

Append before `process.exit`:

This route **refuses without a D1 binding** — it answers a 500 "Database not available" before reaching any report branch — so the harness needs a D1 stub before these cases test anything. Extend `envWith(stored)` to `envWith(stored, db)` and add:

```js
function d1With(rows = {}) {
  const answer = (sql) => {
    for (const [needle, row] of Object.entries(rows)) if (sql.includes(needle)) return row;
    return null;
  };
  return {
    prepare: (sql) => ({
      bind: () => ({ first: async () => answer(sql), all: async () => ({ results: [] }), run: async () => ({ success: true }) }),
      first: async () => answer(sql),
      all: async () => ({ results: [] }),
    }),
  };
}
```

Then the three cases — and the first is the one that catches the wrong predicate, so its fixture deliberately omits `total_symbols`:

```js
// ── intraday ─────────────────────────────────────────────────────────────────

await check('intraday: real content is content, whatever fields it happens to carry', async () => {
  const content = {
    type: 'intraday_check',
    scheduled_date: '2026-08-06',
    symbols: [{ symbol: 'AAPL', status: 'on_track' }],
    symbols_analyzed: 1,
    overall_accuracy: 0.8,
  };
  const body = await reports('/api/v1/reports/intraday', null, '?date=2026-08-06', d1With({
    scheduled_job_results: { report_content: JSON.stringify(content), created_at: '2026-08-06T16:00:00Z' },
  }));
  assert.equal(body.metadata.business_date, '2026-08-06');
  assert.equal(body.metadata.has_content, true, 'a stored snapshot is content');
});

await check('intraday: a miss states the scheduled day and finds nothing', async () => {
  const body = await reports('/api/v1/reports/intraday', null, '', d1With());
  assert.match(body.metadata.business_date, DATE);
  assert.equal(body.metadata.has_content, false);
});

await check('intraday: an explicit ?date is the day reported on', async () => {
  const body = await reports('/api/v1/reports/intraday', null, '?date=2026-08-04', d1With());
  assert.equal(body.metadata.business_date, '2026-08-04');
  assert.equal(body.metadata.has_content, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:business-date-envelope`
Expected: the four earlier checks pass; both intraday checks FAIL on `undefined`.

- [ ] **Step 3: Apply the helper**

At `:1122` — `ApiResponseFactory.success(runSnapshot.data, { … })` — add as the first metadata entry:

```ts
              ...businessDateMeta(runSnapshot.scheduledDate, true),
```

At the single exit shared by the content and no-content branches, add as the first metadata entry:

```ts
          ...businessDateMeta(scheduledDate, hasContent),
```

declaring `hasContent` beside `response` and setting it where the content is assigned:

```ts
    let response;
    let hasContent = false;
    let source: string = snapshot ? 'd1' : 'empty';
```

```ts
      response = content;
      hasContent = true;
```

**Corrected during execution.** This step first read `(response as any).total_symbols > 0`. The content branch assigns `response = content` — the stored snapshot verbatim — so the payload's field names are the pipeline's, not this route's, and `total_symbols` is set by the *empty* shape while a real one need not carry it. That predicate would have marked genuine intraday reports as `has_content: false`, which is the failure this field exists to remove, arriving through the field itself. Deriving the flag from the branch that assigns the content cannot drift, because it is set in exactly one place.

`scheduledDate` is `dateParam ?? today`, so an explicit `?date` is honoured.

- [ ] **Step 4: Run tests**

Run: `npm run test:business-date-envelope`
Expected: six checks `ok`.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/routes/report-routes.ts tests/validation/test-business-date-envelope.mjs
git commit -m "feat(reports): intraday states the day it reports on

Both branches leave through one response site, so has_content is derived from
the payload's own total_symbols rather than from a flag set in two places that
could drift apart."
```

---

### Task 4: Weekly, and the last trading day of a week

**Files:**
- Modify: `src/modules/trading-calendar.ts` (append `lastTradingDayOfWeek`)
- Modify: `src/routes/report-routes.ts` (sites at `:474`, `:675`)
- Modify: `tests/validation/test-week-round-trip.mjs`
- Modify: `tests/validation/test-business-date-envelope.mjs`

**Interfaces:**
- Consumes: `businessDateMeta` (Task 1), `getWeekStartDate` and `isTradingDay` (already exported from `trading-calendar.ts`).
- Produces: `lastTradingDayOfWeek(weekKey: string, notAfter?: string): string | null` — exported from `trading-calendar.ts`.

- [ ] **Step 1: Write the failing unit test**

Append to `tests/validation/test-week-round-trip.mjs`, before the final `console.log`, and extend the import on line 24 to `import { getWeekString, getWeekStartDate, lastTradingDayOfWeek } from '../../src/modules/trading-calendar.ts';`

```js
// --- the last trading day a week actually contains -----------------------------
//
// A weekly review is about a week, but the envelope states a day, so the day has
// to be the last session the week actually held. Three traps: the week's last
// calendar day is a Sunday and never a session; a holiday Friday moves the
// answer to Thursday; and a week still in progress has no sessions yet for the
// days that have not happened.

{
  // 2026-08-03..09. Friday the 7th is a normal session.
  assert.equal(lastTradingDayOfWeek('2026-W32'), '2026-08-07');

  // Never a weekend, for any week of the year.
  for (let w = 1; w <= 52; w++) {
    const key = `2026-W${String(w).padStart(2, '0')}`;
    const day = lastTradingDayOfWeek(key);
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    assert.ok(dow >= 1 && dow <= 5, `${key} resolved to weekday ${dow} (${day})`);
  }

  // A week in progress stops at the last session that has already happened.
  assert.equal(lastTradingDayOfWeek('2026-W32', '2026-08-05'), '2026-08-05');
  assert.equal(lastTradingDayOfWeek('2026-W32', '2026-08-06'), '2026-08-06');

  // `notAfter` before the week opens leaves no session in range.
  assert.equal(lastTradingDayOfWeek('2026-W32', '2026-07-30'), null);

  // A holiday Friday hands the week to Thursday. 2026-12-25 is Christmas Day,
  // a Friday, and an NYSE holiday.
  assert.equal(lastTradingDayOfWeek(getWeekString(new Date('2026-12-25T12:00:00Z'))), '2026-12-24');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:week-round-trip`
Expected: FAIL — `does not provide an export named 'lastTradingDayOfWeek'`.

- [ ] **Step 3: Implement it**

Append to `src/modules/trading-calendar.ts`:

```ts
/**
 * The last NYSE session within an ISO week, or `null` if the week holds none.
 *
 * A weekly review covers a week but the envelope states a day, so the day has to
 * be the last session the week actually held — not `week_end`, which is always a
 * Sunday, and not "the Friday", which is wrong whenever the Friday is a holiday.
 *
 * `notAfter` (YYYY-MM-DD) clamps the search, so a week still in progress reports
 * the last session that has already happened rather than one in the future.
 */
export function lastTradingDayOfWeek(weekKey: string, notAfter?: string): string | null {
  const [isoYear, week] = weekKey.split('-W').map(Number);
  const monday = getWeekStartDate(isoYear, week);
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(monday.getTime() + offset * DAY_MS).toISOString().split('T')[0];
    if (notAfter && day > notAfter) continue;
    if (isTradingDay(day)) return day;
  }
  return null;
}
```

`toISOString()` on a Date built from `getWeekStartDate` is safe here: that function returns UTC midnight and the offsets are whole days, so no timezone conversion is involved — this is date arithmetic on an already-chosen day, not a business date being derived from a clock.

- [ ] **Step 4: Run the unit test**

Run: `npm run test:week-round-trip`
Expected: `week round trip: OK`.

- [ ] **Step 5: Write the failing envelope test**

Append to `tests/validation/test-business-date-envelope.mjs`, before `process.exit`:

```js
// ── weekly ───────────────────────────────────────────────────────────────────

await check('weekly: the day stated is the last session of the week, not its Sunday', async () => {
  const body = await reports('/api/v1/reports/weekly/2026-W32', {
    marker: 'weekly-report',
    week: '2026-W32',
    weekly_overview: { sentiment_trend: 'bullish' },
  });
  assert.equal(body.metadata.business_date, '2026-08-07');
  assert.equal(body.metadata.has_content, true);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test:business-date-envelope`
Expected: six checks pass, the weekly check FAILs on `undefined`.

- [ ] **Step 7: Apply the helper to the two weekly sites**

Add the import in `report-routes.ts` — extend the existing `trading-calendar.js` import block with `lastTradingDayOfWeek,`.

At `:474` — `ApiResponseFactory.cached(cached.data, 'hit', { … })` — add as the first metadata entry:

```ts
            ...businessDateMeta(lastTradingDayOfWeek(week, marketToday()) ?? week, true),
```

At `:675` — `ApiResponseFactory.success(response, { … })` — add as the first metadata entry:

```ts
          ...businessDateMeta(lastTradingDayOfWeek(week, marketToday()) ?? week, dailyReports.length > 0),
```

`dailyReports` is the array built at `:463`; empty means the window held no snapshots. Falling back to the week key when a week holds no session at all keeps the field present rather than absent, which the inventory check in Task 6 requires.

- [ ] **Step 8: Run tests**

Run: `npm run test:business-date-envelope && npm run test:week-round-trip && npm run typecheck`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/modules/trading-calendar.ts src/routes/report-routes.ts tests/validation/test-week-round-trip.mjs tests/validation/test-business-date-envelope.mjs
git commit -m "feat(reports): weekly states the last session its week held

A weekly review covers a week and the envelope states a day, so the day is the
last NYSE session inside the window — not week_end, which is always a Sunday,
and not \"the Friday\", which is wrong whenever the Friday is a holiday. A week
still in progress clamps to the last session that has already happened rather
than naming one in the future."
```

---

### Task 5: Daily

**Files:**
- Modify: `src/routes/report-routes.ts` (sites at `:263`, `:384`)
- Modify: `tests/validation/test-business-date-envelope.mjs`

**Interfaces:**
- Consumes: `businessDateMeta` from Task 1.

- [ ] **Step 1: Write the failing test**

Append before `process.exit`:

```js
// ── daily ────────────────────────────────────────────────────────────────────

await check('daily: the day in the path is the day reported on', async () => {
  const body = await reports('/api/v1/reports/daily/2026-08-06', {
    marker: 'daily-report',
    date: '2026-08-06',
    signals: [{ symbol: 'AAPL' }],
  });
  assert.equal(body.metadata.business_date, '2026-08-06');
  assert.equal(body.metadata.has_content, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:business-date-envelope`
Expected: seven checks pass, the daily check FAILs on `undefined`.

- [ ] **Step 3: Apply the helper**

`handleDailyReport` takes `date: string` as its first parameter, and the dispatcher passes `marketToday()` for the undated route (`:109`), so `date` is already the business date at both sites.

At `:263` — `ApiResponseFactory.cached(cached.data, 'hit', { … })` — add as the first metadata entry:

```ts
            ...businessDateMeta(date, true),
```

At `:384` — `ApiResponseFactory.success(response, { … })` — add as the first metadata entry:

```ts
          ...businessDateMeta(date, true),
```

- [ ] **Step 4: Run tests**

Run: `npm run test:business-date-envelope && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/routes/report-routes.ts tests/validation/test-business-date-envelope.mjs
git commit -m "feat(reports): daily states the day it reports on

The handler already receives the business date as a parameter — the dispatcher
passes marketToday() for the undated route — so both sites state it rather than
leaving the consumer to read it out of the payload."
```

---

### Task 6: The inventory, so a new route cannot ship without the field

**Files:**
- Modify: `tests/validation/test-business-date-envelope.mjs`

**Interfaces:**
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

Append before `process.exit`. This is the part that keeps "all reports, no exceptions" from decaying — the behavioural checks above only cover the routes someone remembered to add.

```js
// ── the inventory ────────────────────────────────────────────────────────────
//
// The checks above only cover routes someone remembered to write a case for.
// This one fails when a report response site is added without the field, which
// is how the three competing spellings inside `data` accumulated in the first
// place. Deliberately counted over source text: a new site is visible here
// before anyone has written a test that would exercise it.

{
  const src = readFileSync(repo + 'src/routes/report-routes.ts', 'utf8');
  const responseSites = (src.match(/ApiResponseFactory\.(success|cached)\(/g) ?? []).length;
  const tagged = (src.match(/businessDateMeta\(/g) ?? []).length - 1; // minus the definition

  await check('every report response site carries the business date', async () => {
    assert.equal(
      tagged,
      responseSites,
      `${responseSites} success/cached sites but ${tagged} call businessDateMeta — ` +
        'a report response without a business date is exactly the gap this field closes'
    );
  });
}
```

Add `import { readFileSync } from 'node:fs';` to the imports at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:business-date-envelope`
Expected: FAIL — `handleReportsStatus` at `:1397` has response sites that no task tagged, so the counts differ.

- [ ] **Step 3: Decide and record the one exclusion**

`/api/v1/reports/status` is navigation metadata: it returns a row per trading day, each already carrying its own date, so a single business date for the response is meaningless. Exclude it explicitly rather than by omission — an unexplained gap is what this check exists to prevent.

Replace the counting block with one that ignores that handler's body:

```js
{
  const src = readFileSync(repo + 'src/routes/report-routes.ts', 'utf8');
  // /api/v1/reports/status returns one row per trading day, each carrying its
  // own date, so a single business date for the whole response would be
  // meaningless. It is the one deliberate exclusion; everything else is in.
  const statusStart = src.indexOf('async function handleReportsStatus(');
  assert.ok(statusStart > 0, 'handleReportsStatus moved — revisit this exclusion');
  const inScope = src.slice(0, statusStart);
  const responseSites = (inScope.match(/ApiResponseFactory\.(success|cached)\(/g) ?? []).length;
  const tagged = (inScope.match(/businessDateMeta\(/g) ?? []).length - 1; // minus the definition

  await check('every report response site carries the business date', async () => {
    assert.equal(
      tagged,
      responseSites,
      `${responseSites} success/cached sites but ${tagged} call businessDateMeta — ` +
        'a report response without a business date is exactly the gap this field closes'
    );
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:business-date-envelope`
Expected: all checks `ok`, including the inventory.

Run: `npm run verify`
Expected: the full suite passes, including `test:cache-hit-contract`, `test:week-round-trip` and `test:business-date-sources`.

- [ ] **Step 5: Commit**

```bash
git add tests/validation/test-business-date-envelope.mjs
git commit -m "test(reports): a new report route cannot ship without a business date

The behavioural checks only cover routes someone remembered to write a case
for, which is how three competing spellings accumulated inside \`data\`. This
counts response sites against tagged ones over the source, so an untagged site
is visible before any test exercises it. /api/v1/reports/status is the one
deliberate exclusion, stated in the check rather than left as a silent gap."
```

---

## Self-Review

**Spec coverage.** §2 of the spec (the field, its rule, `metadata` placement, `has_content`) is Tasks 1–5. §3 (weekly's value) is Task 4. Testing items 3, 4 and 6 are Tasks 1–5 and Task 6 respectively; item 5 is Task 4's unit test. Spec testing item 4 — pinning the answer at `2026-08-07T00:16:14Z` — is already covered for the *source* of the date by `test:business-date-sources`, which freezes the clock and pins `getCurrentDateET`; the envelope tests inherit it and do not re-freeze. Spec testing item 7 and §4 (the consumer) are **not** in this plan: they are the separate claw-skills plan, as stated under Scope.

**Placeholders.** None: every step names exact files and line anchors, and every code step carries the code.

**Type consistency.** `businessDateMeta(businessDate: string, hasContent: boolean)` is used with that signature in Tasks 1–5. `lastTradingDayOfWeek(weekKey, notAfter?)` returns `string | null` and every call site handles the null with `?? week`. `getD1FallbackData().sourceDate`, `readD1ReportSnapshot().scheduledDate` and `handleDailyReport(date)` match the signatures in `d1-job-storage.ts:182` and `report-routes.ts:214`.

**Known risk to check during execution.** The line numbers above are from commit b95b8ba and shift as tasks land — each task adds one line per site. Locate sites by the surrounding `ApiResponseFactory` call and the metadata keys quoted, not by line number alone.
