/**
 * Date/timezone utilities for report handlers
 * 
 * Precedence for resolving "today":
 * 1. ?date=YYYY-MM-DD - explicit date (always wins)
 * 2. ?tz= or cct_tz cookie - server computes that zone's "today"
 * 3. Default to ET (aligns with job schedule)
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

/** Parse cct_tz cookie from request */
export function getTimezoneFromCookie(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/cct_tz=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Resolve query date from params/cookie with precedence: ?date > ?tz/cookie > ET default */
export function resolveQueryDate(request: Request, url: URL): string {
  const dateParam = url.searchParams.get('date');
  
  // 1. Explicit date always wins
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return dateParam;
  }
  
  // Handle "yesterday" relative to resolved timezone
  const tzParam = url.searchParams.get('tz');
  const tzCookie = getTimezoneFromCookie(request);
  const tz = tzParam || tzCookie || 'America/New_York';
  const today = getTodayInZone(tz);
  
  if (dateParam === 'yesterday') {
    const d = new Date(today + 'T12:00:00Z');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  
  // 2/3. Use timezone from param, cookie, or default ET
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
