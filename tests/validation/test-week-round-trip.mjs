// Guard: a week key and its date window must describe the same week.
//
// The bug this exists for, found 2026-08-07 while designing the business-date
// envelope. `getWeekString` counted days from Jan 1 and divided by seven;
// `getWeekStartDate` reversed that arithmetic and then snapped the result to
// Monday. The snap is not part of the forward direction, so the two are not
// inverses, and on Mondays and Tuesdays the window lands a week early:
//
//     2026-08-03 (Mon) -> 2026-W31 -> window 2026-07-27 .. 2026-08-02
//
// which does not contain 2026-08-03. `GET /api/v1/reports/weekly` builds its key
// from today and then reads the daily rows inside that window, so on those two
// weekdays it served the *previous* week's review as the current one. Nothing
// caught it: the response was a 200 with a full week of real signals in it, and
// the week label it carried was internally consistent with the window it used.
//
// The property is stated over a whole year plus every year boundary in range,
// not over the two weekdays that happened to break, because the failure came
// from an arithmetic relationship rather than from a special case.
//
// Run: npm run test:week-round-trip

import assert from 'node:assert/strict';
import { getWeekString, getWeekStartDate, lastTradingDayOfWeek, isTradingDay } from '../../src/modules/trading-calendar.ts';

const iso = (d) => d.toISOString().split('T')[0];
const DAY = 86400000;

/** Every date from `from` to `to` inclusive, as YYYY-MM-DD. */
function everyDay(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= Date.parse(`${to}T12:00:00Z`); t += DAY) {
    out.push(iso(new Date(t)));
  }
  return out;
}

/** The window a week key resolves to, as [start, end] YYYY-MM-DD. */
function windowOf(weekKey) {
  const [year, week] = weekKey.split('-W').map(Number);
  const start = getWeekStartDate(year, week);
  return [iso(start), iso(new Date(start.getTime() + 6 * DAY))];
}

// --- the property that was violated ------------------------------------------

{
  const failures = [];
  for (const day of everyDay('2025-12-01', '2027-01-31')) {
    const key = getWeekString(new Date(`${day}T12:00:00Z`));
    const [start, end] = windowOf(key);
    if (!(day >= start && day <= end)) failures.push(`${day} -> ${key} -> ${start}..${end}`);
  }
  assert.deepEqual(
    failures,
    [],
    `a week key's window must contain the day it was derived from:\n  ${failures.slice(0, 8).join('\n  ')}`
  );
}

// The two weekdays that actually broke, named so a regression reads plainly
// rather than as one line of a 400-day sweep.
{
  for (const monday of ['2026-08-03', '2026-01-05', '2026-11-30']) {
    const [start] = windowOf(getWeekString(new Date(`${monday}T12:00:00Z`)));
    assert.equal(start, monday, `a Monday must open its own week (${monday})`);
  }
  for (const [tuesday, monday] of [['2026-08-04', '2026-08-03'], ['2026-01-06', '2026-01-05']]) {
    const [start] = windowOf(getWeekString(new Date(`${tuesday}T12:00:00Z`)));
    assert.equal(start, monday, `a Tuesday belongs to the week its Monday opened (${tuesday})`);
  }
}

// --- the window itself --------------------------------------------------------

{
  // Monday through Sunday. The weekly handler adds 6 days to the start, so a
  // start that is not a Monday silently reshapes the window it reads.
  for (const day of everyDay('2026-01-01', '2026-12-31')) {
    const [start, end] = windowOf(getWeekString(new Date(`${day}T12:00:00Z`)));
    const startDow = new Date(`${start}T12:00:00Z`).getUTCDay();
    const endDow = new Date(`${end}T12:00:00Z`).getUTCDay();
    assert.equal(startDow, 1, `week for ${day} starts on weekday ${startDow}, expected Monday`);
    assert.equal(endDow, 0, `week for ${day} ends on weekday ${endDow}, expected Sunday`);
  }
}

{
  // Consecutive days are in the same week or the next one, never further and
  // never backwards. Catches an off-by-one that the containment check alone can
  // absorb when both directions are wrong by the same amount.
  const days = everyDay('2026-01-01', '2026-12-31');
  let prevStart = null;
  for (const day of days) {
    const [start] = windowOf(getWeekString(new Date(`${day}T12:00:00Z`)));
    if (prevStart !== null) {
      const gap = (Date.parse(`${start}T12:00:00Z`) - Date.parse(`${prevStart}T12:00:00Z`)) / DAY;
      assert.ok(gap === 0 || gap === 7, `${day}: week start moved by ${gap} days, expected 0 or 7`);
    }
    prevStart = start;
  }
}

// --- ISO-8601, since the key format is ISO notation ---------------------------

{
  // `YYYY-W##` is ISO week notation, so the numbering has to be ISO's: week 1 is
  // the week containing the first Thursday, and the year in the key is the ISO
  // week-year, which is not always the calendar year at the boundary.
  const known = [
    ['2026-01-01', '2026-W01'], // Thursday — its own week 1
    ['2025-12-29', '2026-W01'], // Monday of the week containing 2026-01-01
    ['2026-12-31', '2026-W53'], // Thursday, so 2026 has 53 weeks
    ['2027-01-01', '2026-W53'], // Friday still belongs to 2026's last week
    ['2027-01-04', '2027-W01'],
  ];
  for (const [day, expected] of known) {
    assert.equal(
      getWeekString(new Date(`${day}T12:00:00Z`)),
      expected,
      `${day} should be ${expected}`
    );
  }
}

// --- the last trading day a week actually contains -----------------------------
//
// A weekly review is about a week, but an envelope states a day, so the day has
// to be the last session the week actually held. Three traps: the week's last
// calendar day is a Sunday and never a session; a holiday Friday moves the
// answer to Thursday; and a week still in progress has no sessions yet for the
// days that have not happened.

{
  // Weekday classification must not depend on where the test runs. This read
  // `getDay()` off a Date parsed at a fixed -05:00, which is the host's weekday:
  // right on Workers (TZ=UTC), and one day out on a UTC+8 machine, where it
  // called Sunday a session.
  assert.equal(isTradingDay('2026-08-09'), false, 'Sunday is not a session');
  assert.equal(isTradingDay('2026-08-08'), false, 'Saturday is not a session');
  assert.equal(isTradingDay('2026-08-07'), true, 'an ordinary Friday is');
  assert.equal(isTradingDay('2026-12-25'), false, 'Christmas Day is a holiday');

  // 2026-W32 is 08-03..08-09. Friday the 7th is a normal session.
  assert.equal(lastTradingDayOfWeek('2026-W32'), '2026-08-07');

  // Never a weekend, for any week of the year. `week_end` — the obvious wrong
  // answer — is a Sunday every single time.
  for (let w = 1; w <= 52; w++) {
    const key = `2026-W${String(w).padStart(2, '0')}`;
    const day = lastTradingDayOfWeek(key);
    assert.ok(day, `${key} resolved to no session at all`);
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    assert.ok(dow >= 1 && dow <= 5, `${key} resolved to weekday ${dow} (${day})`);
  }

  // A week in progress stops at the last session that has already happened,
  // rather than naming a Friday that has not arrived.
  assert.equal(lastTradingDayOfWeek('2026-W32', '2026-08-05'), '2026-08-05');
  assert.equal(lastTradingDayOfWeek('2026-W32', '2026-08-06'), '2026-08-06');

  // A clamp before the week opens leaves no session in range.
  assert.equal(lastTradingDayOfWeek('2026-W32', '2026-07-30'), null);

  // A holiday Friday hands the week to Thursday. 2026-12-25 is Christmas Day,
  // a Friday, and is in NYSE_HOLIDAYS_2026 — so "just take the Friday" is wrong
  // in a way only the calendar can tell you.
  assert.equal(lastTradingDayOfWeek(getWeekString(new Date('2026-12-25T12:00:00Z'))), '2026-12-24');
}


console.log('week round trip: OK');
