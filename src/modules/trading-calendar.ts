/**
 * Trading Calendar Module
 * NYSE trading day calculations with holiday support
 */

// Cutover date for job_date_results tracking
// Dates before this return 'n/a', dates on/after return 'missed' if no row exists
export const NAV_CUTOVER_DATE = '2026-01-28'; // Set to deployment date (update on deploy)

// NYSE market holidays for 2026 (update annually each December)
const NYSE_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // MLK Day
  '2026-02-16', // Presidents Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-07-03', // Independence Day (observed)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving
  '2026-12-25', // Christmas
];

// NYSE market holidays for 2025 (for historical lookups)
const NYSE_HOLIDAYS_2025 = [
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-04-18', // Good Friday
  '2025-05-26', // Memorial Day
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-11-27', // Thanksgiving
  '2025-12-25', // Christmas
];

// NYSE market holidays for 2027 (forward-looking)
const NYSE_HOLIDAYS_2027 = [
  '2027-01-01', // New Year's Day
  '2027-01-18', // MLK Day
  '2027-02-15', // Presidents Day
  '2027-03-26', // Good Friday
  '2027-05-31', // Memorial Day
  '2027-07-05', // Independence Day (observed)
  '2027-09-06', // Labor Day
  '2027-11-25', // Thanksgiving
  '2027-12-24', // Christmas (observed)
];

// Combined holiday set for quick lookup
const NYSE_HOLIDAYS = new Set([...NYSE_HOLIDAYS_2025, ...NYSE_HOLIDAYS_2026, ...NYSE_HOLIDAYS_2027]);

/**
 * Check if a date string (YYYY-MM-DD) is a NYSE trading day
 */
export function isTradingDay(date: string): boolean {
  // Read in UTC, not local time. This parsed the date at a fixed -05:00 and then
  // called `getDay()`, which is the *host's* weekday: correct on Workers because
  // they run TZ=UTC, and wrong by one day anywhere east of it — on a UTC+8
  // machine it called Sunday a trading day. The fixed offset was also EST in a
  // repo whose sessions are half the year in EDT. A date-only string has no
  // instant in it to convert, so anchoring at noon UTC and reading UTC accessors
  // is both correct and independent of where the code runs.
  const d = new Date(date + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay();

  // Weekend check (0 = Sunday, 6 = Saturday)
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  // Holiday check
  if (NYSE_HOLIDAYS.has(date)) return false;

  return true;
}

/**
 * Get the last N trading days from a given date (or today if not specified)
 * Returns dates in descending order (most recent first)
 */
export function getLastNTradingDays(n: number, fromDate?: string): string[] {
  const result: string[] = [];

  // Helper to format date as YYYY-MM-DD in ET
  const formatDateET = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse fromDate or use current date in ET
  let current: Date;
  if (fromDate) {
    current = new Date(fromDate + 'T12:00:00-05:00');
  } else {
    // Get current date in Eastern Time (avoid UTC conversion issues)
    current = getCurrentTimeET();
  }

  // Iterate backwards until we have N trading days
  while (result.length < n) {
    const dateStr = formatDateET(current);
    if (isTradingDay(dateStr)) {
      result.push(dateStr);
    }
    current.setDate(current.getDate() - 1);
  }

  return result;
}

/**
 * Get status for a missing row based on cutover date
 * @param date - The scheduled_date to check
 * @returns 'n/a' for pre-cutover dates, 'missed' for post-cutover dates
 */
export function getStatusForMissingRow(date: string): 'n/a' | 'missed' {
  return date < NAV_CUTOVER_DATE ? 'n/a' : 'missed';
}

/**
 * Format a date string for display in navigation (e.g., "Jan 28 (Wed)")
 */
export function formatDateForNav(date: string): string {
  const d = new Date(date + 'T12:00:00-05:00');
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'America/New_York' });
  const day = d.getDate();
  const weekday = d.toLocaleString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
  return `${month} ${day} (${weekday})`;
}

/**
 * Get current time in Eastern timezone as Date object
 * Uses formatToParts() for reliable timezone conversion in Workers environment
 */
export function getCurrentTimeET(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

  // Construct Date in ET (note: Date constructor interprets as local time,
  // but we only use hour/minute extraction, not absolute time comparison)
  return new Date(
    parseInt(get('year'), 10),
    parseInt(get('month'), 10) - 1,
    parseInt(get('day'), 10),
    parseInt(get('hour'), 10),
    parseInt(get('minute'), 10),
    parseInt(get('second'), 10)
  );
}

/**
 * Check if current time is during market hours (9:30 AM - 4:00 PM ET)
 */
export function isMarketHours(): boolean {
  const et = getCurrentTimeET();
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 30;  // 9:30 AM
  const marketClose = 16 * 60;      // 4:00 PM

  return totalMinutes >= marketOpen && totalMinutes < marketClose;
}

/**
 * Get current date in Eastern timezone as YYYY-MM-DD string
 */
export function getCurrentDateET(): string {
  const et = getCurrentTimeET();
  const year = et.getFullYear();
  const month = String(et.getMonth() + 1).padStart(2, '0');
  const day = String(et.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- ISO-8601 week arithmetic ------------------------------------------------
//
// `YYYY-W##` is ISO week notation, so the numbering here is ISO's: weeks run
// Monday to Sunday, week 1 is the one containing the first Thursday (equivalently
// the one containing Jan 4), and the year in the key is the ISO week-year, which
// differs from the calendar year at the boundary — 2027-01-01 is a Friday and
// belongs to 2026-W53.
//
// These replace a pair in report-routes.ts that were not inverses. The forward
// direction counted days from Jan 1 and divided by seven; the reverse undid that
// and then snapped to Monday, a step with no counterpart going forward. On
// Mondays and Tuesdays the window therefore landed a week early — 2026-08-03
// produced 2026-W31, whose window was 2026-07-27..2026-08-02 and did not contain
// it — so `GET /api/v1/reports/weekly` read the previous week's rows and labelled
// them as the current week. Defining both directions in terms of the same Monday
// makes them inverses by construction rather than by arithmetic coincidence.

const DAY_MS = 86400000;

/** Monday = 0 … Sunday = 6. JavaScript's own numbering starts at Sunday. */
function isoDayOfWeek(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/** The Monday opening the ISO week that contains `date`, at UTC midnight. */
function isoWeekMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - isoDayOfWeek(d));
  return d;
}

/** The Monday opening week 1 of `isoYear`, i.e. the Monday of the week holding Jan 4. */
function isoWeek1Monday(isoYear: number): Date {
  return isoWeekMonday(new Date(Date.UTC(isoYear, 0, 4)));
}

/**
 * The ISO-8601 week containing `date`, as `YYYY-W##`.
 *
 * `date` is read with UTC accessors, so callers pass an instant that already
 * represents the business date they mean — `new Date(`${businessDate}T12:00:00Z`)`
 * is the idiom used elsewhere in this repo.
 */
export function getWeekString(date: Date): string {
  const monday = isoWeekMonday(date);
  // The ISO year is the year of that week's Thursday, by definition.
  const isoYear = new Date(monday.getTime() + 3 * DAY_MS).getUTCFullYear();
  const week = 1 + Math.round((monday.getTime() - isoWeek1Monday(isoYear).getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * The Monday opening `week` of `isoYear`, at UTC midnight.
 *
 * Exactly inverse to `getWeekString`: the week key produced for any date resolves
 * to a window containing that date. Callers format the result with
 * `toISOString()`, so the returned instant is UTC, not local.
 */
export function getWeekStartDate(isoYear: number, week: number): Date {
  return new Date(isoWeek1Monday(isoYear).getTime() + (week - 1) * 7 * DAY_MS);
}

/**
 * The last NYSE session within an ISO week, or `null` if the week holds none.
 *
 * A weekly review covers a week, but an envelope states a day, so the day has to
 * be the last session the week actually held. Two obvious answers are both
 * wrong. `week_end` is `week_start + 6`, which is a Sunday every single time.
 * "The Friday" is wrong whenever the Friday is a holiday — 2026-12-25 is
 * Christmas Day and a Friday, and that week's last session is Thursday the
 * 24th, which only the calendar can tell you.
 *
 * `notAfter` (YYYY-MM-DD) clamps the search, so a week still in progress reports
 * the last session that has already happened rather than naming one in the
 * future.
 */
export function lastTradingDayOfWeek(weekKey: string, notAfter?: string): string | null {
  const [isoYear, week] = weekKey.split('-W').map(Number);
  const monday = getWeekStartDate(isoYear, week);
  for (let offset = 6; offset >= 0; offset--) {
    // Whole-day arithmetic on a UTC-midnight Monday: no clock is being read and
    // no timezone conversion happens, so `toISOString` here is date arithmetic
    // on an already-chosen day, not a business date derived from an instant.
    const day = new Date(monday.getTime() + offset * DAY_MS).toISOString().split('T')[0];
    if (notAfter && day > notAfter) continue;
    if (isTradingDay(day)) return day;
  }
  return null;
}
