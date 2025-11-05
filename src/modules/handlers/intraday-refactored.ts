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
import type { CloudflareEnvironment } from '../../types';

const logger = createLogger('intraday-refactored');

/**
 * Intraday data retrieval module
 */
class IntradayDataRetriever {
  /**
   * Retrieve intraday check data with consistency handling
   */
  static async retrieveData(
    env: CloudflareEnvironment,
    date: string,
    context: { requestId: string } = {}
  ): Promise<any> {
    const { requestId } = context;

    logger.debug('📥 [INTRADAY] Retrieving intraday data', { requestId, date });

    try {
      const data = await getIntradayCheckData(env, new Date(date));

      if (!data) {
        logger.warn('⚠️ [INTRADAY] No intraday data found', { requestId, date });
        return null;
      }

      logger.debug('✅ [INTRADAY] Intraday data retrieved', {
        requestId,
        date,
        hasSignals: !!((data as any).signals && (data as any).signals.length > 0),
        signalsCount: (data as any).signals ? (data as any).signals.length : 0
      });

      return data;

    } catch (error: any) {
      logger.error('❌ [INTRADAY] Failed to retrieve intraday data', {
        requestId,
        date,
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Validate intraday data completeness
   */
  static validateData(data: any, context: { requestId: string }): boolean {
    const { requestId } = context;

    if (!data) {
      logger.warn('⚠️ [INTRADAY] No data provided', { requestId });
      return false;
    }

    const requiredFields = ['date', 'timestamp', 'signals'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      logger.warn('⚠️ [INTRADAY] Incomplete data', {
        requestId,
        missingFields,
        providedFields: Object.keys(data)
      });
      return false;
    }

    logger.debug('✅ [INTRADAY] Data validation passed', { requestId });
    return true;
  }
}

/**
 * Intraday performance analysis module
 */
class IntradayPerformanceAnalyzer {
  /**
   * Analyze intraday signal performance
   */
  static async analyzePerformance(
    data: any,
    env: CloudflareEnvironment,
    context: { requestId: string }
  ): Promise<any> {
    const { requestId } = context;

    logger.debug('📊 [INTRADAY] Analyzing performance', { requestId });

    try {
      const performanceData = await generateIntradayPerformance(data, null, env);

      logger.debug('✅ [INTRADAY] Performance analysis completed', {
        requestId,
        hasPerformance: !!performanceData
      });

      return performanceData;

    } catch (error: any) {
      logger.error('❌ [INTRADAY] Performance analysis failed', {
        requestId,
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate performance metrics
   */
  static generateMetrics(signals: any[]): any {
    if (!signals || signals.length === 0) {
      return {
        totalSignals: 0,
        accuratePredictions: 0,
        accuracyRate: 0,
        avgConfidence: 0,
        performingSymbols: []
      };
    }

    const accurateSignals = signals.filter(signal => signal.status === 'correct');
    const totalConfidence = signals.reduce((sum: any, signal: any) => sum + (signal.confidence || 0), 0);
    const performingSymbols = signals
      .filter(signal => signal.performance && signal.performance > 0)
      .map(signal => ({
        symbol: signal.symbol,
        performance: signal.performance,
        direction: signal.direction
      }));

    return {
      totalSignals: signals.length,
      accuratePredictions: accurateSignals.length,
      accuracyRate: accurateSignals.length / signals.length,
      avgConfidence: totalConfidence / signals.length,
      performingSymbols
    };
  }
}

/**
 * HTML generation module
 */
class IntradayHTMLGenerator {
  /**
   * Generate complete intraday page HTML
   */
  static generateCompletePage(
    data: any,
    performance: any,
    context: { requestId: string }
  ): string {
    const { requestId } = context;

    try {
      const metrics = IntradayPerformanceAnalyzer.generateMetrics(data.signals);

      const sectionsContent = [
        IntradayHTMLGenerator.generateMetricsSection(metrics),
        IntradayHTMLGenerator.generateSignalsSection(data.signals),
        IntradayHTMLGenerator.generatePerformanceSection(performance)
      ].join('\n');

      const htmlContent = generateCompletePage(
        '🔍 Intraday Performance Check',
        'Real-time signal performance analysis',
        sectionsContent,
        'Operational'
      );

      return htmlContent;

    } catch (error: any) {
      logger.error('❌ [INTRADAY] HTML generation failed', {
        requestId,
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack
      });
      return generateErrorDisplay(error.message, requestId);
    }
  }

  /**
   * Generate metrics section HTML
   */
  static generateMetricsSection(metrics: any): string {
    const metricsGrid = generateMetricsGrid([
      {
        title: 'Total Signals',
        value: metrics.totalSignals.toString(),
        icon: '📊',
        color: '#4facfe'
      },
      {
        title: 'Accuracy Rate',
        value: `${Math.round(metrics.accuracyRate * 100)}%`,
        icon: '🎯',
        color: metrics.accuracyRate >= 0.7 ? '#48dbfb' : '#ff6b6b'
      },
      {
        title: 'Avg Confidence',
        value: `${Math.round(metrics.avgConfidence * 100)}%`,
        icon: '💪',
        color: '#feca57'
      },
      {
        title: 'Performing Symbols',
        value: metrics.performingSymbols.length.toString(),
        icon: '📈',
        color: '#00f2fe'
      }
    ]);

    return `
      <div class="metrics-section">
        <h2>📊 Performance Overview</h2>
        ${metricsGrid}
      </div>
    `;
  }

  /**
   * Generate signals section HTML
   */
  static generateSignalsSection(signals: any[]): string {
    if (!signals || signals.length === 0) {
      return `
        <div class="signals-section">
          <h2>🎯 Signal Analysis</h2>
          <div class="no-signals">
            <p>No signals found for this period.</p>
          </div>
        </div>
      `;
    }

    const signalsHTML = signals.map(signal =>
      generateSignalItem({
        symbol: signal.symbol,
        direction: signal.direction,
        confidence: signal.confidence,
        status: signal.status,
        performance: signal.performance,
        timestamp: signal.timestamp
      })
    ).join('');

    return `
      <div class="signals-section">
        <h2>🎯 Signal Analysis</h2>
        <div class="signals-grid">
          ${signalsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Generate performance section HTML
   */
  static generatePerformanceSection(performance: any): string {
    if (!performance) {
      return `
        <div class="performance-section">
          <h2>📈 Performance Analysis</h2>
          <div class="no-performance">
            <p>Performance analysis not available yet.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="performance-section">
        <h2>📈 Performance Analysis</h2>
        <div class="performance-content">
          <div class="performance-metrics">
            <div class="metric-item">
              <span class="label">Overall Performance</span>
              <span class="value">${performance.overallPerformance || 'N/A'}</span>
            </div>
            <div class="metric-item">
              <span class="label">Top Performer</span>
              <span class="value">${performance.topPerformer || 'N/A'}</span>
            </div>
            <div class="metric-item">
              <span class="label">Market Conditions</span>
              <span class="value">${performance.marketConditions || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Dependency validation module
 */
class DependencyValidator {
  /**
   * Validate intraday dependencies
   */
  static async validateDependencies(
    date: string,
    env: CloudflareEnvironment,
    context: { requestId: string }
  ): Promise<{ isValid: boolean; missing: string[]; completionRate: number }> {
    const { requestId } = context;

    logger.debug('🔗 [INTRADAY] Validating dependencies', { requestId, date });

    try {
      const validation = await validateDependencies(date, ['analysis', 'morning_predictions'], env);

      logger.debug('✅ [INTRADAY] Dependency validation completed', {
        requestId,
        isValid: validation.isValid,
        missingCount: validation.missing ? validation.missing.length : 0,
        completionRate: validation.completionRate
      });

      return validation;

    } catch (error: any) {
      logger.error('❌ [INTRADAY] Dependency validation failed', {
        requestId,
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack
      });
      return {
        isValid: false,
        missing: ['validation_error'],
        completionRate: 0
      };
    }
  }

  /**
   * Verify KV consistency
   */
  static async verifyConsistency(
    env: CloudflareEnvironment,
    context: { requestId: string }
  ): Promise<boolean> {
    const { requestId } = context;

    logger.debug('🔍 [INTRADAY] Verifying KV consistency', { requestId });

    try {
      const isConsistent = await verifyDependencyConsistency(dateStr, ['analysis', 'morning_predictions'], env);

      logger.debug('✅ [INTRADAY] KV consistency verified', {
        requestId,
        isConsistent
      });

      return isConsistent;

    } catch (error: any) {
      logger.error('❌ [INTRADAY] KV consistency check failed', {
        requestId,
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack
      });
      return false;
    }
  }
}

/**
 * Main intraday refactored handler
 */
export const handleIntradayCheckRefactored = async (
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

    const context = { requestId, date: dateStr };

    logger.info('🚀 [INTRADAY-REFACTORED] Starting intraday check', {
      requestId,
      date: dateStr,
      url: request.url
    });

    try {
      // Validate dependencies
      const dependencyValidation = await DependencyValidator.validateDependencies(dateStr, env, context);

      if (!dependencyValidation.isValid) {
        logger.warn('⚠️ [INTRADAY-REFACTORED] Dependencies not satisfied', {
          requestId,
          missing: dependencyValidation.missing,
          completionRate: dependencyValidation.completionRate
        });

        const waitingHTML = generateWaitingDisplay(
          'Intraday Analysis in Progress',
          dependencyValidation
        );

        return new Response(waitingHTML, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300'
          }
        });
      }

      // Verify KV consistency
      const isConsistent = await DependencyValidator.verifyConsistency(env, context);

      if (!isConsistent) {
        logger.warn('⚠️ [INTRADAY-REFACTORED] KV consistency issues detected', { requestId });
      }

      // Retrieve intraday data
      const intradayData = await IntradayDataRetriever.retrieveData(env, dateStr, context);

      if (!intradayData) {
        logger.warn('⚠️ [INTRADAY-REFACTORED] No intraday data available', { requestId });

        const errorHTML = generateErrorDisplay(
          'No intraday data available for this period',
          requestId
        );

        return new Response(errorHTML, {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Validate data
      const isValidData = IntradayDataRetriever.validateData(intradayData, context);

      if (!isValidData) {
        logger.error('❌ [INTRADAY-REFACTORED] Invalid intraday data', { requestId });

        const errorHTML = generateErrorDisplay(
          'Invalid intraday data format',
          requestId
        );

        return new Response(errorHTML, {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Analyze performance
      const performanceData = await IntradayPerformanceAnalyzer.analyzePerformance(
        intradayData,
        env,
        context
      );

      // Generate HTML response
      const htmlContent = IntradayHTMLGenerator.generateCompletePage(
        intradayData,
        performanceData,
        context
      );

      logger.info('🎯 [INTRADAY-REFACTORED] Intraday check completed', {
        requestId,
        duration: Date.now() - startTime,
        hasData: !!intradayData,
        hasPerformance: !!performanceData
      });

      return new Response(htmlContent, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300'
        }
      });

    } catch (error: any) {
      logger.error('❌ [INTRADAY-REFACTORED] Intraday check failed', {
        requestId,
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack,
        duration: Date.now() - startTime
      });

      const errorHTML = generateErrorDisplay(
        `Intraday check failed: ${error.message}`,
        requestId
      );

      return new Response(errorHTML, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
};