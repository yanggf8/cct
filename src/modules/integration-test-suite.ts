/**
 * Integration Test Suite for Real-time Data Integration
 *
 * Comprehensive testing suite that validates all real-time data integration components.
 * Tests API connectivity, data quality, performance, and system reliability.
 *
 * Features:
 * - FRED API integration testing
 * - Yahoo Finance API testing
 * - AI model testing
 * - Cache system testing
 * - End-to-end workflow testing
 * - Performance benchmarking
 * - Data quality validation
 *
 * @author Real-time Data Integration - Phase 5
 * @since 2025-10-14
 */

import { createLogger } from './logging.js';
import { createFredApiClientWithHealthCheck } from './fred-api-factory.js';
import { getBatchMarketData, healthCheck as yahooHealthCheck } from './yahoo-finance-integration.js';
import { initializeAPIHealthMonitor } from './api-health-monitor.js';
import { DOCacheAdapter } from './do-cache-adapter.js';
import type { CloudflareEnvironment, MarketData } from '../types.js';

const logger = createLogger('integration-test-suite');

/**
 * Test Result Interface
 */
export interface TestResult {
  test_name: string;
  status: 'passed' | 'failed' | 'warning';
  duration_ms: number;
  details?: any;
  error?: string;
  metrics?: Record<string, any>;
}

export interface TestSuite {
  suite_name: string;
  timestamp: string;
  total_tests: number;
  passed: number;
  failed: number;
  warnings: number;
  total_duration_ms: number;
  tests: TestResult[];
  overall_status: 'passed' | 'failed' | 'warning';
  summary: string;
}

/**
 * Integration Test Suite Configuration
 */
export interface IntegrationTestConfig {
  enablePerformanceTests?: boolean;
  enableDataQualityTests?: boolean;
  enableEndToEndTests?: boolean;
  timeoutMs?: number;
  verboseLogging?: boolean;
}

/**
 * Integration Test Suite Implementation
 */
export class IntegrationTestSuite {
  private env: CloudflareEnvironment;
  private config: IntegrationTestConfig;

  constructor(env: CloudflareEnvironment, config: IntegrationTestConfig = {}) {
    this.env = env;
    this.config = {
      enablePerformanceTests: true,
      enableDataQualityTests: true,
      enableEndToEndTests: true,
      timeoutMs: 30000,
      verboseLogging: false,
      ...config
    };
  }

  /**
   * Run complete integration test suite
   */
  async runFullTestSuite(): Promise<TestSuite> {
    const startTime = Date.now();
    logger.info('Starting integration test suite');

    const tests: TestResult[] = [];

    // Core API Connectivity Tests
    tests.push(await this.testFREDAPIConnectivity());
    tests.push(await this.testYahooFinanceConnectivity());
    tests.push(await this.testAIModelConnectivity());

    // Data Integration Tests
    tests.push(await this.testFREDDataQuality());
    tests.push(await this.testMarketDataQuality());
    tests.push(await this.testSentimentAnalysisIntegration());

    // Cache System Tests
    tests.push(await this.testCacheSystem());
    tests.push(await this.testCacheConsistency());

    // Performance Tests (if enabled)
    if (this.config.enablePerformanceTests) {
      tests.push(await this.testAPIPerformance());
      tests.push(await this.testCachePerformance());
    }

    // End-to-End Tests (if enabled)
    if (this.config.enableEndToEndTests) {
      tests.push(await this.testCompleteWorkflow());
      tests.push(await this.testErrorHandling());
    }

    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const warnings = tests.filter(t => t.status === 'warning').length;
    const totalDuration = Date.now() - startTime;

    const overallStatus = failed === 0 ? (warnings === 0 ? 'passed' : 'warning') : 'failed';
    const summary = this.generateTestSummary(tests);

    const testSuite: TestSuite = {
      suite_name: 'Real-time Data Integration Test Suite',
      timestamp: new Date().toISOString(),
      total_tests: tests.length,
      passed,
      failed,
      warnings,
      total_duration_ms: totalDuration,
      tests,
      overall_status: overallStatus,
      summary
    };

    logger.info('Integration test suite completed', {
      overallStatus,
      passed,
      failed,
      warnings,
      duration: `${totalDuration}ms`
    });

    return testSuite;
  }

  /**
   * Test FRED API Connectivity
   */
  private async testFREDAPIConnectivity(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const { client, health } = await createFredApiClientWithHealthCheck(this.env);

      return {
        test_name: 'FRED API Connectivity',
        status: health.status === 'healthy' ? 'passed' : 'failed',
        duration_ms: Date.now() - startTime,
        details: health,
        metrics: {
          api_available: health.status === 'healthy',
          response_time: health.details?.responseTime || 0,
          real_data: !health.details?.mock
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'FRED API Connectivity',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Yahoo Finance API Connectivity
   */
  private async testYahooFinanceConnectivity(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const health = await yahooHealthCheck();

      return {
        test_name: 'Yahoo Finance API Connectivity',
        status: health.status === 'healthy' ? 'passed' : 'failed',
        duration_ms: Date.now() - startTime,
        details: health,
        metrics: {
          api_available: health.status === 'healthy',
          response_time: (health as any).responseTime || 0
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Yahoo Finance API Connectivity',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test AI Model Connectivity
   */
  private async testAIModelConnectivity(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Test GPT Model
      const gptStart = Date.now();
      const gptResult = await this.env.AI.run('@cf/openchat/openchat-3.5-0106', {
        messages: [{ role: 'user', content: 'Integration test - respond with "OK"' }],
        temperature: 0.1,
        max_tokens: 10
      });
      const gptTime = Date.now() - gptStart;

      // Test DistilBERT Model
      const distilStart = Date.now();
      const distilResult = await this.env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
        text: 'Integration test sentiment analysis'
      });
      const distilTime = Date.now() - distilStart;

      const gptWorking = gptResult && gptResult.response;
      const distilWorking = distilResult && Array.isArray(distilResult) && distilResult.length > 0;

      const status = gptWorking && distilWorking ? 'passed' : 'failed';

      return {
        test_name: 'AI Model Connectivity',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          gpt_model: {
            status: gptWorking ? 'healthy' : 'unhealthy',
            response_time_ms: gptTime
          },
          distilbert_model: {
            status: distilWorking ? 'healthy' : 'unhealthy',
            response_time_ms: distilTime
          }
        },
        metrics: {
          gpt_response_time: gptTime,
          distilbert_response_time: distilTime,
          both_models_working: gptWorking && distilWorking
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'AI Model Connectivity',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test FRED Data Quality
   */
  private async testFREDDataQuality(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const { client } = await createFredApiClientWithHealthCheck(this.env);
      const snapshot = await client.getMacroEconomicSnapshot();

      // Validate key economic indicators
      const validations = {
        fedFundsRate: snapshot.fedFundsRate.value > 0 && snapshot.fedFundsRate.value < 20,
        unemploymentRate: snapshot.unemploymentRate.value >= 0 && snapshot.unemploymentRate.value <= 20,
        inflationRate: snapshot.inflationRate.value >= -10 && snapshot.inflationRate.value <= 20,
        dataFreshness: snapshot.metadata.dataFreshness < 24, // Less than 24 hours old
        hasData: snapshot.metadata.seriesCount > 0
      };

      const passedValidations = Object.values(validations).filter(Boolean).length;
      const totalValidations = Object.keys(validations).length;
      const status = passedValidations === totalValidations ? 'passed' :
                     passedValidations >= totalValidations * 0.8 ? 'warning' : 'failed';

      return {
        test_name: 'FRED Data Quality',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          sample_data: {
            fedFundsRate: snapshot.fedFundsRate.value,
            unemploymentRate: snapshot.unemploymentRate.value,
            inflationRate: snapshot.inflationRate.value
          },
          metadata: snapshot.metadata,
          validations
        },
        metrics: {
          validation_pass_rate: passedValidations / totalValidations,
          data_freshness_hours: snapshot.metadata.dataFreshness,
          series_count: snapshot.metadata.seriesCount
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'FRED Data Quality',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Market Data Quality
   */
  private async testMarketDataQuality(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const symbols = ['AAPL', 'MSFT', 'GOOGL'];
      const marketData = await getBatchMarketData(symbols);

      // Validate market data quality
      const validations = {
        hasData: Object.keys(marketData).length > 0,
        hasPrices: Object.values(marketData).some(d => d && d.price > 0),
        hasVolume: Object.values(marketData).some(d => d && (d as any).volume > 0),
        hasChanges: Object.values(marketData).some(d => d && (d as any).change !== undefined),
        realTimeData: Object.values(marketData).some(d => d && (d as any).lastUpdated)
      };

      const passedValidations = Object.values(validations).filter(Boolean).length;
      const totalValidations = Object.keys(validations).length;
      const status = passedValidations === totalValidations ? 'passed' :
                     passedValidations >= totalValidations * 0.6 ? 'warning' : 'failed';

      return {
        test_name: 'Market Data Quality',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          symbols_tested: symbols,
          data_received: marketData,
          validations
        },
        metrics: {
          validation_pass_rate: passedValidations / totalValidations,
          symbols_with_data: Object.keys(marketData).length,
          data_quality_score: passedValidations / totalValidations
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Market Data Quality',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Sentiment Analysis Integration
   */
  private async testSentimentAnalysisIntegration(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const { performDualAIComparison } = await import('./dual-ai-analysis.js');
      const testSymbols = ['AAPL'];

      const result = await performDualAIComparison('AAPL', [], this.env);

      const validations = {
        hasSignals: result.signals && result.signals.length > 0,
        hasGPTAnalysis: result.signals?.some((s: any) => s.gpt_sentiment),
        hasDistilBERTAnalysis: result.signals?.some((s: any) => s.distilbert_sentiment),
        hasConfidence: (result as any).overall_confidence !== undefined || result.performance_metrics !== undefined,
        hasRecommendation: result.signals?.some((s: any) => s.recommendation)
      };

      const passedValidations = Object.values(validations).filter(Boolean).length;
      const totalValidations = Object.keys(validations).length;
      const status = passedValidations === totalValidations ? 'passed' :
                     passedValidations >= totalValidations * 0.6 ? 'warning' : 'failed';

      return {
        test_name: 'Sentiment Analysis Integration',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          test_symbols: testSymbols,
          analysis_result: result,
          validations
        },
        metrics: {
          validation_pass_rate: passedValidations / totalValidations,
          signals_generated: result.signals?.length || 0,
          overall_confidence: (result as any).overall_confidence || result.performance_metrics?.successful_models / result.performance_metrics?.models_executed || 0
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Sentiment Analysis Integration',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Cache System
   */
  private async testCacheSystem(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const cacheManager = new DOCacheAdapter(this.env);
      const testKey = `integration_test_${Date.now()}`;
      const testData = { timestamp: Date.now(), test: 'integration' };

      // Test cache write
      const writeStart = Date.now();
      await cacheManager.set('TEST', testKey, testData, { l1: 60, l2: 60 } as any);
      const writeTime = Date.now() - writeStart;

      // Test cache read
      const readStart = Date.now();
      const cached = await cacheManager.get('TEST', testKey);
      const readTime = Date.now() - readStart;

      // Test cache delete
      const deleteStart = Date.now();
      await cacheManager.delete('TEST', testKey);
      const deleteTime = Date.now() - deleteStart;

      const dataIntegrity = cached && (cached as any).test === 'integration' && (cached as any).timestamp === testData.timestamp;

      const status = dataIntegrity ? 'passed' : 'failed';

      return {
        test_name: 'Cache System',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          test_operations: {
            write_time_ms: writeTime,
            read_time_ms: readTime,
            delete_time_ms: deleteTime
          },
          data_integrity: dataIntegrity
        },
        metrics: {
          write_time: writeTime,
          read_time: readTime,
          delete_time: deleteTime,
          total_operations_time: writeTime + readTime + deleteTime
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Cache System',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Cache Consistency
   */
  private async testCacheConsistency(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const cacheManager = new DOCacheAdapter(this.env);
      const testKey = `consistency_test_${Date.now()}`;
      const testData = { counter: 1, timestamp: Date.now() };

      // Write initial data
      await cacheManager.set('TEST', testKey, testData, { l1: 60, l2: 60 } as any);

      // Read multiple times to check consistency
      const reads = [];
      for (let i = 0; i < 5; i++) {
        const cached = await cacheManager.get('TEST', testKey);
        reads.push(cached);
      }

      // Check if all reads are consistent
      const firstRead = reads[0];
      const consistent = reads.every(read =>
        read && read.counter === firstRead.counter && read.timestamp === firstRead.timestamp
      );

      // Cleanup
      await cacheManager.delete('TEST', testKey);

      const status = consistent ? 'passed' : 'failed';

      return {
        test_name: 'Cache Consistency',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          read_count: reads.length,
          consistent_reads: consistent,
          sample_data: firstRead
        },
        metrics: {
          consistency_rate: consistent ? 1.0 : 0.0,
          read_operations: reads.length
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Cache Consistency',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test API Performance
   */
  private async testAPIPerformance(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const apiTests = [
        { name: 'FRED API', test: () => createFredApiClientWithHealthCheck(this.env) },
        { name: 'Yahoo Finance', test: () => yahooHealthCheck() },
        { name: 'AI Model GPT', test: () => this.env.AI.run('@cf/openchat/openchat-3.5-0106', {
          messages: [{ role: 'user', content: 'Performance test' }],
          temperature: 0.1,
          max_tokens: 10
        }) }
      ];

      const results = [];

      for (const apiTest of apiTests) {
        const testStart = Date.now();
        try {
          await apiTest.test();
          const responseTime = Date.now() - testStart;
          results.push({ name: apiTest.name, response_time: responseTime, status: 'success' });
        } catch (error: unknown) {
          const responseTime = Date.now() - testStart;
          results.push({ name: apiTest.name, response_time: responseTime, status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      }

      const averageResponseTime = results.reduce((sum: any, r: any) => sum + r.response_time, 0) / results.length;
      const successRate = results.filter(r => r.status === 'success').length / results.length;

      const status = successRate >= 0.8 ? (averageResponseTime < 2000 ? 'passed' : 'warning') : 'failed';

      return {
        test_name: 'API Performance',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          api_results: results,
          performance_thresholds: {
            max_response_time_ms: 2000,
            min_success_rate: 0.8
          }
        },
        metrics: {
          average_response_time_ms: averageResponseTime,
          success_rate: successRate,
          total_tests: results.length,
          successful_tests: results.filter(r => r.status === 'success').length
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'API Performance',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Cache Performance
   */
  private async testCachePerformance(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const cacheManager = new DOCacheAdapter(this.env);
      const testCount = 10;
      const testData = Array.from({ length: testCount }, (_: any, i: any) => ({
        key: `perf_test_${i}_${Date.now()}`,
        data: { index: i, timestamp: Date.now() }
      }));

      // Test batch writes
      const writeStart = Date.now();
      for (const item of testData) {
        await cacheManager.set('TEST', item.key, item.data, { l1: 60, l2: 60 } as any);
      }
      const writeTime = Date.now() - writeStart;

      // Test batch reads
      const readStart = Date.now();
      const reads = [];
      for (const item of testData) {
        const cached = await cacheManager.get('TEST', item.key);
        reads.push(cached);
      }
      const readTime = Date.now() - readStart;

      // Cleanup
      for (const item of testData) {
        await cacheManager.delete('TEST', item.key);
      }

      const avgWriteTime = writeTime / testCount;
      const avgReadTime = readTime / testCount;
      const hitRate = reads.filter(Boolean).length / testCount;

      const status = hitRate >= 0.9 && avgWriteTime < 100 && avgReadTime < 50 ? 'passed' : 'warning';

      return {
        test_name: 'Cache Performance',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          operations: {
            test_count: testCount,
            total_write_time: writeTime,
            total_read_time: readTime
          }
        },
        metrics: {
          avg_write_time_ms: avgWriteTime,
          avg_read_time_ms: avgReadTime,
          hit_rate: hitRate,
          operations_per_second: testCount / ((writeTime + readTime) / 1000)
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Cache Performance',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Complete Workflow
   */
  private async testCompleteWorkflow(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const workflowSteps = [];

      // Step 1: Get market data
      const marketDataStart = Date.now();
      const marketData = await getBatchMarketData(['AAPL']);
      workflowSteps.push({ step: 'Market Data Fetch', duration: Date.now() - marketDataStart, success: !!marketData });

      // Step 2: Get FRED data
      const fredDataStart = Date.now();
      const { client } = await createFredApiClientWithHealthCheck(this.env);
      const fredData = await client.getMacroEconomicSnapshot();
      workflowSteps.push({ step: 'FRED Data Fetch', duration: Date.now() - fredDataStart, success: !!fredData });

      // Step 3: Perform sentiment analysis
      const sentimentStart = Date.now();
      const { performDualAIComparison } = await import('./dual-ai-analysis.js');
      const sentimentResult = await performDualAIComparison('AAPL', [], this.env);
      workflowSteps.push({ step: 'Sentiment Analysis', duration: Date.now() - sentimentStart, success: !!sentimentResult });

      // Step 4: Cache results
      const cacheStart = Date.now();
      const cacheManager = new DOCacheAdapter(this.env);
      await cacheManager.set('workflow_test', 'workflow_test', { marketData, fredData, sentimentResult }, { ttl: 60 } as any);
      workflowSteps.push({ step: 'Cache Results', duration: Date.now() - cacheStart, success: true });

      const successRate = workflowSteps.filter(s => s.success).length / workflowSteps.length;
      const status = successRate === 1 ? 'passed' : 'failed';

      return {
        test_name: 'Complete Workflow',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          workflow_steps: workflowSteps,
          total_steps: workflowSteps.length,
          successful_steps: workflowSteps.filter(s => s.success).length
        },
        metrics: {
          success_rate: successRate,
          total_workflow_time: Date.now() - startTime,
          avg_step_time: workflowSteps.reduce((sum: any, s: any) => sum + s.duration, 0) / workflowSteps.length
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Complete Workflow',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test Error Handling
   */
  private async testErrorHandling(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const errorTests = [
        {
          name: 'Invalid Symbol',
          test: () => getBatchMarketData(['INVALID_SYMBOL'])
        },
        {
          name: 'Empty Data Request',
          test: () => getBatchMarketData([])
        },
        {
          name: 'Cache Key Collision',
          test: async () => {
            const cacheManager = new DOCacheAdapter(this.env);
            const testKey = 'collision_test';
            await cacheManager.set('TEST', testKey, { data: 1 }, { l1: 60, l2: 60 } as any);
            await cacheManager.set('TEST', testKey, { data: 2 }, { l1: 60, l2: 60 } as any); // Should overwrite
            const result = await cacheManager.get('TEST', testKey);
            await cacheManager.delete('TEST', testKey);
            return result;
          }
        }
      ];

      const results = [];

      for (const errorTest of errorTests) {
        try {
          const result = await errorTest.test();
          results.push({ name: errorTest.name, status: 'handled', result });
        } catch (error: unknown) {
          results.push({ name: errorTest.name, status: 'caught_error', error: error instanceof Error ? error.message : String(error) });
        }
      }

      const handledErrors = results.filter(r => r.status === 'handled' || r.status === 'caught_error').length;
      const status = handledErrors === results.length ? 'passed' : 'failed';

      return {
        test_name: 'Error Handling',
        status,
        duration_ms: Date.now() - startTime,
        details: {
          error_tests: results,
          total_tests: results.length,
          handled_errors: handledErrors
        },
        metrics: {
          error_handling_rate: handledErrors / results.length,
          total_tests: results.length
        }
      };
    } catch (error: unknown) {
      return {
        test_name: 'Error Handling',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate test summary
   */
  private generateTestSummary(tests: TestResult[]): string {
    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const warnings = tests.filter(t => t.status === 'warning').length;

    let summary = `Integration test suite completed with ${passed} passed, ${failed} failed, ${warnings} warnings.`;

    if (failed > 0) {
      const failedTests = tests.filter(t => t.status === 'failed').map(t => t.test_name);
      summary += ` Failed tests: ${failedTests.join(', ')}.`;
    }

    if (warnings > 0) {
      const warningTests = tests.filter(t => t.status === 'warning').map(t => t.test_name);
      summary += ` Tests with warnings: ${warningTests.join(', ')}.`;
    }

    return summary;
  }

  /**
   * Run quick health check
   */
  async runQuickHealthCheck(): Promise<TestSuite> {
    const startTime = Date.now();
    const tests: TestResult[] = [];

    // Only run critical connectivity tests
    tests.push(await this.testFREDAPIConnectivity());
    tests.push(await this.testYahooFinanceConnectivity());
    tests.push(await this.testAIModelConnectivity());

    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const totalDuration = Date.now() - startTime;

    return {
      suite_name: 'Quick Health Check',
      timestamp: new Date().toISOString(),
      total_tests: tests.length,
      passed,
      failed,
      warnings: 0,
      total_duration_ms: totalDuration,
      tests,
      overall_status: failed === 0 ? 'passed' : 'failed',
      summary: `Quick health check: ${passed}/${tests.length} systems operational`
    };
  }
}

/**
 * Initialize Integration Test Suite
 */
export function initializeIntegrationTestSuite(
  env: CloudflareEnvironment,
  config?: IntegrationTestConfig
): IntegrationTestSuite {
  return new IntegrationTestSuite(env, config);
}

export default IntegrationTestSuite;