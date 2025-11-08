/**
 * Timezone Utilities Module
 * Standardizes all date operations to EST/EDT for trading data consistency
 */

// Import KVKeyFactory for key generation
import { KVKeyFactory, KeyTypes } from './kv-key-factory.js';

/**
 * Get current date in EST/EDT timezone as YYYY-MM-DD string
 */
export function getCurrentDateEST(): string {
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return estTime.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Get current datetime in EST/EDT timezone as ISO string
 */
export function getCurrentDateTimeEST(): string {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })).toISOString();
}

/**
 * Validate and normalize date parameter from API requests
 */
export function validateDateParameter(dateStr?: string): string {
  if (!dateStr) {
    return getCurrentDateEST();
  }

  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  // Validate it's a real date
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }

  // Don't allow future dates beyond today
  const today = getCurrentDateEST();
  if (dateStr > today) {
    throw new Error('Future dates not allowed');
  }

  return dateStr;
}

/**
 * Convert a date string to EST timezone for display
 */
export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Get yesterday's date in EST/EDT timezone
 */
export function getYesterdayEST(): string {
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  estTime.setDate(estTime.getDate() - 1);
  return estTime.toISOString().split('T')[0];
}

/**
 * Get array of date strings for the last N days (including today)
 */
export function getLastNDaysEST(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

  for (let i = 0; i < days; i++) {
    const date = new Date(estTime);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}

/**
 * Get KV key for daily summary
 */
export function getDailySummaryKVKey(date: string): string {
  return `daily_summary_${date}`;
}

/**
 * Get KV key for daily analysis
 */
export function getDailyAnalysisKVKey(date: string): string {
  return `analysis_${date}`;
}

/**
 * Check if a date is a trading day (weekdays, excluding holidays)
 * Simple implementation - checks if it's a weekday
 */
export function isTradingDay(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

  // Return true for weekdays (Monday-Friday)
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}