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
  
  // Resolve timezone: ?tz > DO setting > ET default
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
