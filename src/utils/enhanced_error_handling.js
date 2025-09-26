/**
 * Enhanced Error Handling and Circuit Breaker System for Hybrid Architecture
 * Supports ModelScope Custom Models + DeepSeek V3.1 + Cloudflare AI integration
 */

// ============================================================================
// ENHANCED CIRCUIT BREAKER SYSTEM
// ============================================================================

class CircuitBreakerManager {
  constructor() {
    this.breakers = {
      // ModelScope services
      modelscope_custom: {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
        threshold: 3,
        recoveryTimeMs: 5 * 60 * 1000, // 5 minutes
        timeoutMs: 30000, // 30 seconds
        description: 'ModelScope Custom TFT+N-HITS deployment'
      },
      
      deepseek_sentiment: {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
        threshold: 5,
        recoveryTimeMs: 3 * 60 * 1000, // 3 minutes
        timeoutMs: 15000, // 15 seconds
        description: 'ModelScope DeepSeek V3.1 sentiment analysis'
      },
      
      // External services
      yahoo_finance: {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
        threshold: 5,
        recoveryTimeMs: 2 * 60 * 1000, // 2 minutes
        timeoutMs: 10000, // 10 seconds
        description: 'Yahoo Finance market data API'
      },
      
      cloudflare_ai: {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
        threshold: 3,
        recoveryTimeMs: 5 * 60 * 1000, // 5 minutes
        timeoutMs: 20000, // 20 seconds
        description: 'Cloudflare AI Workers (fallback sentiment)'
      },
      
      facebook_messenger: {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
        threshold: 3,
        recoveryTimeMs: 10 * 60 * 1000, // 10 minutes
        timeoutMs: 10000, // 10 seconds
        description: 'Facebook Messenger API'
      }
    };
  }

  /**
   * Update circuit breaker state based on operation success/failure
   */
  updateState(serviceName, success, errorDetails = null) {
    const breaker = this.breakers[serviceName];
    if (!breaker) {
      console.warn(`⚠️ Unknown circuit breaker service: ${serviceName}`);
      return;
    }

    const timestamp = Date.now();

    if (success) {
      // Reset on success
      breaker.failures = 0;
      breaker.isOpen = false;
      console.log(`🟢 ${serviceName} circuit breaker: Success - Reset failures`);
    } else {
      // Increment failures
      breaker.failures++;
      breaker.lastFailureTime = timestamp;
      
      // Open circuit breaker if threshold exceeded
      if (breaker.failures >= breaker.threshold) {
        breaker.isOpen = true;
        console.log(`🔴 ${serviceName} circuit breaker: OPEN (${breaker.failures} failures) - ${breaker.description}`);
        
        // Log error details for debugging
        if (errorDetails) {
          console.log(`🔍 Error details for ${serviceName}:`, {
            type: errorDetails.type || 'unknown',
            message: errorDetails.message?.substring(0, 200),
            status: errorDetails.status,
            timestamp: new Date(timestamp).toISOString()
          });
        }
      } else {
        console.log(`🟡 ${serviceName} circuit breaker: Failure ${breaker.failures}/${breaker.threshold}`);
      }
    }
  }

  /**
   * Check if circuit breaker is open for a service
   */
  isOpen(serviceName) {
    const breaker = this.breakers[serviceName];
    if (!breaker) return false;

    if (!breaker.isOpen) return false;

    // Check if recovery time has passed
    const timeSinceFailure = Date.now() - breaker.lastFailureTime;
    if (timeSinceFailure > breaker.recoveryTimeMs) {
      breaker.isOpen = false;
      breaker.failures = Math.floor(breaker.failures / 2); // Partial reset
      console.log(`🟢 ${serviceName} circuit breaker: CLOSED (recovery time passed)`);
      return false;
    }

    return true;
  }

  /**
   * Get timeout for a service
   */
  getTimeout(serviceName) {
    const breaker = this.breakers[serviceName];
    return breaker ? breaker.timeoutMs : 10000; // Default 10s
  }

  /**
   * Get system status for all circuit breakers
   */
  getSystemStatus() {
    const status = {};
    Object.entries(this.breakers).forEach(([service, breaker]) => {
      status[service] = {
        isOpen: this.isOpen(service),
        failures: breaker.failures,
        threshold: breaker.threshold,
        lastFailureTime: breaker.lastFailureTime > 0 ? 
          new Date(breaker.lastFailureTime).toISOString() : null,
        description: breaker.description
      };
    });
    return status;
  }

  /**
   * Force reset a circuit breaker (for manual recovery)
   */
  forceReset(serviceName) {
    const breaker = this.breakers[serviceName];
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      breaker.lastFailureTime = 0;
      console.log(`🔄 ${serviceName} circuit breaker: FORCE RESET`);
    }
  }
}

// Global circuit breaker instance
const circuitBreakerManager = new CircuitBreakerManager();

// ============================================================================
// ERROR CLASSIFICATION AND HANDLING
// ============================================================================

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      NETWORK_ERROR: 'network_error',
      TIMEOUT_ERROR: 'timeout_error', 
      API_ERROR: 'api_error',
      PARSING_ERROR: 'parsing_error',
      RATE_LIMIT_ERROR: 'rate_limit_error',
      AUTH_ERROR: 'auth_error',
      SERVICE_UNAVAILABLE: 'service_unavailable',
      UNKNOWN_ERROR: 'unknown_error'
    };
  }

  /**
   * Classify error and determine appropriate response
   */
  classifyError(error, serviceName, response = null) {
    let errorType = this.errorTypes.UNKNOWN_ERROR;
    let shouldRetry = false;
    let retryDelayMs = 1000;
    let shouldOpenCircuit = true;

    // Network/connection errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      errorType = this.errorTypes.TIMEOUT_ERROR;
      shouldRetry = true;
      retryDelayMs = 2000;
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorType = this.errorTypes.NETWORK_ERROR;
      shouldRetry = true;
      retryDelayMs = 1500;
    }

    // HTTP status code errors
    if (response) {
      const status = response.status;
      
      if (status === 401 || status === 403) {
        errorType = this.errorTypes.AUTH_ERROR;
        shouldRetry = false;
        shouldOpenCircuit = false; // Don't open circuit for auth issues
      } else if (status === 429) {
        errorType = this.errorTypes.RATE_LIMIT_ERROR;
        shouldRetry = true;
        retryDelayMs = 5000; // Longer delay for rate limits
      } else if (status >= 500) {
        errorType = this.errorTypes.SERVICE_UNAVAILABLE;
        shouldRetry = true;
        retryDelayMs = 3000;
      } else if (status >= 400) {
        errorType = this.errorTypes.API_ERROR;
        shouldRetry = false;
      }
    }

    // JSON parsing errors
    if (error instanceof SyntaxError || error.message.includes('JSON')) {
      errorType = this.errorTypes.PARSING_ERROR;
      shouldRetry = true; // Might be temporary API response issue
      retryDelayMs = 1000;
    }

    return {
      type: errorType,
      shouldRetry,
      retryDelayMs,
      shouldOpenCircuit,
      classification: {
        severity: this.getErrorSeverity(errorType),
        recoverable: shouldRetry,
        userImpact: this.getUserImpact(serviceName, errorType)
      }
    };
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(errorType) {
    switch (errorType) {
      case this.errorTypes.AUTH_ERROR:
      case this.errorTypes.SERVICE_UNAVAILABLE:
        return 'HIGH';
      case this.errorTypes.TIMEOUT_ERROR:
      case this.errorTypes.RATE_LIMIT_ERROR:
        return 'MEDIUM';
      case this.errorTypes.PARSING_ERROR:
      case this.errorTypes.NETWORK_ERROR:
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  /**
   * Assess user impact of service failure
   */
  getUserImpact(serviceName, errorType) {
    if (serviceName === 'modelscope_custom') {
      return 'HIGH'; // Core prediction functionality
    } else if (serviceName === 'deepseek_sentiment') {
      return 'MEDIUM'; // Sentiment analysis important but not critical
    } else if (serviceName === 'yahoo_finance') {
      return 'HIGH'; // No market data = no predictions
    } else if (serviceName === 'facebook_messenger') {
      return 'LOW'; // Notification delivery
    }
    return 'MEDIUM';
  }
}

const errorHandler = new ErrorHandler();

// ============================================================================
// RESILIENT API CLIENT
// ============================================================================

class ResilientApiClient {
  constructor() {
    this.defaultRetryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      exponentialBackoff: true
    };
  }

  /**
   * Make resilient API call with circuit breaker protection and retry logic
   */
  async makeResilientCall(serviceName, apiCall, options = {}) {
    const config = { ...this.defaultRetryConfig, ...options };
    let lastError = null;
    
    // Check circuit breaker
    if (circuitBreakerManager.isOpen(serviceName)) {
      throw new Error(`${serviceName} circuit breaker is open`);
    }

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Set up timeout
        const timeoutMs = circuitBreakerManager.getTimeout(serviceName);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const result = await apiCall(controller.signal);
          clearTimeout(timeoutId);
          
          // Success - update circuit breaker
          circuitBreakerManager.updateState(serviceName, true);
          
          if (attempt > 0) {
            console.log(`✅ ${serviceName} recovered on attempt ${attempt + 1}`);
          }
          
          return result;
          
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
        
      } catch (error) {
        lastError = error;
        
        // Classify error and determine response
        const errorInfo = errorHandler.classifyError(error, serviceName);
        
        // Update circuit breaker if needed
        if (errorInfo.shouldOpenCircuit) {
          circuitBreakerManager.updateState(serviceName, false, {
            type: errorInfo.type,
            message: error.message,
            status: error.status
          });
        }

        // Check if we should retry
        if (!errorInfo.shouldRetry || attempt >= config.maxRetries) {
          console.log(`❌ ${serviceName} failed permanently: ${errorInfo.type} - ${error.message}`);
          break;
        }

        // Calculate retry delay
        let delay = errorInfo.retryDelayMs;
        if (config.exponentialBackoff) {
          delay = Math.min(
            config.baseDelayMs * Math.pow(2, attempt),
            config.maxDelayMs
          );
        }

        console.log(`🔄 ${serviceName} retry ${attempt + 1}/${config.maxRetries} in ${delay}ms (${errorInfo.type})`);
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw new Error(`${serviceName} failed after ${config.maxRetries} retries: ${lastError.message}`);
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const resilientClient = new ResilientApiClient();

// ============================================================================
// SERVICE-SPECIFIC ERROR HANDLERS
// ============================================================================

/**
 * Enhanced ModelScope Custom Model API call with comprehensive error handling
 */
async function callModelScopeCustomAPI(symbols, ohlcvData, currentPrices, env) {
  return await resilientClient.makeResilientCall(
    'modelscope_custom',
    async (signal) => {
      const payload = {
        symbols: symbols,
        ohlcv_data: ohlcvData,
        current_prices: currentPrices,
        config: {
          batch_size: symbols.length,
          timeout: 25000,
          ensemble_mode: 'dual_active'
        }
      };

      const response = await fetch(env.MODELSCOPE_CUSTOM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Request-ID': `cfw-${Date.now()}`
        },
        body: JSON.stringify(payload),
        signal: signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`ModelScope Custom API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        error.responseText = errorText;
        throw error;
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data.predictions) {
        throw new Error('Invalid response structure: missing predictions');
      }

      return data;
    },
    {
      maxRetries: 2, // Fewer retries for expensive custom model calls
      baseDelayMs: 2000,
      exponentialBackoff: true
    }
  );
}

/**
 * Enhanced DeepSeek V3.1 sentiment analysis with error handling
 */
async function callDeepSeekSentimentAPI(symbol, textToAnalyze, env) {
  return await resilientClient.makeResilientCall(
    'deepseek_sentiment',
    async (signal) => {
      const prompt = `As a financial analyst, analyze this news about ${symbol}: "${textToAnalyze}"

Provide comprehensive analysis in JSON format:
{
  "overall_sentiment": "POSITIVE/NEGATIVE/NEUTRAL",
  "sentiment_score": 0.0-1.0,
  "market_impact": "HIGH/MEDIUM/LOW/MINIMAL",
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation of sentiment drivers",
  "aspects": {
    "technical": {"score": -1.0-1.0, "reasoning": "technical analysis impact"},
    "fundamental": {"score": -1.0-1.0, "reasoning": "fundamental business impact"}
  }
}`;

      const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3.1',
          messages: [
            {
              role: 'system',
              content: 'You are an expert financial analyst. Always respond with valid JSON only.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 400,
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        signal: signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        error.responseText = errorText;
        throw error;
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid DeepSeek response structure');
      }

      const content = data.choices[0].message.content;
      
      try {
        const sentimentData = JSON.parse(content);
        return sentimentData;
      } catch (parseError) {
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error(`Failed to parse DeepSeek response: ${parseError.message}`);
      }
    },
    {
      maxRetries: 3,
      baseDelayMs: 1000,
      exponentialBackoff: true
    }
  );
}

/**
 * Enhanced Facebook Messenger API call with error handling
 */
async function callFacebookMessengerAPI(messageText, env) {
  return await resilientClient.makeResilientCall(
    'facebook_messenger',
    async (signal) => {
      const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
        },
        body: JSON.stringify({
          recipient: { id: env.FACEBOOK_RECIPIENT_ID },
          message: { text: messageText },
          messaging_type: 'UPDATE'
        }),
        signal: signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(`Facebook API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        error.errorData = errorData;
        throw error;
      }

      return await response.json();
    },
    {
      maxRetries: 2,
      baseDelayMs: 1500,
      exponentialBackoff: true
    }
  );
}

// ============================================================================
// SYSTEM HEALTH MONITORING
// ============================================================================

class SystemHealthMonitor {
  constructor() {
    this.healthMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      serviceHealth: {},
      lastUpdateTime: Date.now()
    };
  }

  /**
   * Record system event for health monitoring
   */
  recordEvent(service, success, latencyMs = 0) {
    this.healthMetrics.totalRequests++;
    
    if (success) {
      this.healthMetrics.successfulRequests++;
    } else {
      this.healthMetrics.failedRequests++;
    }

    // Track per-service metrics
    if (!this.healthMetrics.serviceHealth[service]) {
      this.healthMetrics.serviceHealth[service] = {
        requests: 0,
        successes: 0,
        failures: 0,
        avgLatency: 0,
        lastLatency: 0
      };
    }

    const serviceMetrics = this.healthMetrics.serviceHealth[service];
    serviceMetrics.requests++;
    serviceMetrics.lastLatency = latencyMs;
    
    if (success) {
      serviceMetrics.successes++;
      // Update rolling average latency
      serviceMetrics.avgLatency = (
        (serviceMetrics.avgLatency * (serviceMetrics.successes - 1)) + latencyMs
      ) / serviceMetrics.successes;
    } else {
      serviceMetrics.failures++;
    }

    this.healthMetrics.lastUpdateTime = Date.now();
  }

  /**
   * Get comprehensive system health report
   */
  getHealthReport() {
    const totalRequests = this.healthMetrics.totalRequests;
    const successRate = totalRequests > 0 ? 
      (this.healthMetrics.successfulRequests / totalRequests) * 100 : 100;

    const report = {
      overall: {
        status: successRate > 95 ? 'healthy' : successRate > 80 ? 'degraded' : 'unhealthy',
        success_rate: successRate.toFixed(2),
        total_requests: totalRequests,
        uptime_minutes: Math.floor((Date.now() - this.healthMetrics.lastUpdateTime) / 60000)
      },
      services: {},
      circuit_breakers: circuitBreakerManager.getSystemStatus(),
      timestamp: new Date().toISOString()
    };

    // Add per-service health
    Object.entries(this.healthMetrics.serviceHealth).forEach(([service, metrics]) => {
      const serviceSuccessRate = metrics.requests > 0 ? 
        (metrics.successes / metrics.requests) * 100 : 100;

      report.services[service] = {
        status: serviceSuccessRate > 90 ? 'healthy' : serviceSuccessRate > 70 ? 'degraded' : 'unhealthy',
        success_rate: serviceSuccessRate.toFixed(2),
        requests: metrics.requests,
        avg_latency_ms: Math.round(metrics.avgLatency),
        last_latency_ms: metrics.lastLatency
      };
    });

    return report;
  }

  /**
   * Reset health metrics (for daily/weekly reports)
   */
  resetMetrics() {
    this.healthMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      serviceHealth: {},
      lastUpdateTime: Date.now()
    };
  }
}

const healthMonitor = new SystemHealthMonitor();

// ============================================================================
// EXPORTS
// ============================================================================

// Export all enhanced error handling components
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CircuitBreakerManager,
    ErrorHandler,
    ResilientApiClient,
    SystemHealthMonitor,
    // Instances
    circuitBreakerManager,
    errorHandler,
    resilientClient,
    healthMonitor,
    // Enhanced API functions
    callModelScopeCustomAPI,
    callDeepSeekSentimentAPI,
    callFacebookMessengerAPI
  };
}