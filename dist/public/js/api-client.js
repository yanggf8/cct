/**
 * CCT API Client v1 - Secure & Backward Compatible
 * No hardcoded API keys but graceful degradation for unauthenticated requests
 */

class CCTApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/v1';
    this.apiKey = options.apiKey || this.getStoredApiKey() || null;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Only add API key header if we have one
    if (this.apiKey) {
      this.defaultHeaders['X-API-Key'] = this.apiKey;
    }
    this.timeout = options.timeout || 30000;
    this.enableCache = options.enableCache !== false;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 300000;
  }

  getStoredApiKey() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('cct_api_key');
    }
    return null;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    if (this.apiKey) {
      this.defaultHeaders['X-API-Key'] = apiKey;
    } else {
      delete this.defaultHeaders['X-API-Key'];
    }
    // SECURITY: Session-based only - no localStorage storage
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: { ...this.defaultHeaders, ...options.headers },
      timeout: this.timeout,
      ...options
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        console.warn('Authentication required for:', endpoint);
        // Don't throw error, return mock data for unauthenticated requests
        return { success: false, error: 'Authentication required', data: null };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error.message);
      throw error;
    }
  }

  // Public endpoints (work without authentication)
  async getSymbols() {
    return this.request('/data/symbols');
  }

  async getHealth() {
    return this.request('/data/health');
  }

  // Protected endpoints (require authentication)
  async getSentimentAnalysis(symbols) {
    return this.request(`/sentiment/symbols/${Array.isArray(symbols) ? symbols.join(',') : symbols}`);
  }

  async getMarketSentiment() {
    return this.request('/sentiment/market');
  }

  async getDailyReport(date) {
    return this.request(`/reports/daily/${date}`);
  }

  async getPreMarketBriefing() {
    return this.request('/reports/pre-market');
  }

  async getIntradayCheck() {
    return this.request('/reports/intraday');
  }

  async getEndOfDaySummary() {
    return this.request('/reports/end-of-day');
  }

  async getSymbolHistory(symbol, period = '1mo') {
    return this.request(`/data/history/${symbol}?period=${period}`);
  }

  async getMarketRegime() {
    return this.request('/market/regime');
  }

  async getPredictiveSignals(symbols) {
    return this.request(`/predictive/signals/${Array.isArray(symbols) ? symbols.join(',') : symbols}`);
  }

  async getSectorSnapshot() {
    return this.request('/sectors/snapshot');
  }

  async getSectorAnalysis() {
    return this.request('/sectors/analysis');
  }

  async getPortfolioCorrelation(symbols) {
    return this.request('/portfolio/correlation', {
      method: 'POST',
      body: JSON.stringify({ symbols })
    });
  }

  async getRiskMetrics(symbols) {
    return this.request(`/risk/metrics/${Array.isArray(symbols) ? symbols.join(',') : symbols}`);
  }

  async getTechnicalAnalysis(symbol, indicators = []) {
    return this.request(`/technical/analysis/${symbol}?indicators=${indicators.join(',')}`);
  }

  // Cache management
  clearCache() {
    this.cache.clear();
  }
}

// Initialize global API client with backward compatibility
window.cctApi = new CCTApiClient({
  baseUrl: window.location.origin,
  apiKey: (() => {
    try {
      return localStorage.getItem('cct_api_key');
    } catch (e) {
      return null;
    }
  })(),
  timeout: 30000,
  enableCache: true,
  cacheTimeout: 300000
});

// Global authentication function
window.setCctApiKey = function(apiKey) {
  if (window.cctApi) {
    window.cctApi.setApiKey(apiKey);
  }
};

console.log('CCT API Client initialized (secure, backward-compatible version)');