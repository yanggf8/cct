/**
 * CCT API Client v1
 * Centralized type-safe API client for CCT RESTful API v1 endpoints
 * Provides consistent interface for all frontend API interactions
 * Phase 3: Frontend API Client - Data Access Improvement Plan
 */

/**
 * Main CCT API Client Class
 */
class CCTApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/v1';
    this.apiKey = options.apiKey || this.getStoredApiKey() || 'yanggf';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.enableCache = options.enableCache !== false; // Enable by default
    this.cache = new Map(); // Simple in-memory cache for responses
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes default

    // Initialize API cache if enabled
    if (this.enableCache && typeof ApiCache !== 'undefined') {
      this.apiCache = new ApiCache({
        defaultTtl: this.cacheTimeout,
        maxSize: 100
      });
    }
  }

  /**
   * Get API key from localStorage
   */
  getStoredApiKey() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('cct-api-key');
    }
    return null;
  }

  /**
   * Store API key in localStorage
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.defaultHeaders['X-API-Key'] = apiKey;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cct-api-key', apiKey);
    }
  }

  /**
   * Core request method with error handling and caching
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${options.method || 'GET'}:${url}:${JSON.stringify(options.params || {})}`;

    // Check cache first for GET requests
    if (this.enableCache && (!options.method || options.method === 'GET')) {
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        return {
          ...cached,
          cached: true,
          cacheHit: true
        };
      }
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers: { ...this.defaultHeaders, ...options.headers },
    };

    // Add query parameters
    if (options.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      url += `?${searchParams.toString()}`;
    }

    // Add request body for POST/PUT requests
    if (options.body) {
      requestOptions.body = JSON.stringify(options.body);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful GET responses
      if (this.enableCache && response.ok && (!options.method || options.method === 'GET')) {
        this.setCachedResponse(cacheKey, data);
      }

      return {
        ...data,
        cached: false,
        cacheHit: false,
        requestId: response.headers.get('X-Request-ID'),
        apiVersion: response.headers.get('X-API-Version')
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      console.error('API Client Error:', error);
      throw error;
    }
  }

  /**
   * Cache management methods
   */
  getCachedResponse(key) {
    if (this.apiCache) {
      return this.apiCache.get(key);
    }

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCachedResponse(key, data) {
    if (this.apiCache) {
      return this.apiCache.set(key, data);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Simple cache cleanup - remove oldest if cache gets too large
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clearCache() {
    this.cache.clear();
    if (this.apiCache) {
      this.apiCache.clear();
    }
  }

  // ========================================
  // SENTIMENT ANALYSIS ENDPOINTS
  // ========================================

  /**
   * Get sentiment analysis for specified symbols
   * @param {string[]} symbols - Array of stock symbols
   * @param {Object} options - Additional options
   * @returns {Promise<SentimentAnalysisResponse>}
   */
  async getSentimentAnalysis(symbols = [], options = {}) {
    const params = {};
    if (symbols.length > 0) {
      params.symbols = symbols.join(',');
    }

    return this.request('/sentiment/analysis', {
      params: { ...params, ...options }
    });
  }

  /**
   * Get sentiment analysis for a single symbol
   * @param {string} symbol - Stock symbol
   * @param {Object} options - Additional options
   * @returns {Promise<SymbolSentimentResponse>}
   */
  async getSymbolSentiment(symbol, options = {}) {
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    return this.request(`/sentiment/symbols/${symbol}`, {
      params: options
    });
  }

  /**
   * Get market-wide sentiment analysis
   * @param {Object} options - Additional options
   * @returns {Promise<MarketSentimentResponse>}
   */
  async getMarketSentiment(options = {}) {
    return this.request('/sentiment/market', {
      params: options
    });
  }

  /**
   * Get sector sentiment analysis
   * @param {string[]} sectors - Array of sector symbols
   * @param {Object} options - Additional options
   * @returns {Promise<SectorSentimentResponse>}
   */
  async getSectorSentiment(sectors = [], options = {}) {
    const params = {};
    if (sectors.length > 0) {
      params.sectors = sectors.join(',');
    }

    return this.request('/sentiment/sectors', {
      params: { ...params, ...options }
    });
  }

  // ========================================
  // REPORT ENDPOINTS
  // ========================================

  /**
   * Get daily report for specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @param {Object} options - Additional options
   * @returns {Promise<DailyReportResponse>}
   */
  async getDailyReport(date, options = {}) {
    const reportDate = date || new Date().toISOString().split('T')[0];
    return this.request(`/reports/daily/${reportDate}`, {
      params: options
    });
  }

  /**
   * Get weekly report for specific week
   * @param {string} week - Week in YYYY-Www format
   * @param {Object} options - Additional options
   * @returns {Promise<WeeklyReportResponse>}
   */
  async getWeeklyReport(week, options = {}) {
    const reportWeek = week || this.getCurrentWeek();
    return this.request(`/reports/weekly/${reportWeek}`, {
      params: options
    });
  }

  /**
   * Get pre-market briefing report
   * @param {Object} options - Additional options
   * @returns {Promise<PreMarketReportResponse>}
   */
  async getPreMarketReport(options = {}) {
    return this.request('/reports/pre-market', {
      params: options
    });
  }

  /**
   * Get intray check report
   * @param {Object} options - Additional options
   * @returns {Promise<IntradayReportResponse>}
   */
  async getIntradayReport(options = {}) {
    return this.request('/reports/intraday', {
      params: options
    });
  }

  /**
   * Get end-of-day summary report
   * @param {Object} options - Additional options
   * @returns {Promise<EndOfDayReportResponse>}
   */
  async getEndOfDayReport(options = {}) {
    return this.request('/reports/end-of-day', {
      params: options
    });
  }

  // ========================================
  // DATA ENDPOINTS
  // ========================================

  /**
   * Get available trading symbols
   * @param {Object} options - Additional options
   * @returns {Promise<SymbolsResponse>}
   */
  async getAvailableSymbols(options = {}) {
    return this.request('/data/symbols', {
      params: options
    });
  }

  /**
   * Get historical data for a symbol
   * @param {string} symbol - Stock symbol
   * @param {Object} options - Additional options (period, interval, etc.)
   * @returns {Promise<HistoricalDataResponse>}
   */
  async getSymbolHistory(symbol, options = {}) {
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    return this.request(`/data/history/${symbol}`, {
      params: options
    });
  }

  /**
   * Get system health status
   * @param {Object} options - Additional options
   * @returns {Promise<SystemHealthResponse>}
   */
  async getSystemHealth(options = {}) {
    return this.request('/data/health', {
      params: options
    });
  }

  // ========================================
  // SECTORS ENDPOINTS
  // ========================================

  /**
   * Get sector rotation snapshot
   * @param {Object} options - Additional options
   * @returns {Promise<SectorSnapshotResponse>}
   */
  async getSectorSnapshot(options = {}) {
    return this.request('/sectors/snapshot', {
      params: options
    });
  }

  /**
   * Get sectors health status
   * @param {Object} options - Additional options
   * @returns {Promise<SectorHealthResponse>}
   */
  async getSectorHealth(options = {}) {
    return this.request('/sectors/health', {
      params: options
    });
  }

  /**
   * Get available sector symbols
   * @param {Object} options - Additional options
   * @returns {Promise<SectorSymbolsResponse>}
   */
  async getSectorSymbols(options = {}) {
    return this.request('/sectors/symbols', {
      params: options
    });
  }

  // ========================================
  // MARKET DRIVERS ENDPOINTS
  // ========================================

  /**
   * Get market drivers snapshot
   * @param {Object} options - Additional options
   * @returns {Promise<MarketDriversSnapshotResponse>}
   */
  async getMarketDriversSnapshot(options = {}) {
    return this.request('/market-drivers/snapshot', {
      params: options
    });
  }

  /**
   * Get enhanced market drivers snapshot
   * @param {Object} options - Additional options
   * @returns {Promise<EnhancedMarketDriversResponse>}
   */
  async getEnhancedMarketDriversSnapshot(options = {}) {
    return this.request('/market-drivers/snapshot/enhanced', {
      params: options
    });
  }

  /**
   * Get macro economic drivers
   * @param {Object} options - Additional options
   * @returns {Promise<MacroDriversResponse>}
   */
  async getMacroDrivers(options = {}) {
    return this.request('/market-drivers/macro', {
      params: options
    });
  }

  /**
   * Get market structure data
   * @param {Object} options - Additional options
   * @returns {Promise<MarketStructureResponse>}
   */
  async getMarketStructure(options = {}) {
    return this.request('/market-drivers/market-structure', {
      params: options
    });
  }

  /**
   * Get market regime information
   * @param {Object} options - Additional options
   * @returns {Promise<MarketRegimeResponse>}
   */
  async getMarketRegime(options = {}) {
    return this.request('/market-drivers/regime', {
      params: options
    });
  }

  /**
   * Get geopolitical risk data
   * @param {Object} options - Additional options
   * @returns {Promise<GeopoliticalResponse>}
   */
  async getGeopoliticalRisk(options = {}) {
    return this.request('/market-drivers/geopolitical', {
      params: options
    });
  }

  /**
   * Get market drivers history
   * @param {Object} options - Additional options
   * @returns {Promise<MarketDriversHistoryResponse>}
   */
  async getMarketDriversHistory(options = {}) {
    return this.request('/market-drivers/history', {
      params: options
    });
  }

  /**
   * Get market drivers health status
   * @param {Object} options - Additional options
   * @returns {Promise<MarketDriversHealthResponse>}
   */
  async getMarketDriversHealth(options = {}) {
    return this.request('/market-drivers/health', {
      params: options
    });
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get API documentation and available endpoints
   * @returns {Promise<ApiDocumentationResponse>}
   */
  async getApiDocumentation() {
    return this.request('/');
  }

  /**
   * Batch multiple requests in parallel
   * @param {Array<Function>} requests - Array of request functions
   * @returns {Promise<Array>} Array of responses
   */
  async batchRequests(requests) {
    try {
      return await Promise.all(requests.map(req => req()));
    } catch (error) {
      console.error('Batch request error:', error);
      throw error;
    }
  }

  /**
   * Get current week in YYYY-Www format
   */
  getCurrentWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Validate API key by making a test request
   * @returns {Promise<boolean>} True if key is valid
   */
  async validateApiKey() {
    try {
      await this.getSystemHealth();
      return true;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('UNAUTHORIZED')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache performance metrics
   */
  getCacheStats() {
    if (this.apiCache) {
      return this.apiCache.getStats();
    }

    return {
      size: this.cache.size,
      maxSize: 100,
      hitRate: 0, // Simple cache doesn't track hits
      type: 'simple'
    };
  }
}

// ========================================
  // CONVENIENCE METHODS
  // ========================================

/**
 * Comprehensive market analysis - gets sentiment, sectors, and market drivers
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Complete market analysis
 */
CCTApiClient.prototype.getComprehensiveAnalysis = async function(options = {}) {
  const { symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'] } = options;

  return this.batchRequests([
    () => this.getSentimentAnalysis(symbols),
    () => this.getMarketSentiment(),
    () => this.getSectorSnapshot(),
    () => this.getMarketDriversSnapshot()
  ]);
};

/**
 * Today's analysis - gets all reports for current date
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Today's complete analysis
 */
CCTApiClient.prototype.getTodaysAnalysis = async function(options = {}) {
  const today = new Date().toISOString().split('T')[0];

  return this.batchRequests([
    () => this.getDailyReport(today),
    () => this.getPreMarketReport(),
    () => this.getIntradayReport(),
    () => this.getEndOfDayReport()
  ]);
};

/**
 * Quick market check - fast overview of current market status
 * @param {Object} options - Check options
 * @returns {Promise<Object>} Quick market overview
 */
CCTApiClient.prototype.quickMarketCheck = async function(options = {}) {
  return this.batchRequests([
    () => this.getSystemHealth(),
    () => this.getMarketSentiment(),
    () => this.getSectorSnapshot()
  ]);
};

// Export for global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CCTApiClient;
}

// Create global instance
if (typeof window !== 'undefined') {
  window.CCTApiClient = CCTApiClient;

  // Initialize default client instance
  window.cctApi = new CCTApiClient({
    enableCache: true,
    timeout: 30000
  });
}