/**
 * Refactored Intraday Performance Check Handler
 * Demonstrates decomposition of large handlers into smaller, focused modules
 */

import { createLogger } from '../logging.js';
import { getIntradayCheckData } from '../report-data-retrieval.js';
import { validateDependencies } from '../kv-utils.js';
import { verifyDependencyConsistency } from '../kv-consistency.js';
import { generateIntradayPerformance } from '../report/intraday-analysis.js';
import {
  createReportHandler,
  createDashboardLayout,
  createStandardMetrics
} from './common-handlers.js';
import {
  generateWaitingDisplay,
  generateErrorDisplay,
  generateMetricsGrid,
  generateSignalItem,
  generateCompletePage
} from '../html-generators.js';

const logger = createLogger('intraday-refactored');

/**
 * Intraday data retrieval module
 */
class IntradayDataRetriever {
  /**
   * Retrieve intraday check data with consistency handling
   * @param {Object} env - Environment object
   * @param {string} date - Date string
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Intraday data
   */
  static async retrieveData(env, date, context = {}) {
    const { requestId } = context;

    logger.debug('📥 [INTRADAY] Retrieving intraday data', { requestId, date });

    try {
      const data = await getIntradayCheckData(date, env, { requestId });

      if (!data) {
        logger.warn('⚠️ [INTRADAY] No intraday data found', { requestId, date });
        return null;
      }

      logger.debug('✅ [INTRADAY] Intraday data retrieved', {
        requestId,
        date,
        signalsCount: data.morningPredictions?.length || 0
      });

      return data;

    } catch (error) {
      logger.error('❌ [INTRADAY] Failed to retrieve intraday data', {
        requestId,
        date,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get default intraday data structure
   * @returns {Object} Default intraday data
   */
  static getDefaultData() {
    return {
      morningPredictions: [],
      currentPrices: {},
      performance: {
        totalSignals: 0,
        correctSignals: 0,
        wrongSignals: 0,
        accuracy: 0
      },
      lastUpdated: new Date().toISOString(),
      status: 'no_data'
    };
  }
}

/**
 * Intraday performance analysis module
 */
class IntradayPerformanceAnalyzer {
  /**
   * Analyze intraday performance
   * @param {Object} data - Intraday data
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Performance analysis
   */
  static async analyze(data, context = {}) {
    const { requestId } = context;

    logger.debug('📊 [INTRADAY] Analyzing performance', { requestId });

    try {
      const analysis = await generateIntradayPerformance(data, { requestId });

      logger.debug('✅ [INTRADAY] Performance analysis completed', {
        requestId,
        accuracy: analysis.overallAccuracy,
        signalsCount: analysis.totalSignals
      });

      return analysis;

    } catch (error) {
      logger.error('❌ [INTRADAY] Performance analysis failed', {
        requestId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate performance metrics
   * @param {Object} data - Intraday data
   * @returns {Object} Performance metrics
   */
  static calculateMetrics(data) {
    const morningPredictions = data.morningPredictions || [];
    const currentPrices = data.currentPrices || {};

    let correctSignals = 0;
    let wrongSignals = 0;
    let totalSignals = morningPredictions.length;

    for (const prediction of morningPredictions) {
      const symbol = prediction.symbol;
      const currentPrice = currentPrices[symbol];

      if (currentPrice && prediction.predictedDirection) {
        const priceChange = currentPrice - prediction.currentPrice;
        const actualDirection = priceChange > 0 ? 'BULLISH' : 'BEARISH';

        if (actualDirection === prediction.predictedDirection) {
          correctSignals++;
        } else {
          wrongSignals++;
        }
      }
    }

    const accuracy = totalSignals > 0 ? (correctSignals / totalSignals) * 100 : 0;

    return {
      totalSignals,
      correctSignals,
      wrongSignals,
      accuracy: Math.round(accuracy * 100) / 100
    };
  }
}

/**
 * Intraday HTML generation module
 */
class IntradayHTMLGenerator {
  /**
   * Generate main intraday HTML content
   * @param {Object} analysis - Performance analysis
   * @param {string} date - Date string
   * @param {Object} env - Environment object
   * @param {Object} context - Request context
   * @returns {Promise<string>} HTML content
   */
  static async generateHTML(analysis, date, env, context = {}) {
    const { requestId } = context;

    logger.debug('🎨 [INTRADAY] Generating HTML', { requestId, date });

    try {
      // Create metrics display
      const metrics = createStandardMetrics({
        accuracy: analysis.overallAccuracy / 100,
        totalSignals: analysis.totalSignals,
        highConfidenceSignals: analysis.highConfidenceSignals,
        processingTime: analysis.processingTime
      });

      let content = generateMetricsGrid(metrics);

      // Add signal details
      if (analysis.signals && analysis.signals.length > 0) {
        content += `
            <div class="card">
                <h2>📈 Signal Performance Details</h2>
                ${analysis.signals.map(signal => generateSignalItem(signal)).join('')}
            </div>`;
      }

      // Add model health
      if (analysis.modelHealth) {
        content += `
            <div class="card">
                <h2>🤖 Model Health Status</h2>
                ${this.generateModelHealthDisplay(analysis.modelHealth)}
            </div>`;
      }

      // Add insights
      if (analysis.insights && analysis.insights.length > 0) {
        content += `
            <div class="card">
                <h2>💡 Key Insights</h2>
                <ul>
                    ${analysis.insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>`;
      }

      logger.debug('✅ [INTRADAY] HTML generation completed', {
        requestId,
        contentLength: content.length
      });

      return content;

    } catch (error) {
      logger.error('❌ [INTRADAY] HTML generation failed', {
        requestId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate model health display
   * @param {Object} modelHealth - Model health data
   * @returns {string} HTML for model health
   */
  static generateModelHealthDisplay(modelHealth) {
    const healthStatus = modelHealth.overallStatus === 'healthy' ? 'status-healthy' :
                         modelHealth.overallStatus === 'warning' ? 'status-warning' : 'status-error';

    return `
        <div class="metric-card">
            <div class="metric-value">
                <span class="status-badge ${healthStatus}">${modelHealth.overallStatus.toUpperCase()}</span>
            </div>
            <div class="metric-label">Overall Model Health</div>
        </div>
        <div style="margin-top: 1rem;">
            <h4>Component Status:</h4>
            <ul>
                ${Object.entries(modelHealth.components || {}).map(([component, status]) => `
                    <li>${component}: <span class="status-badge status-${status === 'healthy' ? 'healthy' : 'warning'}">${status}</span></li>
                `).join('')}
            </ul>
        </div>`;
  }
}

/**
 * Refactored intraday handler using decomposed modules
 */
export const handleIntradayCheckRefactored = createReportHandler(
  'intraday-check',
  ['morning_predictions', 'pre_market_briefing'],
  async (env, date, context) => {
    // Retrieve intraday data
    const data = await IntradayDataRetriever.retrieveData(env, date, context);

    if (!data) {
      return IntradayDataRetriever.getDefaultData();
    }

    return data;
  },
  async (data, date, env, context) => {
    // Analyze performance
    const analysis = await IntradayPerformanceAnalyzer.analyze(data, context);

    // Generate HTML
    return await IntradayHTMLGenerator.generateHTML(analysis, date, env, context);
  },
  {
    title: 'Intraday Performance Check',
    description: 'Real-time tracking of morning high-confidence predictions with performance monitoring',
    enableMetrics: true,
    timeout: 30000
  }
);

/**
 * Enhanced intraday handler with KV consistency checks
 */
export const handleIntradayCheckEnhanced = createReportHandler(
  'intraday-check-enhanced',
  ['morning_predictions', 'pre_market_briefing'],
  async (env, date, context) => {
    const { requestId } = context;

    // Enhanced dependency validation with consistency checking
    logger.debug('🔗 [INTRADAY-ENHANCED] Enhanced dependency validation', { requestId, date });

    try {
      const consistencyResults = await verifyDependencyConsistency(
        date,
        ['morning_predictions', 'pre_market_briefing'],
        env
      );

      if (!consistencyResults.isValid) {
        logger.warn('⚠️ [INTRADAY-ENHANCED] KV consistency issues detected', {
          requestId,
          consistentJobs: consistencyResults.consistentJobs,
          inconsistentJobs: consistencyResults.inconsistentJobs
        });

        // Wait for consistency or proceed with available data
        if (consistencyResults.inconsistentJobs.length > 0) {
          logger.info('🔄 [INTRADAY-ENHANCED] Proceeding with available data', { requestId });
        }
      }

      // Retrieve intraday data
      const data = await IntradayDataRetriever.retrieveData(env, date, context);

      if (!data) {
        return {
          ...IntradayDataRetriever.getDefaultData(),
          consistencyStatus: consistencyResults
        };
      }

      return {
        ...data,
        consistencyStatus: consistencyResults
      };

    } catch (error) {
      logger.error('❌ [INTRADAY-ENHANCED] Enhanced validation failed', {
        requestId,
        error: error.message
      });

      // Fallback to standard validation
      const validation = await validateDependencies(date, ['morning_predictions', 'pre_market_briefing'], env);

      if (!validation.isValid) {
        return {
          ...IntradayDataRetriever.getDefaultData(),
          dependencyValidation: validation
        };
      }

      // Retrieve data with standard validation
      const data = await IntradayDataRetriever.retrieveData(env, date, context);
      return data || IntradayDataRetriever.getDefaultData();
    }
  },
  async (data, date, env, context) => {
    // Analyze performance
    const analysis = await IntradayPerformanceAnalyzer.analyze(data, context);

    // Generate HTML with consistency information
    const html = await IntradayHTMLGenerator.generateHTML(analysis, date, env, context);

    // Add consistency status if available
    if (data.consistencyStatus) {
      const consistencyHtml = `
        <div class="card">
            <h2>🔄 KV Consistency Status</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${data.consistencyStatus.consistentJobs.length}</div>
                    <div class="metric-label">Consistent Jobs</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${data.consistencyStatus.inconsistentJobs.length}</div>
                    <div class="metric-label">Inconsistent Jobs</div>
                </div>
            </div>
            ${data.consistencyStatus.inconsistentJobs.length > 0 ? `
                <div class="warning-container">
                    <p><strong>Note:</strong> Some jobs are experiencing KV eventual consistency delays. Data may update within 60 seconds.</p>
                </div>
            ` : ''}
        </div>
      `;

      return html + consistencyHtml;
    }

    return html;
  },
  {
    title: 'Intraday Performance Check (Enhanced)',
    description: 'Real-time tracking with KV consistency monitoring and enhanced reliability',
    enableMetrics: true,
    timeout: 45000 // Extended timeout for consistency checks
  }
);

export default {
  handleIntradayCheckRefactored,
  handleIntradayCheckEnhanced,
  IntradayDataRetriever,
  IntradayPerformanceAnalyzer,
  IntradayHTMLGenerator
};