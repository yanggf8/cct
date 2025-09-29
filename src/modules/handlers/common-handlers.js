/**
 * Common Handler Patterns and Utilities
 * Shared functionality to reduce code duplication across handlers
 */

import { createLogger } from '../logging.js';
import { createHandler } from '../handler-factory.js';
import {
  generateCompletePage,
  generateWaitingDisplay,
  generateErrorDisplay,
  generateMetricsGrid,
  generateSuccessDisplay
} from '../html-generators.js';
import { validateDependencies } from '../kv-utils.js';
import { verifyDependencyConsistency } from '../kv-consistency.js';

const logger = createLogger('common-handlers');

/**
 * Create a standardized report handler with dependency validation
 * @param {string} name - Handler name
 * @param {Array<string>} dependencies - Required dependencies
 * @param {Function} reportGenerator - Function to generate report data
 * @param {Function} htmlGenerator - Function to generate HTML from data
 * @param {Object} options - Handler options
 * @returns {Function} Handler function
 */
export function createReportHandler(name, dependencies, reportGenerator, htmlGenerator, options = {}) {
  const {
    title,
    description,
    enableMetrics = true,
    timeout = 30000
  } = options;

  return createHandler(name, async (request, env) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    logger.info(`📊 [${name.toUpperCase()}] Starting report generation`, {
      requestId,
      date: dateStr,
      dependencies
    });

    try {
      // Enhanced dependency validation with consistency checking
      logger.debug(`🔗 [${name.toUpperCase()}] Checking dependencies`, { requestId, dependencies });

      const validation = await validateDependencies(dateStr, dependencies, env);

      if (!validation.isValid) {
        logger.warn(`⚠️ [${name.toUpperCase()}] Dependencies not satisfied`, {
          requestId,
          missing: validation.missing,
          completionRate: validation.completionRate
        });

        // For enhanced consistency, try KV consistency check
        let consistencyResults = null;
        try {
          consistencyResults = await verifyDependencyConsistency(dateStr, dependencies, env);
          logger.debug(`🔄 [${name.toUpperCase()}] KV consistency check results`, {
            requestId,
            consistentJobs: consistencyResults.consistentJobs,
            inconsistentJobs: consistencyResults.inconsistentJobs
          });
        } catch (consistencyError) {
          logger.debug(`🔄 [${name.toUpperCase()}] KV consistency check failed`, {
            requestId,
            error: consistencyError.message
          });
        }

        const waitingContent = generateWaitingDisplay(
          `${name.replace(/-/g, ' ').toUpperCase()} - Waiting for Required Data`,
          {
            missing: validation.missing,
            completionRate: validation.completionRate,
            consistencyResults
          }
        );

        return new Response(generateCompletePage(title, description, waitingContent), {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      logger.debug(`✅ [${name.toUpperCase()}] Dependencies satisfied, generating report`, { requestId });

      // Generate report data
      const reportData = await reportGenerator(env, dateStr, { requestId });

      // Generate HTML from report data
      const content = await htmlGenerator(reportData, dateStr, env, { requestId });

      logger.info(`✅ [${name.toUpperCase()}] Report generated successfully`, {
        requestId,
        duration: Date.now() - startTime,
        dataSize: content.length
      });

      return new Response(generateCompletePage(title, description, content), {
        headers: { 'Content-Type': 'text/html' }
      });

    } catch (error) {
      logger.error(`❌ [${name.toUpperCase()}] Report generation failed`, {
        requestId,
        error: error.message,
        stack: error.stack
      });

      const errorContent = generateErrorDisplay(
        `Failed to generate ${name.replace(/-/g, ' ')} report`,
        {
          error: error.message,
          requestId,
          timestamp: new Date().toISOString()
        }
      );

      return new Response(generateCompletePage(title, description, errorContent, 'Error'), {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }, {
    enableMetrics,
    timeout
  });
}

/**
 * Create a standardized API handler with error handling
 * @param {string} name - Handler name
 * @param {Function} apiFunction - Main API function
 * @param {Object} options - Handler options
 * @returns {Function} Handler function
 */
export function createAPIHandler(name, apiFunction, options = {}) {
  const {
    enableAuth = false,
    requiredParams = [],
    enableMetrics = true,
    timeout = 30000
  } = options;

  return createHandler(name, async (request, env, ctx) => {
    const requestId = crypto.randomUUID();

    logger.info(`🔧 [${name.toUpperCase()}] API request started`, {
      requestId,
      method: request.method,
      url: request.url
    });

    try {
      // Validate required parameters
      const url = new URL(request.url);
      const missingParams = requiredParams.filter(param => !url.searchParams.get(param));

      if (missingParams.length > 0) {
        logger.warn(`⚠️ [${name.toUpperCase()}] Missing required parameters`, {
          requestId,
          missingParams
        });

        return {
          success: false,
          error: `Missing required parameters: ${missingParams.join(', ')}`,
          requestId,
          timestamp: new Date().toISOString()
        };
      }

      // Execute API function
      const result = await apiFunction(request, env, ctx, { requestId });

      logger.info(`✅ [${name.toUpperCase()}] API request completed`, {
        requestId,
        duration: Date.now() - (ctx.startTime || Date.now())
      });

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`❌ [${name.toUpperCase()}] API request failed`, {
        requestId,
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }, {
    enableAuth,
    enableMetrics,
    timeout
  });
}

/**
 * Create a standardized data retrieval handler
 * @param {string} name - Handler name
 * @param {Function} dataRetriever - Function to retrieve data
 * @param {Object} options - Handler options
 * @returns {Function} Handler function
 */
export function createDataRetrievalHandler(name, dataRetriever, options = {}) {
  const {
    keyFormat, // Function to generate KV key from parameters
    defaultValue, // Default value if data not found
    ttl, // Optional TTL for cached data
    enableMetrics = true
  } = options;

  return createHandler(name, async (request, env) => {
    const requestId = crypto.randomUUID();

    logger.info(`📥 [${name.toUpperCase()}] Data retrieval started`, {
      requestId,
      url: request.url
    });

    try {
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams);

      // Generate key based on parameters
      const key = keyFormat ? keyFormat(params) : `${name}_${JSON.stringify(params)}`;

      // Try to retrieve data
      const data = await dataRetriever(key, env, params, { requestId });

      if (!data && defaultValue) {
        logger.info(`📥 [${name.toUpperCase()}] Using default value`, { requestId, key });
        return new Response(JSON.stringify(defaultValue), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      logger.info(`✅ [${name.toUpperCase()}] Data retrieved successfully`, {
        requestId,
        key,
        dataSize: JSON.stringify(data).length
      });

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': ttl ? `public, max-age=${ttl}` : 'no-cache'
        }
      });

    } catch (error) {
      logger.error(`❌ [${name.toUpperCase()}] Data retrieval failed`, {
        requestId,
        error: error.message
      });

      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }, {
    enableMetrics
  });
}

/**
 * Standard metrics for dashboard displays
 * @param {Object} data - Data object containing metrics
 * @returns {Array<Object>} Formatted metrics for display
 */
export function createStandardMetrics(data) {
  const metrics = [];

  if (data.accuracy !== undefined) {
    metrics.push({
      label: 'Accuracy',
      value: `${Math.round(data.accuracy * 100)}%`,
      trend: data.accuracyTrend || 'Stable',
      trendColor: data.accuracyTrend === 'Up' ? '#2ecc71' : data.accuracyTrend === 'Down' ? '#e74c3c' : '#6c757d'
    });
  }

  if (data.totalSignals !== undefined) {
    metrics.push({
      label: 'Total Signals',
      value: data.totalSignals,
      trend: data.signalsTrend || 'Stable',
      trendColor: data.signalsTrend === 'Up' ? '#2ecc71' : data.signalsTrend === 'Down' ? '#e74c3c' : '#6c757d'
    });
  }

  if (data.highConfidenceSignals !== undefined) {
    metrics.push({
      label: 'High Confidence',
      value: data.highConfidenceSignals,
      trend: data.confidenceTrend || 'Stable',
      trendColor: data.confidenceTrend === 'Up' ? '#2ecc71' : data.confidenceTrend === 'Down' ? '#e74c3c' : '#6c757d'
    });
  }

  if (data.processingTime !== undefined) {
    metrics.push({
      label: 'Processing Time',
      value: `${data.processingTime}ms`,
      trend: data.timeTrend || 'Optimal',
      trendColor: data.timeTrend === 'Up' ? '#e74c3c' : data.timeTrend === 'Down' ? '#2ecc71' : '#6c757d'
    });
  }

  return metrics;
}

/**
 * Create a standardized dashboard layout
 * @param {string} title - Dashboard title
 * @param {Array<Object>} metrics - Metrics array
 * @param {string} mainContent - Main content HTML
 * @param {Object} options - Additional options
 * @returns {string} Complete dashboard HTML
 */
export function createDashboardLayout(title, metrics, mainContent, options = {}) {
  const {
    subtitle = '',
    status = 'Operational',
    tabs = null
  } = options;

  let content = '';

  // Add navigation tabs if provided
  if (tabs) {
    content += generateNavigationTabs(tabs);
  }

  // Add metrics grid if metrics provided
  if (metrics.length > 0) {
    content += generateMetricsGrid(metrics);
  }

  // Add main content
  content += mainContent;

  return generateCompletePage(
    title,
    subtitle || `${title} - TFT Trading System Dashboard`,
    content,
    status
  );
}

/**
 * Handle common validation patterns
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment object
 * @param {Array<string>} requiredEnvVars - Required environment variables
 * @returns {Object} Validation result
 */
export function validateRequestEnvironment(request, env, requiredEnvVars = []) {
  const errors = [];

  // Check required environment variables
  for (const varName of requiredEnvVars) {
    if (!env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check API key for sensitive operations
  const apiKey = request.headers.get('X-API-KEY');
  if (requiredEnvVars.includes('WORKER_API_KEY') && (!apiKey || apiKey !== env.WORKER_API_KEY)) {
    errors.push('Invalid or missing API key');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  createReportHandler,
  createAPIHandler,
  createDataRetrievalHandler,
  createStandardMetrics,
  createDashboardLayout,
  validateRequestEnvironment
};