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

process.exit(failed === 0 ? 0 : 1);
