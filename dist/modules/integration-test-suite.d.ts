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
import type { CloudflareEnvironment } from '../types.js';
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
export declare class IntegrationTestSuite {
    private env;
    private config;
    constructor(env: CloudflareEnvironment, config?: IntegrationTestConfig);
    /**
     * Run complete integration test suite
     */
    runFullTestSuite(): Promise<TestSuite>;
    /**
     * Test FRED API Connectivity
     */
    private testFREDAPIConnectivity;
    /**
     * Test Yahoo Finance API Connectivity
     */
    private testYahooFinanceConnectivity;
    /**
     * Test AI Model Connectivity
     */
    private testAIModelConnectivity;
    /**
     * Test FRED Data Quality
     */
    private testFREDDataQuality;
    /**
     * Test Market Data Quality
     */
    private testMarketDataQuality;
    /**
     * Test Sentiment Analysis Integration
     */
    private testSentimentAnalysisIntegration;
    /**
     * Test Cache System
     */
    private testCacheSystem;
    /**
     * Test Cache Consistency
     */
    private testCacheConsistency;
    /**
     * Test API Performance
     */
    private testAPIPerformance;
    /**
     * Test Cache Performance
     */
    private testCachePerformance;
    /**
     * Test Complete Workflow
     */
    private testCompleteWorkflow;
    /**
     * Test Error Handling
     */
    private testErrorHandling;
    /**
     * Generate test summary
     */
    private generateTestSummary;
    /**
     * Run quick health check
     */
    runQuickHealthCheck(): Promise<TestSuite>;
}
/**
 * Initialize Integration Test Suite
 */
export declare function initializeIntegrationTestSuite(env: CloudflareEnvironment, config?: IntegrationTestConfig): IntegrationTestSuite;
export default IntegrationTestSuite;
//# sourceMappingURL=integration-test-suite.d.ts.map