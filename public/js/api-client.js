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
    this.apiKey = options.apiKey || this.getStoredApiKey() || null;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Only add API key header if we have one
    if (this.apiKey) {
      this.defaultHeaders['X-API-Key'] = this.apiKey;
    }
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
    let url = `${this.baseUrl}${endpoint}`;
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
   * Get enhanced market regime details
   * @param {Object} options - Additional options
   * @returns {Promise<EnhancedRegimeResponse>}
   */
  async getEnhancedMarketRegime(options = {}) {
    return this.request('/market-drivers/regime/details', {
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

// ========================================
// PREDICTIVE ANALYTICS ENDPOINTS
// ========================================

/**
 * Get fine-grained sentiment analysis for symbols
 * @param {string|string[]} symbols - Stock symbol(s)
 * @param {Object} options - Additional options
 * @returns {Promise<FineGrainedSentimentResponse>}
 */
CCTApiClient.prototype.getFineGrainedSentiment = async function(symbols, options = {}) {
  const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];

  if (symbolsArray.length === 1) {
    return this.request(`/sentiment/fine-grained/${symbolsArray[0]}`, { params: options });
  } else {
    return this.request('/sentiment/fine-grained/batch', {
      method: 'POST',
      body: { symbols: symbolsArray, ...options }
    });
  }
};

/**
 * Get technical analysis for symbols
 * @param {string|string[]} symbols - Stock symbol(s)
 * @param {Object} options - Additional options
 * @returns {Promise<TechnicalAnalysisResponse>}
 */
CCTApiClient.prototype.getTechnicalAnalysis = async function(symbols, options = {}) {
  const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];

  if (symbolsArray.length === 1) {
    return this.request(`/technical/symbols/${symbolsArray[0]}`, { params: options });
  } else {
    return this.request('/technical/analysis', {
      method: 'POST',
      body: { symbols: symbolsArray, ...options }
    });
  }
};

/**
 * Get sector indicators for sector symbols
 * @param {string|string[]} symbols - Sector symbol(s)
 * @param {Object} options - Additional options
 * @returns {Promise<SectorIndicatorsResponse>}
 */
CCTApiClient.prototype.getSectorIndicators = async function(symbols, options = {}) {
  const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];
  const results = [];

  for (const symbol of symbolsArray) {
    const response = await this.request(`/sectors/indicators/${symbol}`, { params: options });
    if (response.success) {
      results.push(response.data);
    }
  }

  return { success: true, data: results };
};

/**
 * Get predictive signals and forecasts
 * @param {Object} options - Additional options (symbols, timeRange, includeForecasts)
 * @returns {Promise<PredictiveSignalsResponse>}
 */
CCTApiClient.prototype.getPredictiveSignals = async function(options = {}) {
  return this.request('/predictive/signals', { params: options });
};

/**
 * Get predictive patterns analysis
 * @param {Object} options - Additional options
 * @returns {Promise<PredictivePatternsResponse>}
 */
CCTApiClient.prototype.getPredictivePatterns = async function(options = {}) {
  return this.request('/predictive/patterns', { params: options });
};

/**
 * Get comprehensive predictive insights
 * @param {Object} options - Additional options
 * @returns {Promise<PredictiveInsightsResponse>}
 */
CCTApiClient.prototype.getPredictiveInsights = async function(options = {}) {
  return this.request('/predictive/insights', { params: options });
};

/**
 * Get market forecast
 * @param {Object} options - Additional options (timeframe, includeRisk, includeRegime)
 * @returns {Promise<MarketForecastResponse>}
 */
CCTApiClient.prototype.getMarketForecast = async function(options = {}) {
  return this.request('/predictive/forecast', { params: options });
};

/**
 * Get predictive analytics system health
 * @param {Object} options - Additional options
 * @returns {Promise<PredictiveHealthResponse>}
 */
CCTApiClient.prototype.getPredictiveHealth = async function(options = {}) {
  return this.request('/predictive/health', { params: options });
};

// ========================================
// REAL-TIME DATA ENDPOINTS
// ========================================

/**
 * Get real-time data status
 * @param {Object} options - Additional options
 * @returns {Promise<RealtimeStatusResponse>}
 */
CCTApiClient.prototype.getRealtimeStatus = async function(options = {}) {
  return this.request('/realtime/status', { params: options });
};

/**
 * Trigger real-time data refresh
 * @param {Object} options - Refresh options (priority, reason, symbols, incremental)
 * @returns {Promise<RealtimeRefreshResponse>}
 */
CCTApiClient.prototype.refreshRealtimeData = async function(options = {}) {
  return this.request('/realtime/refresh', {
    method: 'POST',
    body: options
  });
};

/**
 * Trigger pre-market cache warming
 * @param {Object} options - Warmup options (symbols)
 * @returns {Promise<RealtimeWarmupResponse>}
 */
CCTApiClient.prototype.warmupRealtimeCache = async function(options = {}) {
  return this.request('/realtime/warmup', {
    method: 'POST',
    body: options
  });
};

// ========================================
// ADVANCED ANALYTICS ENDPOINTS
// ========================================

/**
 * Compare multiple prediction models
 * @param {Object} options - Comparison options (symbols, models, timeRange)
 * @returns {Promise<ModelComparisonResponse>}
 */
CCTApiClient.prototype.getModelComparison = async function(options = {}) {
  return this.request('/analytics/model-comparison', {
    method: 'POST',
    body: options
  });
};

/**
 * Get confidence intervals for predictions
 * @param {Object} options - Options (symbols, confidenceLevel, timeRange, predictionType)
 * @returns {Promise<ConfidenceIntervalsResponse>}
 */
CCTApiClient.prototype.getConfidenceIntervals = async function(options = {}) {
  return this.request('/analytics/confidence-intervals', { params: options });
};

/**
 * Generate ensemble predictions
 * @param {Object} options - Ensemble options (symbols, models, ensembleMethod, timeRange)
 * @returns {Promise<EnsemblePredictionResponse>}
 */
CCTApiClient.prototype.getEnsemblePrediction = async function(options = {}) {
  return this.request('/analytics/ensemble-prediction', {
    method: 'POST',
    body: options
  });
};

/**
 * Get prediction accuracy metrics
 * @param {Object} options - Options (timeRange, models, sectors)
 * @returns {Promise<PredictionAccuracyResponse>}
 */
CCTApiClient.prototype.getPredictionAccuracy = async function(options = {}) {
  return this.request('/analytics/prediction-accuracy', { params: options });
};

/**
 * Get comprehensive risk assessment
 * @param {Object} options - Risk assessment options (symbols, portfolio, timeHorizon, riskTolerance)
 * @returns {Promise<RiskAssessmentResponse>}
 */
CCTApiClient.prototype.getRiskAssessment = async function(options = {}) {
  return this.request('/analytics/risk-assessment', {
    method: 'POST',
    body: options
  });
};

/**
 * Get detailed model performance metrics
 * @param {Object} options - Options (model, timeRange, metrics)
 * @returns {Promise<ModelPerformanceResponse>}
 */
CCTApiClient.prototype.getModelPerformance = async function(options = {}) {
  return this.request('/analytics/model-performance', { params: options });
};

/**
 * Run backtesting analysis
 * @param {Object} options - Backtest options (symbols, strategy, startDate, endDate, initialCapital)
 * @returns {Promise<BacktestResponse>}
 */
CCTApiClient.prototype.runBacktest = async function(options = {}) {
  return this.request('/analytics/backtest', {
    method: 'POST',
    body: options
  });
};

/**
 * Get advanced analytics system health
 * @param {Object} options - Additional options
 * @returns {Promise<AdvancedAnalyticsHealthResponse>}
 */
CCTApiClient.prototype.getAdvancedAnalyticsHealth = async function(options = {}) {
  return this.request('/analytics/health', { params: options });
};

// ========================================
// BACKTESTING ENDPOINTS
// ========================================

/**
   * Run a new backtest
   * @param {Object} config - Backtest configuration
   * @returns {Promise<BacktestRunResponse>}
   */
CCTApiClient.prototype.runBacktest = async function(config = {}) {
  return this.request('/backtesting/run', {
    method: 'POST',
    body: config
  });
};

/**
   * Get backtest run status
   * @param {string} runId - Backtest run ID
   * @returns {Promise<BacktestStatusResponse>}
   */
CCTApiClient.prototype.getBacktestStatus = async function(runId) {
  if (!runId) {
    throw new Error('Run ID is required');
  }
  return this.request(`/backtesting/status/${runId}`);
};

/**
   * Get detailed backtest results
   * @param {string} runId - Backtest run ID
   * @returns {Promise<BacktestResultsResponse>}
   */
CCTApiClient.prototype.getBacktestResults = async function(runId) {
  if (!runId) {
    throw new Error('Run ID is required');
  }
  return this.request(`/backtesting/results/${runId}`);
};

/**
   * Get backtest performance metrics
   * @param {string} runId - Backtest run ID
   * @returns {Promise<BacktestPerformanceResponse>}
   */
CCTApiClient.prototype.getBacktestPerformance = async function(runId) {
  if (!runId) {
    throw new Error('Run ID is required');
  }
  return this.request(`/backtesting/performance/${runId}`);
};

/**
   * Compare multiple backtest runs
   * @param {Object} options - Comparison options (runIds, metrics)
   * @returns {Promise<BacktestComparisonResponse>}
   */
CCTApiClient.prototype.compareBacktests = async function(options = {}) {
  return this.request('/backtesting/compare', {
    method: 'POST',
    body: options
  });
};

/**
   * Get backtest history with filtering
   * @param {Object} options - Filter options (status, strategy, dateFrom, dateTo, page, limit)
   * @returns {Promise<BacktestHistoryResponse>}
   */
CCTApiClient.prototype.getBacktestHistory = async function(options = {}) {
  return this.request('/backtesting/history', { params: options });
};

/**
   * Run backtest validation
   * @param {Object} options - Validation options (runId, validationType, confidenceLevel)
   * @returns {Promise<BacktestValidationResponse>}
   */
CCTApiClient.prototype.validateBacktest = async function(options = {}) {
  return this.request('/backtesting/validation', {
    method: 'POST',
    body: options
  });
};

/**
   * Run walk-forward optimization
   * @param {Object} options - Walk-forward options (strategy, symbols, trainingPeriod, testingPeriod)
   * @returns {Promise<WalkForwardResponse>}
   */
CCTApiClient.prototype.runWalkForward = async function(options = {}) {
  return this.request('/backtesting/walk-forward', {
    method: 'POST',
    body: options
  });
};

/**
   * Run Monte Carlo simulation
   * @param {Object} options - Monte Carlo options (runId, simulations, confidenceIntervals)
   * @returns {Promise<MonteCarloResponse>}
   */
CCTApiClient.prototype.runMonteCarlo = async function(options = {}) {
  return this.request('/backtesting/monte-carlo', {
    method: 'POST',
    body: options
  });
};

// ========================================
// BACKTESTING CONVENIENCE METHODS
// ========================================

/**
   * Get comprehensive backtest analysis
   * @param {string} runId - Backtest run ID
   * @returns {Promise<Object>} Complete backtest analysis
   */
CCTApiClient.prototype.getBacktestAnalysis = async function(runId) {
  if (!runId) {
    throw new Error('Run ID is required');
  }

  return this.batchRequests([
    () => this.getBacktestResults(runId),
    () => this.getBacktestPerformance(runId),
    () => this.getBacktestStatus(runId)
  ]);
};

/**
   * Create and run backtest with common configuration
   * @param {Object} options - Backtest options
   * @returns {Promise<Object>} Backtest run results
   */
CCTApiClient.prototype.quickBacktest = async function(options = {}) {
  const defaultConfig = {
    symbols: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
    strategy: 'default',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000,
    commission: 0.001,
    slippage: 0.0001
  };

  const config = { ...defaultConfig, ...options };

  // Run backtest
  const runResponse = await this.runBacktest(config);
  if (!runResponse.success) {
    throw new Error('Failed to start backtest');
  }

  const runId = runResponse.data.runId;

  // Poll for completion (simplified - in production would use WebSocket or SSE)
  let status = await this.getBacktestStatus(runId);
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max wait

  while (status.data.status !== 'completed' && status.data.status !== 'failed' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    status = await this.getBacktestStatus(runId);
    attempts++;
  }

  if (status.data.status === 'failed') {
    throw new Error(`Backtest failed: ${status.data.error?.message || 'Unknown error'}`);
  }

  if (status.data.status !== 'completed') {
    throw new Error('Backtest timed out');
  }

  // Get complete results
  return this.getBacktestAnalysis(runId);
};

/**
   * Compare strategy performance
   * @param {Array} strategies - Array of strategy configurations
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Strategy comparison results
   */
CCTApiClient.prototype.compareStrategies = async function(strategies = [], options = {}) {
  if (strategies.length < 2) {
    throw new Error('At least 2 strategies required for comparison');
  }

  const runIds = [];

  // Run all strategies in parallel
  const runPromises = strategies.map(async (strategy, index) => {
    const config = { ...strategy, ...options, name: `Strategy ${index + 1}` };
    const runResponse = await this.runBacktest(config);
    return runResponse.data.runId;
  });

  const resolvedRunIds = await Promise.all(runPromises);
  runIds.push(...resolvedRunIds);

  // Wait for all backtests to complete (simplified)
  await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds

  // Get comparison
  return this.compareBacktests({ runIds });
};

// Export for global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CCTApiClient;
}

// ========================================
// CACHE MONITORING API METHODS
// ========================================

/**
 * Get cache metrics
 * @returns {Promise<Object>} Cache performance metrics
 */
CCTApiClient.prototype.getCacheMetrics = async function() {
  return this.request('/cache/metrics');
};

/**
 * Get cache timestamps
 * @param {Object} options - Timestamp query options
 * @returns {Promise<Object>} Cache timestamp information
 */
CCTApiClient.prototype.getCacheTimestamps = async function(options = {}) {
  return this.request('/cache/timestamps', { params: options });
};

/**
 * Get cache debug information
 * @param {Object} options - Debug query options
 * @returns {Promise<Object>} Detailed cache debug information
 */
CCTApiClient.prototype.getCacheDebug = async function(options = {}) {
  return this.request('/cache/debug', { params: options });
};

/**
 * Get deduplication statistics
 * @param {Object} options - Deduplication query options
 * @returns {Promise<Object>} Request deduplication statistics
 */
CCTApiClient.prototype.getDeduplicationStats = async function(options = {}) {
  return this.request('/cache/deduplication', { params: options });
};

/**
 * Get cache health status
 * @returns {Promise<Object>} Cache health information
 */
CCTApiClient.prototype.getCacheHealth = async function() {
  return this.request('/cache/health');
};

/**
 * Trigger cache warmup
 * @param {Object} options - Warmup options
 * @returns {Promise<Object>} Warmup operation result
 */
CCTApiClient.prototype.warmupCache = async function(options = {}) {
  return this.request('/cache/warmup', {
    method: 'POST',
    body: options
  });
};

// Create global instance
if (typeof window !== 'undefined') {
  window.CCTApiClient = CCTApiClient;

  // Initialize default client instance
  window.cctApi = new CCTApiClient({
    enableCache: true,
    timeout: 30000
  });
}