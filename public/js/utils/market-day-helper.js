/**
 * Market Day Helper Utilities
 * Determines the last market day (skips weekends)
 */

/**
 * Get the last market day
 * @param {Date} referenceDate - Date to calculate from (defaults to today)
 * @returns {string} - Date string in YYYY-MM-DD format
 */
function getLastMarketDay(referenceDate = new Date()) {
  const date = new Date(referenceDate);

  // Get the day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = date.getDay();

  // Calculate days to subtract to get to last market day
  let daysToSubtract;

  if (dayOfWeek === 1) {
    // Monday - go back 3 days (to Friday)
    daysToSubtract = 3;
  } else if (dayOfWeek === 0) {
    // Sunday - go back 2 days (to Friday)
    daysToSubtract = 2;
  } else if (dayOfWeek === 6) {
    // Saturday - go back 1 day (to Friday)
    daysToSubtract = 1;
  } else {
    // Tuesday-Friday - go back 1 day
    daysToSubtract = 1;
  }

  // Subtract days to get to last market day
  const lastMarketDay = new Date(date);
  lastMarketDay.setDate(date.getDate() - daysToSubtract);

  // Return in YYYY-MM-DD format
  return lastMarketDay.toISOString().split('T')[0];
}

/**
 * Get the date label for display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} type - 'yesterday' or 'week'
 * @returns {string} - Display label
 */
function getDateLabel(dateStr, type = 'yesterday') {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const lastMarketDay = new Date(getLastMarketDay() + 'T00:00:00');

  // Check if this is the actual yesterday (calendar yesterday)
  const isCalendarYesterday = date.toDateString() === yesterday.toDateString();

  // Check if this is the last market day
  const isLastMarketDay = date.toDateString() === lastMarketDay.toDateString();

  if (type === 'yesterday') {
    if (isCalendarYesterday && !isLastMarketDay) {
      return 'Last Market Day';
    } else if (isLastMarketDay) {
      return 'Yesterday';
    }
  }

  // Format date for display
  const options = { month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Check if a date is a weekend
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {boolean} - True if weekend (Saturday or Sunday)
 */
function isWeekend(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Get market status
 * @returns {object} - Status information
 */
function getMarketStatus() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hour = now.getHours();

  // Market is open Monday-Friday, 9:30 AM - 4:00 PM ET
  // Simplified: assume market is open if it's a weekday and between 9:30-16:00
  // Note: This is simplified and doesn't account for holidays
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isMarketHours = hour >= 9 && hour < 16;

  let status = 'CLOSED';
  let message = 'Market is closed';

  if (isWeekday) {
    if (isMarketHours) {
      status = 'OPEN';
      message = 'Market is open';
    } else {
      status = 'CLOSED';
      message = 'Market is closed (outside trading hours)';
    }
  } else {
    status = 'CLOSED';
    message = 'Market is closed (weekend)';
  }

  return {
    status,
    message,
    isWeekend: !isWeekday,
    lastMarketDay: getLastMarketDay(),
    lastMarketDayLabel: getDateLabel(getLastMarketDay(), 'yesterday')
  };
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getLastMarketDay,
    getDateLabel,
    isWeekend,
    getMarketStatus
  };
} else {
  // Make available globally
  window.MarketDayHelper = {
    getLastMarketDay,
    getDateLabel,
    isWeekend,
    getMarketStatus
  };
}
