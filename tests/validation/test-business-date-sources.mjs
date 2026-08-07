// Guard: the write path must key the business day in ET, like the reader does.
//
// The bug this exists for, found 2026-08-07. The cron writer keys snapshots by
// the ET business date (`getESTDateString`, modules/scheduler.ts:60). The
// manually-triggered job path did not — jobs-routes.ts declared
//
//     let scheduledDate = new Date().toISOString().split('T')[0];
//
// two lines under a comment calling it "the market date this report is FOR".
// That is a UTC date. A POST at 02:00 UTC therefore wrote the row under
// 2026-08-07 while the ET trading day was still 2026-08-06, so the report route
// — which had just been corrected to read the ET business date — looked for
// 2026-08-06, found nothing, and served its "not yet available" placeholder over
// a report that had been generated minutes earlier.
//
// Fixing only the reader moves the disagreement; it does not remove it. Writer
// and reader have to name the same day.
//
// The file list below is deliberately narrow. A repo-wide ban on
// `toISOString().split('T')[0]` would be wrong: most of the ~130 other uses are
// cache keys over instants, chart ranges and API query windows, where a UTC day
// is harmless or actually correct. These files are listed because every "today"
// in them keys a business day.
//
// Run: npm run test:business-date-sources

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getCurrentDateET } from '../../src/modules/trading-calendar.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));

// --- the property, at the instant that used to break it -----------------------

{
  // 02:00 UTC on 2026-08-07 is 22:00 ET on 2026-08-06 — inside the window where
  // the two calendars disagree, and the window in which end-of-day work lands.
  const frozen = Date.parse('2026-08-07T02:00:00Z');
  const RealDate = globalThis.Date;
  class FrozenDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [frozen]));
    }
    static now() {
      return frozen;
    }
  }
  globalThis.Date = FrozenDate;
  try {
    assert.equal(
      getCurrentDateET(),
      '2026-08-06',
      'the market business date at 22:00 ET must be that ET day, not the UTC one'
    );
    assert.equal(
      new Date().toISOString().split('T')[0],
      '2026-08-07',
      'sanity: the idiom being replaced really does answer a different day here'
    );
  } finally {
    globalThis.Date = RealDate;
  }
}

// --- no business-day key may be derived from UTC ------------------------------

const BUSINESS_DAY_FILES = [
  'src/routes/jobs-routes.ts',
  'src/routes/report-routes.ts',
  'src/modules/pre-market-data-bridge.ts',
];

// `new Date()` with no argument is "now", so its UTC date is a UTC day. A UTC
// date taken from a Date that was *passed in* is a different matter — those are
// left alone, since the caller may legitimately hold an instant. Whitespace is
// stripped before matching so a reformat cannot slip one through.

{
  const offenders = [];
  for (const rel of BUSINESS_DAY_FILES) {
    const text = readFileSync(repo + rel, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      // Comments are exempt: naming the banned idiom in a docstring is how the
      // rule is explained, and a guard that forbids that teaches nothing.
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
      if (line.replace(/\s+/g, '').includes("newDate().toISOString().split('T')[0]")) {
        offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `these key a business day and must call getCurrentDateET():\n  ${offenders.join('\n  ')}`
  );
}

{
  // A file cannot satisfy the rule above by deleting its date handling; it has
  // to be getting the business date from the one authority.
  for (const rel of BUSINESS_DAY_FILES) {
    const text = readFileSync(repo + rel, 'utf8');
    assert.ok(
      text.includes('getCurrentDateET'),
      `${rel} keys business days but does not use trading-calendar's getCurrentDateET`
    );
  }
}

console.log('business date sources: OK');
