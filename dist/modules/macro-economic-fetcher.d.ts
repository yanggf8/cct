/**
 * Macroeconomic Data Fetcher
 *
 * Integrates FRED API client with Market Drivers system to fetch and process
 * macroeconomic data. Converts FRED data format to our Market Drivers format
 * and provides additional analysis and calculations.
 *
 * Features:
 * - FRED API integration with production strict mode (no mock fallbacks)
 * - Data transformation and validation with fail-fast errors in production
 * - Cache integration with 4-hour TTL for macroeconomic data
 * - Error handling and retry logic with circuit breaker pattern
 * - Derived metric calculations
 * - Strict mode enforcement for production environments
 *
 * @author Market Drivers Pipeline - Phase 2 Day 2
 * @since 2025-10-10
 * @updated Sprint 1-A - Production Market Indicators Implementation
 */
import type { MacroDrivers } from './market-drivers.js';
import { DOMarketDriversCacheAdapter } from './do-cache-adapter.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Macroeconomic Data Fetcher Options
 */
export interface MacroEconomicFetcherOptions {
    fredApiKey?: string;
    useMockData?: boolean;
    cacheManager?: DOMarketDriversCacheAdapter;
    enableCaching?: boolean;
    environment?: CloudflareEnvironment;
    forceMockClient?: boolean;
    strictMode?: boolean;
}
/**
 * Enhanced Macro Drivers with additional analysis
 */
export interface EnhancedMacroDrivers extends MacroDrivers {
    realYieldCurve: number;
    monetaryPolicyStance: 'tight' | 'neutral' | 'accommodative';
    economicMomentum: 'accelerating' | 'decelerating' | 'stable';
    recessionRisk: 'low' | 'medium' | 'high' | 'elevated';
    employmentQualityIndex: number;
    wageGrowthPressure: number;
    disinflationProgress: number;
    coreVsHeadlineSpread: number;
    financialConditionsIndex: number;
    creditMarketStress: number;
    leadingEconomicIndex: number;
    recessionProbability: number;
    metadata: {
        source: 'FRED' | 'Mock';
        lastUpdated: string;
        dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
        missingData: string[];
        calculations: string[];
    };
}
/**
 * Macroeconomic Data Fetcher Implementation
 */
export declare class MacroEconomicFetcher {
    private fredApiClient;
    private cacheManager?;
    private circuitBreaker;
    private enableCaching;
    private useMockData;
    private strictMode;
    private environment?;
    private productionGuards;
    constructor(options: MacroEconomicFetcherOptions);
    /**
     * Fetch macro economic data
     */
    fetchMacroDrivers(date?: Date | string): Promise<EnhancedMacroDrivers>;
    /**
     * Transform FRED snapshot to MacroDrivers format
     */
    private transformSnapshotToMacroDrivers;
    /**
     * Enhance basic macro drivers with additional analysis
     */
    private enhanceMacroDrivers;
    /**
     * Calculate recession risk score (0-10)
     */
    private calculateRecessionScore;
    /**
     * Calculate employment quality index (0-100)
     */
    private calculateEmploymentQuality;
    /**
     * Calculate wage growth pressure (0-10)
     */
    private calculateWageGrowthPressure;
    /**
     * Calculate disinflation progress (0-100)
     */
    private calculateDisinflationProgress;
    /**
     * Calculate financial conditions index (0-200)
     * Higher = tighter financial conditions
     */
    private calculateFinancialConditions;
    /**
     * Calculate credit market stress (0-10)
     */
    private calculateCreditMarketStress;
    /**
     * Identify missing data
     */
    private identifyMissingData;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
/**
 * Initialize Macro Economic Fetcher
 */
export declare function initializeMacroEconomicFetcher(options: MacroEconomicFetcherOptions): MacroEconomicFetcher;
export default MacroEconomicFetcher;
//# sourceMappingURL=macro-economic-fetcher.d.ts.map