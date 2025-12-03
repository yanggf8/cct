/**
 * Business Intelligence Dashboard Module
 * Main entry point for dashboard functionality
 * Phase 3 Implementation: Dashboard module exports
 */

// Import dashboard components
import './dashboard-client.js';
import './dashboard-controller.js';

// Export main classes for external use
export { BIDashboardClient } from './dashboard-client.js';
export { BIDashboardController } from './dashboard-controller.js';

/**
 * Dashboard factory function for easy initialization
 */
export function createDashboard(containerId, config = {}) {
  return new BIDashboardController(containerId, config);
}

/**
 * Dashboard utilities
 */
export const DashboardUtils = {
  /**
   * Format currency values
   */
  formatCurrency(value, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(value);
  },

  /**
   * Format percentage values
   */
  formatPercentage(value, decimals = 1) {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Format large numbers with suffixes
   */
  formatNumber(value) {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  },

  /**
   * Format duration in milliseconds to human readable
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${(ms / 60000).toFixed(1)}m`;
    }
  },

  /**
   * Get color based on value (red-yellow-green scale)
   */
  getHealthColor(value, thresholds = { good: 80, warning: 60 }) {
    if (value >= thresholds.good) {
      return '#28a745'; // Green
    } else if (value >= thresholds.warning) {
      return '#ffc107'; // Yellow
    } else {
      return '#dc3545'; // Red
    }
  },

  /**
   * Determine status based on percentage
   */
  getStatus(percentage, thresholds = { good: 90, warning: 75 }) {
    if (percentage >= thresholds.good) {
      return 'good';
    } else if (percentage >= thresholds.warning) {
      return 'warning';
    } else {
      return 'critical';
    }
  },

  /**
   * Calculate trend between two values
   */
  calculateTrend(current, previous) {
    if (previous === 0) {
      return { value: 0, direction: 'none' };
    }

    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'none'
    };
  }
};

// Auto-initialize if DOM is ready and container exists
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Look for dashboard container and auto-initialize
    const container = document.getElementById('bi-dashboard-container');
    if (container && !container.hasAttribute('data-manual-init')) {
      try {
        window.dashboard = createDashboard('bi-dashboard-container', {
          autoRefresh: true,
          refreshInterval: 300000, // 5 minutes
          enableAnimations: true
        });
        console.log('BI Dashboard auto-initialized');
      } catch (error) {
        console.error('Failed to auto-initialize dashboard:', error);
      }
    }
  });
}

// Make available globally
if (typeof window !== 'undefined') {
  window.createDashboard = createDashboard;
  window.DashboardUtils = DashboardUtils;
}