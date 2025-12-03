/**
 * Business Intelligence Dashboard Client
 * Provides client-side functionality for real-time BI dashboards and cost-to-serve intelligence
 * Phase 3 Implementation: Frontend scaffolding for dashboard operations
 */

class BIDashboardClient {
  constructor(config = {}) {
    this.apiBase = config.apiBase || '/api/v1';
    this.cache = new Map();
    this.refreshInterval = config.refreshInterval || 300000; // 5 minutes default
    this.autoRefresh = config.autoRefresh !== false;
    this.refreshTimers = new Map();
    this.eventListeners = new Map();

    // Bind methods to maintain context
    this.fetchDashboardMetrics = this.fetchDashboardMetrics.bind(this);
    this.fetchCostToServeMetrics = this.fetchCostToServeMetrics.bind(this);
    this.fetchGuardViolationData = this.fetchGuardViolationData.bind(this);
    this.fetchDashboardHealth = this.fetchDashboardHealth.bind(this);
    this.refreshDashboardData = this.refreshDashboardData.bind(this);
  }

  /**
   * Generic API request handler with caching and error handling
   */
  async makeRequest(endpoint, options = {}) {
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;

    // Check cache first
    if (this.cache.has(cacheKey) && !options.bypassCache) {
      const cached = this.cache.get(cacheKey);
      const now = Date.now();

      if (now - cached.timestamp < cached.ttl * 1000) {
        console.debug(`Using cached data for ${endpoint}`);
        return cached.data;
      }
    }

    try {
      const url = `${this.apiBase}${endpoint}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.getApiKey(),
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`API error: ${data.error_code} - ${data.message}`);
      }

      // Cache successful responses
      const ttl = data.ttl || 300; // Default 5 minutes
      this.cache.set(cacheKey, {
        data: data.data,
        timestamp: Date.now(),
        ttl: ttl
      });

      return data.data;

    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);

      // Emit error event
      this.emit('error', { endpoint, error });

      // Return cached data if available as fallback
      if (this.cache.has(cacheKey)) {
        console.warn(`Returning cached fallback data for ${endpoint}`);
        return this.cache.get(cacheKey).data;
      }

      throw error;
    }
  }

  /**
   * Get API key from localStorage or environment
   */
  getApiKey() {
    return localStorage.getItem('api_key') || '';
  }

  /**
   * Set API key in localStorage
   */
  setApiKey(apiKey) {
    localStorage.setItem('api_key', apiKey);
  }

  /**
   * Fetch overall dashboard metrics
   */
  async fetchDashboardMetrics(options = {}) {
    return this.makeRequest('/dashboard/metrics', options);
  }

  /**
   * Fetch cost-to-serve metrics
   */
  async fetchCostToServeMetrics(options = {}) {
    return this.makeRequest('/dashboard/economics', options);
  }

  /**
   * Fetch guard violation monitoring data
   */
  async fetchGuardViolationData(options = {}) {
    const { activeOnly = false, severity = '', limit = 50, offset = 0 } = options;

    const params = new URLSearchParams();
    if (activeOnly) params.set('active_only', 'true');
    if (severity) params.set('severity', severity);
    if (limit !== 50) params.set('limit', limit.toString());
    if (offset !== 0) params.set('offset', offset.toString());

    const endpoint = `/dashboard/guards${params.toString() ? '?' + params.toString() : ''}`;
    return this.makeRequest(endpoint, options);
  }

  /**
   * Fetch dashboard system health
   */
  async fetchDashboardHealth(options = {}) {
    return this.makeRequest('/dashboard/health', options);
  }

  /**
   * Force refresh dashboard data
   */
  async refreshDashboardData(targets = ['all']) {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targets })
    };

    return this.makeRequest('/dashboard/refresh', options);
  }

  /**
   * Start auto-refresh for dashboard data
   */
  startAutoRefresh(components = ['metrics', 'economics', 'guards']) {
    if (!this.autoRefresh) return;

    components.forEach(component => {
      if (this.refreshTimers.has(component)) {
        clearInterval(this.refreshTimers.get(component));
      }

      const timer = setInterval(async () => {
        try {
          let data;
          switch (component) {
            case 'metrics':
              data = await this.fetchDashboardMetrics({ bypassCache: true });
              break;
            case 'economics':
              data = await this.fetchCostToServeMetrics({ bypassCache: true });
              break;
            case 'guards':
              data = await this.fetchGuardViolationData({ bypassCache: true });
              break;
          }

          this.emit(`${component}:updated`, data);
          this.emit('data:refreshed', { component, data });
        } catch (error) {
          this.emit(`${component}:error`, error);
        }
      }, this.refreshInterval);

      this.refreshTimers.set(component, timer);
      console.log(`Auto-refresh started for ${component} (interval: ${this.refreshInterval}ms)`);
    });
  }

  /**
   * Stop auto-refresh for dashboard components
   */
  stopAutoRefresh(components = null) {
    const targets = components || Array.from(this.refreshTimers.keys());

    targets.forEach(component => {
      if (this.refreshTimers.has(component)) {
        clearInterval(this.refreshTimers.get(component));
        this.refreshTimers.delete(component);
        console.log(`Auto-refresh stopped for ${component}`);
      }
    });
  }

  /**
   * Clear all cache data
   */
  clearCache() {
    this.cache.clear();
    console.log('Dashboard client cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([key, cached]) => now - cached.timestamp < cached.ttl * 1000).length,
      expiredEntries: entries.filter(([key, cached]) => now - cached.timestamp >= cached.ttl * 1000).length,
      cacheSize: JSON.stringify([...this.cache.entries()]).length
    };
  }

  /**
   * Event emitter functionality
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAutoRefresh();
    this.clearCache();
    this.eventListeners.clear();
    console.log('Dashboard client destroyed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BIDashboardClient;
} else if (typeof window !== 'undefined') {
  window.BIDashboardClient = BIDashboardClient;
}