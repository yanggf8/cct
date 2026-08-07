// Guard: every report response states which trading day it is about.
//
// Reports published that day under three different names inside `data` —
// `date` for pre-market, `scheduled_date` for intraday, nothing at all for a
// successful end-of-day — and the end-of-day placeholder published the day of
// the *request* as though it were the day of the analysis. A consumer could not
// tell "no data for this day" from "here is this day", which is how a dead
// pipeline looked healthy for 50 days (2026-06-08 to 07-27).
//
// `metadata.business_date` and `metadata.has_content` are that pair, stated on
// the envelope where every consumer can reach them without knowing which route
// it called. The rule they encode, and the one these tests exist to hold: with
// content, the date is the row's; without content, it is the day looked for.
// Never the day of the request when content was found.
//
// esbuild rather than Node's type stripping: the import graph reaches modules
// whose decorators `--experimental-transform-types` cannot parse. Bundles go to
// the OS temp dir, so no-artifacts stays green.
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
function envWith(stored, db = null) {
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
    ...(db ? { PREDICT_JOBS_DB: db } : {}),
  };
}

/**
 * A D1 stub that answers `.first()` from `rows`, keyed by a substring of the SQL.
 *
 * Routes that read D1 refuse outright without the binding — intraday answers a
 * 500 "Database not available" — so a test that omits it exercises the error
 * path while looking like it tested the report. The binding has to be present
 * and empty to reach a genuine miss.
 */
function d1With(rows = {}) {
  const answer = (sql) => {
    for (const [needle, row] of Object.entries(rows)) {
      if (sql.includes(needle)) return row;
    }
    return null;
  };
  return {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => answer(sql),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
      first: async () => answer(sql),
      all: async () => ({ results: [] }),
    }),
  };
}

async function reports(path, stored = null, query = '', db = null) {
  const request = new Request(`https://do${path}${query}`);
  const res = await handleReportRoutes(request, envWith(stored, db), path, {});
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
// `contract_degraded` with nothing to distinguish it from a real report.

await check('end-of-day: a miss states the day it looked for, and says it found nothing', async () => {
  const body = await reports('/api/v1/reports/end-of-day');
  assert.match(body.metadata.business_date, DATE, 'business_date must be YYYY-MM-DD');
  assert.equal(body.metadata.has_content, false, 'a synthesised placeholder is not content');
});

await check('end-of-day: the placeholder does not claim content by carrying a date alone', async () => {
  const body = await reports('/api/v1/reports/end-of-day');
  // The payload still announces `data.date` with full confidence on a miss —
  // that field is unchanged and consumers may still read it. The envelope has
  // to contradict it, or nothing has been fixed.
  assert.equal(body.data.date, body.metadata.business_date, 'the two must at least agree on the day');
  assert.equal(body.metadata.has_content, false, 'and the envelope must say the day is empty');
});

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
  // The trap this task exists for. The cache key is built from today, but the
  // briefing inside it describes 2026-08-05. Labelling the envelope with today
  // would tell a consumer that a day-old briefing is current — the precise
  // relabelling the field was added to prevent, and a mistake no test that
  // merely asserts `business_date` exists would ever catch.
  const body = await reports('/api/v1/reports/pre-market', briefing());
  assert.equal(body.metadata.business_date, '2026-08-05');
  assert.equal(body.metadata.has_content, true);
});

await check('pre-market: a miss states the day it looked for and finds nothing', async () => {
  const body = await reports('/api/v1/reports/pre-market', null);
  assert.match(body.metadata.business_date, DATE);
  assert.equal(body.metadata.has_content, false);
});


// ── intraday ─────────────────────────────────────────────────────────────────
//
// This route refuses without a D1 binding, so every case here supplies one —
// empty for a miss, populated for a hit. Reaching the 500 instead would have
// looked like a passing miss test while exercising nothing.

await check('intraday: real content is content, whatever fields it happens to carry', async () => {
  // The stored snapshot is returned verbatim, so the payload's field names are
  // the pipeline's, not this route's. An early draft of this task derived
  // has_content from `total_symbols`, which the empty shape sets and a real one
  // need not — that would have marked genuine reports as empty. The fixture
  // deliberately omits it.
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


// ── weekly ───────────────────────────────────────────────────────────────────

await check('weekly: the day stated is the last session of the week, not its Sunday', async () => {
  // `week_end` is week_start + 6, so it is a Sunday every time — the obvious
  // wrong answer, and one that reads plausibly right up until a consumer keys
  // anything on it. A finished week is used deliberately: the current week
  // clamps to whichever session has happened so far, which would make this
  // assertion change its own answer every day it runs.
  const body = await reports('/api/v1/reports/weekly/2026-W31', {
    marker: 'weekly-report',
    week: '2026-W31',
    weekly_overview: { sentiment_trend: 'bullish' },
  });
  assert.equal(body.metadata.business_date, '2026-07-31');
  assert.equal(body.metadata.has_content, true);
});

await check('weekly: a holiday Friday hands the week to Thursday', async () => {
  // 2026-12-25 is Christmas Day and a Friday. "Take the Friday" is wrong here in
  // a way only the NYSE calendar knows.
  const body = await reports('/api/v1/reports/weekly/2026-W52', {
    marker: 'weekly-report',
    week: '2026-W52',
    weekly_overview: { sentiment_trend: 'neutral' },
  });
  assert.equal(body.metadata.business_date, '2026-12-24');
});


// ── daily ────────────────────────────────────────────────────────────────────
//
// Daily has no placeholder: a date with no snapshot answers 404, which is
// outside the contract by design — a request that cannot be answered has no
// business date. So both remaining sites carry content, and the third case
// below pins the boundary rather than leaving it to be inferred.

/** A pre-market snapshot row in the shape `readD1ReportSnapshot` parses. */
function snapshotRow(date, content) {
  return {
    report_content: JSON.stringify(content),
    metadata: null,
    created_at: `${date}T12:00:00Z`,
    scheduled_date: date,
    run_id: null,
  };
}

await check('daily: a cache hit states the day in the path', async () => {
  const body = await reports('/api/v1/reports/daily/2026-08-06', {
    marker: 'daily-report',
    date: '2026-08-06',
    signals: [{ symbol: 'AAPL' }],
  });
  assert.equal(body.metadata.business_date, '2026-08-06');
  assert.equal(body.metadata.has_content, true);
});

await check('daily: a freshly built report states the day it was built for', async () => {
  // Cache misses, D1 answers. This is the site the cache-hit case never reaches.
  const body = await reports('/api/v1/reports/daily/2026-08-05', null, '', d1With({
    scheduled_job_results: snapshotRow('2026-08-05', {
      trading_signals: {
        AAPL: { symbol: 'AAPL', sentiment_layers: [{ sentiment: 'BULLISH', confidence: 0.8 }] },
      },
    }),
  }));
  assert.equal(body.metadata.business_date, '2026-08-05');
  assert.equal(body.metadata.has_content, true);
});

await check('daily: a date with no report is an error, and errors are outside the contract', async () => {
  const body = await reports('/api/v1/reports/daily/2026-08-05', null, '', d1With());
  assert.equal(body.success, false, 'no snapshot is a 404, not an empty report');
  assert.equal(body.metadata?.business_date, undefined, 'an unanswerable request has no business date');
});


process.exit(failed === 0 ? 0 : 1);
