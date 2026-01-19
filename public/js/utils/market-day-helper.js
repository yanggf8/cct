/**
 * Market Day Helper Utilities
 * Determines the last market day (skips weekends)
 */

// Helpers for Eastern Time (ET)
function getETDate(referenceDate = new Date()) {
  return new Date(referenceDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function formatETDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the last market day (ET-aware)
 * @param {Date} referenceDate - Date to calculate from (defaults to today)
 * @returns {string} - Date string in YYYY-MM-DD (ET) format
 */
function getLastMarketDay(referenceDate = new Date()) {
  const etDate = getETDate(referenceDate);
  const dayOfWeek = etDate.getDay(); // 0 = Sunday ... 6 = Saturday

  let daysToSubtract;
  if (dayOfWeek === 1) {
    daysToSubtract = 3; // Monday -> Friday
  } else if (dayOfWeek === 0) {
    daysToSubtract = 2; // Sunday -> Friday
  } else if (dayOfWeek === 6) {
    daysToSubtract = 1; // Saturday -> Friday
  } else {
    daysToSubtract = 1; // Tue-Fri -> previous day
  }

  const lastMarketDay = new Date(etDate);
  lastMarketDay.setDate(etDate.getDate() - daysToSubtract);
  return formatETDate(lastMarketDay);
}

/**
 * Get the date label for display
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {string} type - 'yesterday' or 'week'
 * @returns {string} - Display label
 */
function getDateLabel(dateStr, type = 'yesterday') {
  const date = getETDate(new Date(dateStr + 'T00:00:00'));
  const todayET = getETDate();
  const yesterdayET = new Date(todayET);
  yesterdayET.setDate(todayET.getDate() - 1);

  if (type === 'yesterday') {
    const yesterdayDay = yesterdayET.getDay();
    const yesterdayIsWeekend = yesterdayDay === 0 || yesterdayDay === 6;
    return yesterdayIsWeekend ? 'Last Market Day' : 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Check if a date is a weekend
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {boolean} - True if weekend (Saturday or Sunday)
 */
function isWeekend(dateStr) {
  const date = getETDate(new Date(dateStr + 'T00:00:00'));
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Get market status
 * @returns {object} - Status information
 */
function getMarketStatus() {
  const nowET = getETDate();
  const dayOfWeek = nowET.getDay();
  const hour = nowET.getHours();
  const minute = nowET.getMinutes();

  // Market hours: 9:30 AM - 4:00 PM ET, Mon-Fri (holidays not accounted for)
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const afterOpen = hour > 9 || (hour === 9 && minute >= 30);
  const beforeClose = hour < 16;
  const isMarketHours = isWeekday && afterOpen && beforeClose;

  const status = isMarketHours ? 'OPEN' : 'CLOSED';
  const message = isMarketHours ? 'Market is open' : 'Market is closed';

  const lastMarketDay = getLastMarketDay(nowET);

  return {
    status,
    message,
    isWeekend: !isWeekday,
    lastMarketDay,
    lastMarketDayLabel: getDateLabel(lastMarketDay, 'yesterday')
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
