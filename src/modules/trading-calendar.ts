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
  const d = new Date(date + 'T12:00:00-05:00'); // Noon ET to avoid DST issues
  const dayOfWeek = d.getDay();

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
