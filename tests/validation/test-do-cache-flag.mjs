// Guard: FEATURE_FLAG_DO_CACHE is a working kill switch, not decoration.
//
// It was decoration until 2026-08-04. `createCacheInstance` tested only for
// the CACHE_DO binding, so every caller — the DAL, the sentiment and data
// routes, the request handler, batch operations — built a DO cache no matter
// what the flag said. The only reader of the flag was CacheAbstraction, which
// the report and data routes do not use.
//
// Run: node tests/validation/test-do-cache-flag.mjs   (needs Node >= 22.6 for
// type stripping; the repo is on 24.)

import assert from 'node:assert/strict';

const { createCacheInstance, isDOCacheEnabled } = await import(
  '../../src/modules/cache-do.ts'
);

// A DO stub only has to be present; nothing here calls through it.
const BINDING = { idFromName: () => 'id', get: () => ({ fetch: async () => ({}) }) };

const cases = [
  {
    name: 'flag "true" + binding -> cache',
    env: { FEATURE_FLAG_DO_CACHE: 'true', CACHE_DO: BINDING },
    expectCache: true,
  },
  {
    name: 'flag "false" + binding -> no cache (the kill switch)',
    env: { FEATURE_FLAG_DO_CACHE: 'false', CACHE_DO: BINDING },
    expectCache: false,
  },
  {
    // Named wrangler environments do not inherit top-level [vars], so an
    // unset flag is a real deployment state, not a hypothetical.
    name: 'flag unset + binding -> no cache',
    env: { CACHE_DO: BINDING },
    expectCache: false,
  },
  {
    name: 'flag "true" + no binding -> no cache',
    env: { FEATURE_FLAG_DO_CACHE: 'true' },
    expectCache: false,
  },
  {
    // Callers pass useDO explicitly; false must still mean no.
    name: 'useDO=false overrides everything',
    env: { FEATURE_FLAG_DO_CACHE: 'true', CACHE_DO: BINDING },
    useDO: false,
    expectCache: false,
  },
];

let failed = 0;
for (const c of cases) {
  const got = createCacheInstance(c.env, c.useDO ?? true);
  const ok = c.expectCache ? got !== null : got === null;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${c.name}`);
  if (!ok) failed++;
}

// The factory and the predicate must not disagree about what "enabled" means.
for (const c of cases.filter((x) => x.useDO !== false)) {
  assert.equal(
    createCacheInstance(c.env, true) !== null,
    isDOCacheEnabled(c.env),
    `factory and isDOCacheEnabled disagree: ${c.name}`
  );
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} failed`);
  process.exit(1);
}
console.log(`\nOK: ${cases.length} cases, factory agrees with isDOCacheEnabled`);
