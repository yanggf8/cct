// Guard: every cache-hit route must serve the payload it stored, under `data`.
//
// The bug this exists for, 2026-08-04 (387f62a) to 2026-08-06: that commit
// moved every cache-hit site in report-routes/data-routes to
// `ApiResponseFactory.cached(cached.data, ...)` in one sweep. Four of the five
// sites hold the RAW `CacheAwareResult` from `dal.read()`, so `.data` was
// exactly right for them. The pre-market site had already unwrapped one line
// above, so `.data` was `undefined` — and `JSON.stringify` drops undefined
// fields, so the route answered 200 with `success: true` and no `data` key at
// all, for the full 3600s TTL, every hour of every day.
//
// Nothing caught it: status 200, `success: true`, DO cache healthy, D1 holding
// the real report the whole time. The consumer (the nullclaw `cct` skill)
// reported `contract_degraded` with an empty stderr.
//
// So the invariant is stated over five sites, not just the one that broke. The
// same mechanical sweep is just as likely to run the other way — someone
// "fixing" daily/weekly/symbols/history to match pre-market would reopen
// precisely what 387f62a closed. One rule, both directions:
//
//     a cache hit returns, under `data`, the object that was stored.
//
// Those five are driven end to end: the tests call the real dispatchers against
// a stubbed Durable Object, so the assertions land on the serialized wire
// response — the only place the defect was ever visible.
//
// Five is NOT all of them. `ApiResponseFactory.cached(...)` has 16 call sites
// across src/routes, and the eleven in sentiment/technical/backtesting/
// market-drivers need stubs this file does not build. Leaving them unguarded
// would miss the point, because the thing that caused this was a sweep across
// ALL of them at once. So the last two sections below hold the whole set
// statically: an inventory that fails when any call site is added or changes
// shape, and a check for the exact double-unwrap that 387f62a introduced.
//
// esbuild rather than Node's type stripping: the import graph reaches
// `market-drivers.ts`, whose decorators `--experimental-transform-types` cannot
// parse. Bundles go to the OS temp dir, not the repo, so no-artifacts stays green.
//
// Run: npm run test:cache-hit-contract

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'cct-test-'));

function bundled(relSource) {
  const outfile = join(outDir, relSource.replace(/[/\\]/g, '_') + '.mjs');
  execFileSync(
    join(repo, 'node_modules/.bin/esbuild'),
    [join(repo, relSource), '--bundle', '--format=esm', '--platform=neutral', `--outfile=${outfile}`],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  return import(outfile);
}

const { handleReportRoutes, handlePreMarketReport } = await bundled('src/routes/report-routes.ts');
const { handleDataRoutes } = await bundled('src/routes/data-routes.ts');

/** A briefing in the shape all three writers of `pre_market_report_<date>` store. */
function briefing(overrides = {}) {
  return {
    type: 'pre_market_briefing',
    timestamp: '2026-08-06T12:00:00.000Z',
    market_status: 'pre_market',
    date: '2026-08-06',
    is_stale: false,
    key_insights: ['Pre-market analysis complete'],
    high_confidence_signals: [{ symbol: 'MSFT', sentiment: 'bullish', confidence: 0.95 }],
    all_signals: [{ symbol: 'MSFT', sentiment: 'bullish', confidence: 0.95 }],
    data_source: 'd1_snapshot',
    symbols_analyzed: 4,
    ...overrides,
  };
}

/** A DO namespace stub that serves `stored` for every get and swallows writes. */
function envWith(stored) {
  const stub = {
    fetch: async (url) => {
      const action = new URL(url).pathname.slice(1);
      const body = action === 'get' ? { value: stored } : { ok: true };
      return { json: async () => body };
    },
  };
  return {
    ENVIRONMENT: 'test',
    FEATURE_FLAG_DO_CACHE: 'true',
    CACHE_DO: { idFromName: () => 'id', get: () => stub },
  };
}

async function callRoute(dispatcher, path, stored, query = '') {
  const request = new Request(`https://do${path}${query}`);
  const res = await dispatcher(request, envWith(stored), path, {});
  return JSON.parse(await res.text());
}

const reports = (path, stored, query) => callRoute(handleReportRoutes, path, stored, query);
const data = (path, stored, query) => callRoute(handleDataRoutes, path, stored, query);

let failed = 0;
const check = (name, fn) =>
  fn().then(
    () => console.log(`  ok   ${name}`),
    (e) => {
      console.log(`  FAIL ${name}\n       ${e.message}`);
      failed++;
    }
  );

// ── The invariant, across every cache-hit site ───────────────────────────────
//
// `unwrapped: true` marks the one site that unwraps `dal.read()` into a local
// before responding. That difference is the whole bug, and it is a property of
// the route, not of the payload — which is why the expectation below is the
// same for all five.

const SITES = [
  {
    name: 'pre-market',
    unwrapped: true,
    call: (stored) => reports('/api/v1/reports/pre-market', stored),
    stored: briefing(),
  },
  {
    name: 'daily',
    call: (stored) => reports('/api/v1/reports/daily/2026-08-06', stored),
    stored: { marker: 'daily-report', date: '2026-08-06', signals: [{ symbol: 'AAPL' }] },
  },
  {
    name: 'weekly',
    call: (stored) => reports('/api/v1/reports/weekly/2026-W32', stored),
    stored: { marker: 'weekly-report', week: '2026-W32', weekly_overview: { sentiment_trend: 'bullish' } },
  },
  {
    name: 'data/symbols',
    call: (stored) => data('/api/v1/data/symbols', stored),
    stored: { marker: 'symbols', symbols: ['AAPL', 'MSFT'] },
  },
  {
    name: 'data/history',
    call: (stored) => data('/api/v1/data/history/AAPL', stored),
    stored: { marker: 'history', symbol: 'AAPL', priceHistory: [1, 2, 3] },
  },
];

for (const site of SITES) {
  await check(`${site.name}: a cache hit returns the stored object under \`data\``, async () => {
    const body = await site.call(site.stored);
    // Stated as two assertions on purpose. The regression made the key VANISH,
    // so "data is missing" and "data is wrong" are different failures and the
    // message should say which one happened.
    assert.ok('data' in body, 'response carries no `data` key at all');
    assert.deepEqual(body.data, site.stored);
  });

  await check(`${site.name}: a cache hit still declares itself cached`, async () => {
    const body = await site.call(site.stored);
    assert.equal(body.success, true);
    assert.equal(body.cached, true);
    assert.equal(body.metadata.cacheStatus, 'hit');
  });
}

// ── Pre-market's own validity gate ───────────────────────────────────────────
//
// Only this route inspects the cached object before serving it, because only
// this route's cache can be warmed by three different writers.

await check('pre-market: the hit is reported as a do_cache hit', async () => {
  const body = await reports('/api/v1/reports/pre-market', briefing());
  assert.equal(body.metadata.source, 'do_cache');
});

// Each of these asserts the POSITIVE outcome, not merely "not a cache hit".
// `notEqual(source, 'do_cache')` would also pass on a 500, on a response with
// no metadata, and on any unrelated failure — it cannot tell "the gate rejected
// the entry and the route fell through cleanly" from "the route blew up".
// With no D1 bound in the stub env, a clean fall-through lands on the empty
// response, so `source: 'empty'` is the thing worth pinning.
const fellThrough = (body) => {
  assert.equal(body?.metadata?.source, 'empty', `expected a clean fall-through, got: ${JSON.stringify(body?.metadata)}`);
  assert.equal(body.success, true);
  assert.notEqual(body.cached, true);
};

await check('pre-market: an entry with no all_signals is not served', async () => {
  // A truncated or poisoned entry that still carries the right `type` would
  // otherwise be served for the full hour. Falling through re-warms it from D1.
  const { all_signals, ...truncated } = briefing();
  fellThrough(await reports('/api/v1/reports/pre-market', truncated));
});

await check('pre-market: an entry carrying an error is not served', async () => {
  fellThrough(await reports('/api/v1/reports/pre-market', briefing({ error: 'upstream failed' })));
});

await check('pre-market: an entry of the wrong type is not served', async () => {
  fellThrough(await reports('/api/v1/reports/pre-market', briefing({ type: 'intraday_check' })));
});

await check('pre-market: a bypass request never reads the cache', async () => {
  fellThrough(await reports('/api/v1/reports/pre-market', briefing(), '?bypass=true'));
});

await check('pre-market: the served briefing keeps the signals a reader acts on', async () => {
  const body = await reports('/api/v1/reports/pre-market', briefing());
  assert.ok(Array.isArray(body.data.high_confidence_signals));
  assert.equal(body.data.high_confidence_signals[0].symbol, 'MSFT');
  assert.equal(body.data.symbols_analyzed, 4);
});

// ── The other eleven call sites, held statically ─────────────────────────────
//
// Driving sentiment/technical/backtesting/market-drivers would need stubs this
// file does not build. But the failure mode was never "one route is wrong" — it
// was one edit applied to every route at once, and the four sites above are the
// only ones that would have caught it. These two checks cover the rest.

const ROUTES_DIR = join(repo, 'src/routes');
const CACHED_CALL = /ApiResponseFactory\.cached\(\s*([A-Za-z0-9_.?[\]]+)\s*,/;

function callSites() {
  const sites = [];
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts')).sort()) {
    const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
    source.split('\n').forEach((line, i) => {
      const m = line.match(CACHED_CALL);
      if (m) sites.push({ file, line: i + 1, arg: m[1] });
    });
  }
  return sites;
}

// Keyed by file and argument EXPRESSION, counted — not by line number, which
// shifts on any edit above and would cry wolf. Adding a site, deleting one, or
// changing what a site passes all move a count.
//
// Two shapes are correct here, and which one a site needs depends on what its
// local variable holds:
//
//   `<v>.data`  — `<v>` is the raw CacheAwareResult straight from dal.read()
//   `<v>`       — `<v>` was already unwrapped out of that result
//
// pre-market is the only site of the second kind, which is exactly why the
// blanket `.data` sweep broke it and nothing else.
const EXPECTED_SITES = {
  'backtesting-routes.ts': { 'cached.data': 1, 'wfCached.data': 1, 'mcCached.data': 1 },
  'data-routes.ts': { 'cached.data': 2 },
  'market-drivers-routes.ts': { 'cachedResult.data': 1 },
  'report-routes.ts': { 'cached.data': 2, cached: 1 },
  'sentiment-routes.ts': { 'cached.data': 6 },
  'technical-routes.ts': { 'cached.data': 1 },
};

await check('the cache-hit call-site inventory is unchanged', async () => {
  const actual = {};
  for (const { file, arg } of callSites()) {
    actual[file] ??= {};
    actual[file][arg] = (actual[file][arg] ?? 0) + 1;
  }
  assert.deepEqual(
    actual,
    EXPECTED_SITES,
    'A cache-hit call site was added, removed, or changed what it passes.\n' +
      '       Decide which shape it holds — raw CacheAwareResult needs `.data`,\n' +
      '       an already-unwrapped value must be passed bare — then update\n' +
      '       EXPECTED_SITES. Do not update it without making that decision:\n' +
      '       skipping it is what shipped 387f62a.'
  );
});

await check('no cache-hit site double-unwraps its DAL result', async () => {
  // The 387f62a shape, stated directly and searched for everywhere:
  //   const x = <result>.success ? <result>.data : null;   // unwrapped
  //   ApiResponseFactory.cached(x.data, ...)               // unwrapped again
  // The second `.data` is always undefined, and JSON.stringify deletes the key.
  const UNWRAP = /(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*[A-Za-z0-9_]+\.success\s*\?\s*[A-Za-z0-9_]+\.data\s*:/;
  const offenders = [];

  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts')).sort()) {
    const lines = readFileSync(join(ROUTES_DIR, file), 'utf8').split('\n');
    const unwrapped = new Set();
    lines.forEach((line, i) => {
      const u = line.match(UNWRAP);
      if (u) unwrapped.add(u[1]);
      const c = line.match(CACHED_CALL);
      if (c && unwrapped.has(c[1].replace(/\.data$/, '')) && c[1].endsWith('.data')) {
        offenders.push(`${file}:${i + 1} passes \`${c[1]}\` — already unwrapped above`);
      }
    });
  }

  assert.deepEqual(offenders, [], `double-unwrapped cache-hit response:\n       ${offenders.join('\n       ')}`);
});

console.log(failed === 0 ? '\nPASS' : `\nFAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
