/**
 * CCT API Client - Centralized API Communication
 * All API requests go through this client with automatic auth handling
 */

class CCTApi {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/v1';
    this.timeout = options.timeout || 30000;
    this.apiKey = options.apiKey || this._getStoredKey();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      maxTotalTimeout: 30000
    };
    this.requestInterceptors = [];
    this.responseInterceptors = [];
  }

  // Get API key (priority: localStorage > sessionStorage > window fallback)
  _getStoredKey() {
    try {
      return localStorage.getItem('cct_api_key') || sessionStorage.getItem('cct_api_key') || window.CCT_API_KEY || '';
    } catch {
      return window.CCT_API_KEY || '';
    }
  }

  // Set API key (persisted in localStorage for cross-session access)
  setApiKey(key) {
    this.apiKey = key;
    try {
      if (key) {
        localStorage.setItem('cct_api_key', key);
        sessionStorage.setItem('cct_api_key', key); // Also session for immediate use
      } else {
        localStorage.removeItem('cct_api_key');
        sessionStorage.removeItem('cct_api_key');
      }
    } catch {}
  }

  // Check if authenticated
  isAuthenticated() {
    return !!this.apiKey;
  }

  // Core request method - always sends API key
  async request(endpoint, options = {}) {
    // Handle empty endpoint (for apiRoot) - don't add trailing slash
    const path = endpoint === '' ? '' : (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
    const base = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const url = `${base}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Always add API key
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const config = {
      method: options.method || 'GET',
      headers,
      ...options
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    // Add timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    config.signal = controller.signal;

    try {
      // Apply request interceptors with safe defaults
      const interceptedConfig = this.requestInterceptors.reduce(
        (currentConfig, interceptor) => interceptor(currentConfig),
        config
      );

      const response = await fetch(url, interceptedConfig);
      clearTimeout(timeoutId);

      // Apply response interceptors
      const processedResponse = this.responseInterceptors.reduce(
        (currentResponse, interceptor) => interceptor(currentResponse),
        response
      );

      if (response.status === 401) {
        console.warn('API authentication failed - check API key');
        if (this.onUnauthorized) this.onUnauthorized();
        throw new Error('Unauthorized - API key required');
      }

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return processedResponse.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Bounded retry with retryCount defaulting to 0
      const retryCount = options.retryCount || 0;

      if (this.shouldRetry(error) && retryCount < this.retryConfig.maxRetries) {
        const delay = this.calculateDelay(retryCount);
        await this.delay(delay);

        // Recursive call with incremented retryCount
        return this.request(endpoint, {
          ...options,
          retryCount: retryCount + 1
        });
      }

      throw error;
    }
  }

  shouldRetry(error) {
    // Only retry on specific errors, not 401 (auth errors shouldn't retry)
    return error.name === 'AbortError' ||
           error.message.includes('timeout') ||
           error.message.includes('Failed to fetch') ||
           (error.message.includes('API Error: 5') && !error.message.includes('401'));
  }

  calculateDelay(attempt) {
    const exponentialDelay = this.retryConfig.baseDelay *
      Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Request/Response interceptors with safe defaults
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  // GET request
  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url);
  }

  // POST request
  post(endpoint, body = {}) {
    return this.request(endpoint, { method: 'POST', body });
  }

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ============ API Methods ============

  // Health & Status
  health() { return this.get('/data/health'); }
  symbols() { return this.get('/data/symbols'); }
  getHealth() { return this.health(); }
  getSymbols() { return this.symbols(); }

  // Sentiment
  sentiment(symbols) { return this.get('/sentiment/analysis', { symbols: symbols?.join(',') }); }
  sentimentSymbol(symbol) { return this.get(`/sentiment/symbols/${symbol}`); }
  marketSentiment() { return this.get('/sentiment/market'); }
  getSentimentAnalysis(symbols) { return this.sentiment(symbols); }
  getMarketSentiment() { return this.marketSentiment(); }

  // Reports
  preMarket() { return this.get('/reports/pre-market'); }
  intraday() { return this.get('/reports/intraday'); }
  endOfDay() { return this.get('/reports/end-of-day'); }
  weekly() { return this.get('/reports/weekly'); }
  dailyReport(date) { return this.get(`/reports/daily/${date}`); }
  getPreMarketBriefing() { return this.preMarket(); }
  getIntradayCheck() { return this.intraday(); }
  getEndOfDaySummary() { return this.endOfDay(); }

  // Market Data
  marketDrivers() { return this.get('/market-drivers/snapshot'); }
  marketRegime() { return this.get('/market-drivers/regime'); }
  marketIntelligence() { return this.get('/market-intelligence/dashboard'); }
  getMarketDriversSnapshot() { return this.marketDrivers(); }
  getMarketRegime() { return this.marketRegime(); }

  // Sectors
  sectors() { return this.get('/sectors/snapshot'); }
  sectorRotation() { return this.get('/sector-rotation/results'); }
  getSectorSnapshot() { return this.sectors(); }
  getSectorRotation() { return this.sectorRotation(); }

  // Predictive
  predictiveSignals() { return this.get('/predictive/signals'); }
  predictiveForecast() { return this.get('/predictive/forecast'); }
  predictiveInsights() { return this.get('/predictive/insights'); }
  getPredictiveSignals() { return this.predictiveSignals(); }
  getPredictiveInsights() { return this.predictiveInsights(); }

  // Technical
  technical(symbol) { return this.get(`/technical/symbols/${symbol}`); }

  // Dashboard
  dashboardMetrics() { return this.get('/dashboard/metrics'); }
  dashboardEconomics() { return this.get('/dashboard/economics'); }

  // Cache
  cacheHealth() { return this.get('/cache/health'); }
  cacheMetrics() { return this.get('/cache/metrics'); }

  // History
  history(symbol) { return this.get(`/data/history/${symbol}`); }
  getHistory(symbol) { return this.history(symbol); }

  // Realtime
  realtimeStatus() { return this.get('/realtime/status'); }
  getRealtimeStatus() { return this.realtimeStatus(); }

  // Backtesting
  backtestHistory() { return this.get('/backtesting/history'); }
  backtestResults(backtestId) { return this.get(`/backtesting/results/${backtestId}`); }
  backtestPerformance(backtestId) { return this.get(`/backtesting/performance/${backtestId}`); }
  backtestStatus(backtestId) { return this.get(`/backtesting/status/${backtestId}`); }
  runBacktest(config) { return this.post('/backtesting/run', config); }
  getBacktestHistory() { return this.backtestHistory(); }
  getBacktestResults(backtestId) { return this.backtestResults(backtestId); }
  getBacktestPerformance(backtestId) { return this.backtestPerformance(backtestId); }

  // Settings
  getTimezone() { return this.get('/settings/timezone'); }
  setTimezone(tz) { return this.request('/settings/timezone', { method: 'PUT', body: { timezone: tz } }); }

  // Jobs
  jobsHistory(limit = 50) { return this.get('/jobs/history', { limit }); }
  jobsLatest() { return this.get('/jobs/latest'); }
  jobRuns(limit = 50) { return this.get('/jobs/runs', { limit }); }
  deleteJobRun(runId) { return this.delete(`/jobs/runs/${encodeURIComponent(runId)}`); }
  triggerJob(jobType, symbols) {
    // Map job types to endpoints/trigger modes
    if (jobType === 'pre-market') return this.post('/jobs/pre-market', { symbols });
    if (jobType === 'intraday') return this.post('/jobs/intraday', { symbols });
    // end-of-day and weekly use generic trigger endpoint
    const triggerModes = {
      'end-of-day': 'next_day_market_prediction',
      'weekly': 'weekly_review_analysis'
    };
    return this.post('/jobs/trigger', { triggerMode: triggerModes[jobType] || jobType, symbols });
  }
  getJobsHistory(limit) { return this.jobsHistory(limit); }
  getJobRuns(limit) { return this.jobRuns(limit); }

  // System
  systemStatus() { return this.get('/data/system-status'); }
  getSystemStatus() { return this.systemStatus(); }
  apiRoot() { return this.request('', { method: 'GET' }); }

  // Notifications
  notificationsSubscribe(subscription) { return this.post('/notifications/subscribe', subscription); }
}

// Create singleton instance
const cctApi = new CCTApi();

// Export for global access
window.cctApi = cctApi;
window.CCTApi = CCTApi;
