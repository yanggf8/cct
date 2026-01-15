/**
 * CCT API Client - Centralized API Communication
 * All API requests go through this client with automatic auth handling
 */

class CCTApi {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/v1';
    this.timeout = options.timeout || 30000;
    this.apiKey = options.apiKey || this._getStoredKey();
  }

  // Get API key from multiple sources (priority: session > local > window)
  _getStoredKey() {
    try {
      return sessionStorage.getItem('cct_api_key') 
        || localStorage.getItem('cct_api_key') 
        || window.CCT_API_KEY 
        || '';
    } catch {
      return window.CCT_API_KEY || '';
    }
  }

  // Set API key (stores in both session and local)
  setApiKey(key) {
    this.apiKey = key;
    try {
      if (key) {
        sessionStorage.setItem('cct_api_key', key);
        localStorage.setItem('cct_api_key', key);
      } else {
        sessionStorage.removeItem('cct_api_key');
        localStorage.removeItem('cct_api_key');
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
    const url = `${this.baseUrl}${path}`;
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

    const response = await fetch(url, config);
    
    if (response.status === 401) {
      console.warn('API authentication failed - check API key');
      if (this.onUnauthorized) this.onUnauthorized();
      throw new Error('Unauthorized - API key required');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
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
  getJobsHistory(limit) { return this.jobsHistory(limit); }

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
