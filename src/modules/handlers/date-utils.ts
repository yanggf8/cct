/**
 * Date/timezone utilities for report handlers
 * 
 * Precedence for resolving "today":
 * 1. ?date=YYYY-MM-DD - explicit date (always wins)
 * 2. ?tz= query param - override timezone
 * 3. CACHE_DO settings - user's saved timezone preference
 * 4. Default to ET (aligns with job schedule)
 */

/** Get today's date string in a given IANA timezone */
export function getTodayInZone(tz: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz }); // en-CA gives YYYY-MM-DD
    return formatter.format(new Date());
  } catch {
    // Invalid timezone, fall back to ET
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
    return formatter.format(new Date());
  }
}

/** Get timezone from CACHE_DO */
export async function getTimezoneFromDO(cacheDO: any): Promise<string | null> {
  if (!cacheDO) return null;
  try {
    const id = cacheDO.idFromName('global-cache');
    const stub = cacheDO.get(id);
    const res = await stub.fetch('https://do/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'settings:timezone' })
    });
    const data = await res.json() as { value?: string };
    return data.value || null;
  } catch {
    return null;
  }
}

/** Save timezone to CACHE_DO */
export async function setTimezoneInDO(cacheDO: any, tz: string): Promise<void> {
  const id = cacheDO.idFromName('global-cache');
  const stub = cacheDO.get(id);
  await stub.fetch('https://do/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'settings:timezone', value: tz, ttl: 31536000 }) // 1 year
  });
}

/** Resolve query date with precedence: ?date > ?tz > DO setting > ET default */
export async function resolveQueryDate(url: URL, cacheDO?: any): Promise<string> {
  const dateParam = url.searchParams.get('date');
  
  // 1. Explicit date always wins
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam;
  }
  
  // Resolve timezone: ?tz > DO setting > America/New_York default
  const tzParam = url.searchParams.get('tz');
  const tz = tzParam || await getTimezoneFromDO(cacheDO) || 'America/New_York';
  const today = getTodayInZone(tz);

  if (dateParam === 'yesterday') {
    const d = new Date(today + 'T12:00:00Z');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  return today;
}

/** Get current hour and minute in ET timezone (for schedule comparison) */
export function getCurrentTimeET(): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  return { hour, minute };
}

/**
 * Get the Sunday for a given week based on a date string
 * Uses timezone from ?tz, DO setting, or defaults to ET
 */
export async function getWeekSunday(weekParam: string | null, url: URL, cacheDO?: any): Promise<Date> {
  // Resolve timezone: ?tz > DO setting > America/New_York default (aligns with market hours)
  const tzParam = url.searchParams.get('tz');
  const tz = tzParam || await getTimezoneFromDO(cacheDO) || 'America/New_York';
  const todayStr = getTodayInZone(tz);
  const today = new Date(todayStr + 'T12:00:00Z');

  // Handle "last" parameter for previous week
  if (weekParam === 'last') {
    const day = today.getDay();
    const thisSunday = new Date(today);
    thisSunday.setDate(today.getDate() - day);
    const lastSunday = new Date(thisSunday);
    lastSunday.setDate(thisSunday.getDate() - 7);
    lastSunday.setHours(0, 0, 0, 0);
    return lastSunday;
  }

  if (weekParam && weekParam !== 'last') {
    const weekDate = new Date(weekParam);
    if (!isNaN(weekDate.getTime())) {
      // Find the Sunday of that week
      const day = weekDate.getDay();
      const diff = weekDate.getDate() - day;
      const sunday = new Date(weekDate);
      sunday.setDate(diff);
      sunday.setHours(0, 0, 0, 0);
      return sunday;
    }
  }

  // Default: find most recent Sunday
  const day = today.getDay();
  const diff = today.getDate() - day;
  const sunday = new Date(today);
  sunday.setDate(diff);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

/**
 * Get weekdays (Mon-Fri) for the week ending at the anchor date.
 * Strict week boundaries: only returns dates from that specific week, no cross-week spillover.
 *
 * @param anchorDate - Typically a Sunday; returns Mon-Fri of the week ending on that Sunday
 * @param count - Max days to return (default 5 for Mon-Fri)
 * @returns Array of dates [Mon, Tue, Wed, Thu, Fri] in chronological order
 */
export function getLastTradingDays(anchorDate: number | string | Date, count: number = 5): Date[] {
  const anchor = new Date(anchorDate);
  const dayOfWeek = anchor.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Calculate Monday of the week that just ended
  // If anchor is Sunday (0), Monday was 6 days ago
  // If anchor is Saturday (6), Monday was 5 days ago
  // If anchor is Friday (5), Monday was 4 days ago, etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  // Return Mon-Fri of that specific week (strict boundaries)
  const dates: Date[] = [];
  for (let i = 0; i < Math.min(count, 5); i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }

  return dates; // Already in chronological order [Mon, Tue, Wed, Thu, Fri]
}
