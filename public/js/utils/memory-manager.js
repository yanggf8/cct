/**
 * Memory-safe interval manager for dashboards/pages.
 * Uses registerInterval/cleanup to avoid leaked timers.
 */
(function() {
  'use strict';

  const intervals = new Map();

  function registerInterval(id, callback, delay) {
    if (intervals.has(id)) {
      window.clearInterval(intervals.get(id));
    }
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      callback();
    }, delay);
    intervals.set(id, intervalId);
    return intervalId;
  }

  function clearRegisteredInterval(id) {
    const intervalId = intervals.get(id);
    if (intervalId) {
      window.clearInterval(intervalId);
      intervals.delete(id);
    }
  }

  function cleanup() {
    intervals.forEach(id => window.clearInterval(id));
    intervals.clear();
  }

  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  window.memoryManager = { registerInterval, clearRegisteredInterval, cleanup };
})();
