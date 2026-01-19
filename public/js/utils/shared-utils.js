/**
 * Shared Utilities for CCT Frontend
 * Classic script - creates global objects for use across all pages
 */

(function() {
  'use strict';

  // ===== DOM Cache =====
  // Caches DOM queries to improve performance
  window.DomCache = {
    cache: new Map(),

    get(id) {
      if (!this.cache.has(id)) {
        this.cache.set(id, document.getElementById(id));
      }
      return this.cache.get(id);
    },

    getAll(selector) {
      const key = `all-${selector}`;
      if (!this.cache.has(key)) {
        this.cache.set(key, document.querySelectorAll(selector));
      }
      return this.cache.get(key);
    },

    clear() {
      this.cache.clear();
    }
  };

  // ===== Formatters =====
  // Common formatting utilities
  window.Formatters = {
    number(value, decimals = 2) {
      return Number(value).toFixed(decimals);
    },

    percentage(value, decimals = 2) {
      return `${(value * 100).toFixed(decimals)}%`;
    },

    currency(value, symbol = '$') {
      return `${symbol}${Number(value).toLocaleString()}`;
    },

    date(date, format = 'short') {
      const d = new Date(date);
      return d.toLocaleDateString('en-US');
    },

    dateTime(date) {
      const d = new Date(date);
      return d.toLocaleString('en-US');
    },

    compactNumber(value) {
      if (value >= 1e9) {
        return (value / 1e9).toFixed(1) + 'B';
      }
      if (value >= 1e6) {
        return (value / 1e6).toFixed(1) + 'M';
      }
      if (value >= 1e3) {
        return (value / 1e3).toFixed(1) + 'K';
      }
      return value.toString();
    }
  };

  // ===== Error Handler =====
  // Scoped error display for components
  window.ErrorHandler = {
    show(elementId, message, type = 'error') {
      const element = document.getElementById(elementId);
      if (element) {
        element.innerHTML = `
          <div class="error-message ${type}">
            <span class="error-icon">⚠️</span>
            <span class="error-text">${message}</span>
          </div>
        `;
      }
    },

    clear(elementId) {
      const element = document.getElementById(elementId);
      if (element) {
        element.innerHTML = '';
      }
    }
  };

  // ===== Component Loader =====
  // Scoped loader for individual components
  window.ComponentLoader = {
    show(containerId, message = 'Loading...') {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Only show if not already showing
      if (container.querySelector('.component-loader')) return;

      const loaderHtml = `
        <div class="component-loader" aria-live="polite" aria-busy="true">
          <div class="loader-spinner" aria-hidden="true"></div>
          <span class="loader-text">${message}</span>
        </div>
      `;

      container.innerHTML = loaderHtml;
    },

    hide(containerId) {
      const container = document.getElementById(containerId);
      const loader = container?.querySelector('.component-loader');
      if (loader) {
        loader.remove();
      }
    },

    setMessage(containerId, message) {
      const container = document.getElementById(containerId);
      const loader = container?.querySelector('.loader-text');
      if (loader) {
        loader.textContent = message;
      }
    }
  };

  // ===== Component Error Handler =====
  // Scoped error boundary for individual components
  window.ComponentErrorHandler = {
    /**
     * Wrap async operation for specific component
     */
    wrap(containerId, asyncFn, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Container ${containerId} not found`);
        return;
      }

      const config = {
        showRetry: true,
        showDetails: false,
        retryText: 'Retry',
        ...options
      };

      return async function() {
        try {
          // Clear any existing error state
          this.clear(containerId);

          // Execute async function
          return await asyncFn();
        } catch (error) {
          this.showError(containerId, error, config);
        }
      }.bind(this);
    },

    /**
     * Show scoped error message within component container
     */
    showError(containerId, error, config) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const errorHtml = `
        <div class="component-error" role="alert" aria-live="polite">
          <div class="error-header">
            <span class="error-icon" aria-hidden="true">⚠️</span>
            <span class="error-title">Unable to load content</span>
          </div>
          <p class="error-message">Please try again</p>
          ${config.showRetry ? `
            <button class="error-retry-btn" onclick="location.reload()" autofocus>
              ${config.retryText}
            </button>
          ` : ''}
          ${config.showDetails ? `
            <details class="error-details">
              <summary>Technical details</summary>
              <pre>${error.message}</pre>
            </details>
          ` : ''}
        </div>
      `;

      container.innerHTML = errorHtml;

      // Accessibility: focus the retry button
      const retryBtn = container.querySelector('.error-retry-btn');
      if (retryBtn) {
        retryBtn.focus();
      }
    },

    /**
     * Clear error state
     */
    clear(containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        // Just clear, don't block UI
        container.innerHTML = '';
      }
    }
  };

  // ===== API Helper =====
  // Quick API call wrapper with common patterns
  window.ApiHelper = {
    /**
     * Fetch with timeout and error handling
     */
    async fetchWithTimeout(url, options = {}) {
      const { timeout = 30000, ...fetchOptions } = options;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },

    /**
     * Safe JSON parse
     */
    safeJsonParse(text, defaultValue = null) {
      try {
        return JSON.parse(text);
      } catch {
        return defaultValue;
      }
    },

    /**
     * Check if response is ok
     */
    async checkResponse(response) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    }
  };

  // ===== Utility Functions =====
  // General purpose utilities
  window.Utils = {
    /**
     * Debounce function calls
     */
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    /**
     * Deep clone an object
     */
    deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if value is empty (null, undefined, empty string, empty array, empty object)
     */
    isEmpty(value) {
      if (value == null) return true;
      if (typeof value === 'string') return value.trim() === '';
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    },

    /**
     * Generate unique ID
     */
    uid() {
      return Math.random().toString(36).substr(2, 9);
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }
  };

})();
