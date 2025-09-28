/**
 * Decomposed Intraday Handler Example
 *
 * This demonstrates how to replace the 932-line intraday-handlers.js
 * with a clean, modular architecture using the new common patterns.
 *
 * BEFORE: 932 lines with mixed concerns (data retrieval, HTML generation, business logic)
 * AFTER: ~200 lines with clear separation of concerns
 */

import { createLogger } from '../logging.js';
import {
  createReportHandler,
  createStandardMetrics,
  validateRequestEnvironment
} from './common-handlers.js';
import { getIntradayCheckData } from '../report-data-retrieval.js';
import { generateIntradayPerformance } from '../report/intraday-analysis.js';
import {
  generateWaitingDisplay,
  generateErrorDisplay,
  generateMetricsGrid,
  generateSignalItem,
  generateCompletePage
} from '../html-generators.js';

const logger = createLogger('intraday-decomposed');

/**
 * Specialized intraday data retrieval module
 */
class IntradayDataModule {
  static async retrieve(env, date, context = {}) {
    const { requestId } = context;

    logger.debug('📥 Retrieving intraday data', { requestId, date });

    try {
      const data = await getIntradayCheckData(date, env, { requestId });

      if (!data) {
        logger.warn('⚠️ No intraday data found', { requestId, date });
        return null;
      }

      logger.debug('✅ Intraday data retrieved', {
        requestId,
        signalCount: data.signals?.length || 0
      });

      return data;

    } catch (error) {
      logger.error('❌ Failed to retrieve intraday data', {
        requestId,
        date,
        error: error.message
      });
      throw error;
    }
  }

  static getDefaultData() {
    return {
      signals: [],
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
 * Specialized intraday analysis module
 */
class IntradayAnalysisModule {
  static async analyze(data, context = {}) {
    const { requestId } = context;

    logger.debug('📊 Analyzing intraday performance', { requestId });

    try {
      const analysis = await generateIntradayPerformance(data, { requestId });

      logger.debug('✅ Intraday analysis completed', {
        requestId,
        accuracy: analysis.overallAccuracy,
        signalCount: analysis.totalSignals
      });

      return analysis;

    } catch (error) {
      logger.error('❌ Intraday analysis failed', {
        requestId,
        error: error.message
      });
      throw error;
    }
  }

  static calculateMetrics(data) {
    const signals = data.signals || [];
    const totalSignals = signals.length;
    const correctSignals = signals.filter(s => s.correct).length;
    const wrongSignals = totalSignals - correctSignals;
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
 * Specialized intraday HTML generation module
 */
class IntradayHTMLModule {
  static async generate(analysis, date, env, context = {}) {
    const { requestId } = context;

    logger.debug('🎨 Generating intraday HTML', { requestId, date });

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

      logger.debug('✅ Intraday HTML generated', {
        requestId,
        contentLength: content.length
      });

      return content;

    } catch (error) {
      logger.error('❌ Failed to generate intraday HTML', {
        requestId,
        error: error.message
      });
      throw error;
    }
  }

  static generateModelHealthDisplay(modelHealth) {
    const statusClass = modelHealth.overallStatus === 'healthy' ? 'status-healthy' :
                        modelHealth.overallStatus === 'warning' ? 'status-warning' : 'status-error';

    return `
      <div class="metric-card">
        <div class="metric-value">
          <span class="status-badge ${statusClass}">${modelHealth.overallStatus.toUpperCase()}</span>
        </div>
        <div class="metric-label">Overall Model Health</div>
      </div>`;
  }
}

/**
 * Refactored intraday handler using decomposed modules
 * This replaces the 932-line monolithic handler with a clean, modular approach
 */
export const handleIntradayCheckDecomposed = createReportHandler(
  'intraday-check',
  ['morning_predictions', 'pre_market_briefing'],
  async (env, date, context) => {
    // Data retrieval
    const data = await IntradayDataModule.retrieve(env, date, context);
    return data || IntradayDataModule.getDefaultData();
  },
  async (data, date, env, context) => {
    // Analysis
    const analysis = await IntradayAnalysisModule.analyze(data, context);

    // HTML generation
    return await IntradayHTMLModule.generate(analysis, date, env, context);
  },
  {
    title: 'Intraday Performance Check',
    description: 'Real-time tracking of morning predictions with performance monitoring',
    enableMetrics: true,
    timeout: 30000
  }
);

/**
 * Enhanced version with KV consistency checking
 */
export const handleIntradayCheckConsistent = createReportHandler(
  'intraday-check-consistent',
  ['morning_predictions', 'pre_market_briefing'],
  async (env, date, context) => {
    const { requestId } = context;

    // Enhanced dependency validation with consistency checking
    logger.debug('🔗 Enhanced dependency validation', { requestId, date });

    try {
      // Import consistency utilities
      const { verifyDependencyConsistency } = await import('../kv-consistency.js');

      const consistencyResults = await verifyDependencyConsistency(
        date,
        ['morning_predictions', 'pre_market_briefing'],
        env
      );

      if (!consistencyResults.isValid) {
        logger.warn('⚠️ KV consistency issues detected', {
          requestId,
          consistentJobs: consistencyResults.consistentJobs,
          inconsistentJobs: consistencyResults.inconsistentJobs
        });

        // Wait for consistency or proceed with available data
        if (consistencyResults.inconsistentJobs.length > 0) {
          logger.info('🔄 Proceeding with available data', { requestId });
        }
      }

      // Retrieve intraday data
      const data = await IntradayDataModule.retrieve(env, date, context);

      if (!data) {
        return {
          ...IntradayDataModule.getDefaultData(),
          consistencyStatus: consistencyResults
        };
      }

      return {
        ...data,
        consistencyStatus: consistencyResults
      };

    } catch (error) {
      logger.error('❌ Enhanced validation failed', {
        requestId,
        error: error.message
      });

      // Fallback to standard validation
      const { validateDependencies } = await import('../kv-utils.js');
      const validation = await validateDependencies(date, ['morning_predictions', 'pre_market_briefing'], env);

      if (!validation.isValid) {
        return {
          ...IntradayDataModule.getDefaultData(),
          dependencyValidation: validation
        };
      }

      const data = await IntradayDataModule.retrieve(env, date, context);
      return data || IntradayDataModule.getDefaultData();
    }
  },
  async (data, date, env, context) => {
    // Analysis
    const analysis = await IntradayAnalysisModule.analyze(data, context);

    // HTML generation with consistency information
    const html = await IntradayHTMLModule.generate(analysis, date, env, context);

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
        </div>`;

      return html + consistencyHtml;
    }

    return html;
  },
  {
    title: 'Intraday Performance Check (Consistent)',
    description: 'Real-time tracking with KV consistency monitoring and enhanced reliability',
    enableMetrics: true,
    timeout: 45000 // Extended timeout for consistency checks
  }
);

export default {
  handleIntradayCheckDecomposed,
  handleIntradayCheckConsistent,
  IntradayDataModule,
  IntradayAnalysisModule,
  IntradayHTMLModule
};