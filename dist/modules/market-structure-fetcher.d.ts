/**
 * Market Structure Data Fetcher
 *
 * Integrates with Yahoo Finance API to fetch market structure indicators
 * including VIX, dollar index, Treasury yields, and other market benchmarks.
 *
 * Features:
 * - Yahoo Finance API integration
 * - VIX volatility analysis and trend detection
 * - Dollar strength and trend analysis
 * - Yield curve calculations and status
 * - Market benchmark tracking
 * - Historical percentile calculations
 * - Circuit breaker protection
 * - Cache integration
 *
 * @author Market Drivers Pipeline - Phase 2 Day 3
 * @since 2025-10-10
 */
import type { MarketStructure } from './market-drivers.js';
import { DOMarketDriversCacheAdapter } from './do-cache-adapter.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Market Structure Fetcher Options
 */
export interface MarketStructureFetcherOptions {
    cacheManager?: DOMarketDriversCacheAdapter;
    enableCaching?: boolean;
    vixHistoryDays?: number;
    spyHistoryDays?: number;
    environment?: CloudflareEnvironment;
}
/**
 * Enhanced Market Structure with trend analysis
 */
export interface EnhancedMarketStructure extends MarketStructure {
    vixHistoricalPercentile: number;
    vixChange1Day: number;
    vixChange5Day: number;
    vixVolatilityRegime: 'low' | 'normal' | 'elevated' | 'extreme';
    dollarHistoricalPercentile: number;
    dollarChange1Day: number;
    dollarChange5Day: number;
    spyHistoricalPercentile: number;
    spyChange1Day: number;
    spyChange5Day: number;
    spyAbove200DMA: boolean;
    spyAbove50DMA: boolean;
    yield10Y2YSpread: number;
    yieldCurveZScore: number;
    yieldCurveTrend: 'steepening' | 'flattening' | 'stable';
    marketBreadth: {
        advancers: number;
        decliners: number;
        volumeAdvancers: number;
        volumeDecliners: number;
        breadthRatio: number;
    };
    riskAppetite: number;
    marketMomentum: 'bullish' | 'bearish' | 'neutral';
    flightToSafety: boolean;
    metadata: {
        source: 'Yahoo Finance';
        lastUpdated: string;
        dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
        missingData: string[];
        calculations: string[];
        apiCallCount: number;
    };
}
/**
 * Market Structure Data Fetcher Implementation
 */
export declare class MarketStructureFetcher {
    private cacheManager?;
    private circuitBreaker;
    private enableCaching;
    private vixHistoryDays;
    private spyHistoryDays;
    private environment?;
    private fredApiClient?;
    constructor(options?: MarketStructureFetcherOptions);
    /**
     * Fetch market structure data
     */
    fetchMarketStructure(): Promise<EnhancedMarketStructure>;
    /**
     * Fetch raw market data from Yahoo Finance
     */
    private fetchMarketData;
    /**
     * Transform raw Yahoo Finance data to MarketStructure format
     */
    private transformRawDataToMarketStructure;
    /**
     * Enhance basic market structure with additional analysis
     */
    private enhanceMarketStructure;
    /**
     * Trend determination methods
     */
    private determineVixTrend;
    private determineDollarTrend;
    private determineSpyTrend;
    private determineYieldCurveStatus;
    private determineYieldCurveTrend;
    /**
     * SOFR (Secured Overnight Financing Rate) Data Fetching
     * Replaces LIBOR as the benchmark risk-free rate
     */
    private fetchSOFRRate;
    /**
     * Fetch data from FRED API with proper error handling
     */
    private fetchFREDData;
    /**
     * Get appropriate start date based on series type
     */
    private getStartDateForSeries;
    /**
     * Fallback: Get Treasury yield as SOFR proxy
     */
    private fetchProxyYield;
    /**
     * VIX analysis methods
     */
    private calculateVIXPercentile;
    /**
     * Calculate percentile value from historical data
     */
    private calculatePercentile;
    /**
     * Fallback VIX percentile estimation when real data unavailable
     */
    private estimateVIXPercentile;
    private determineVIXVolatilityRegime;
    /**
     * Dollar analysis methods
     */
    private calculateDollarPercentile;
    /**
     * S&P 500 analysis methods
     */
    private calculateSPYPercentile;
    private checkAboveMovingAverage;
    /**
     * Yield curve analysis methods
     */
    private calculateYieldCurveZScore;
    /**
     * Market breadth calculation
     */
    private calculateMarketBreadth;
    /**
     * Get current VIX level for breadth calculations
     */
    private getCurrentVIX;
    /**
     * Risk and momentum calculations
     */
    private calculateRiskAppetite;
    private determineMarketMomentum;
    private detectFlightToSafety;
    /**
     * Helper methods
     */
    private calculate1DayChange;
    private calculate5DayChange;
    private identifyMissingData;
    /**
     * Emergency fallback - attempts real data first, only uses conservative estimates for development
     * NOTE: This should only be used in non-production environments with explicit flag
     */
    private getEmergencyFallbackMarketStructure;
}
/**
 * Initialize Market Structure Fetcher
 */
export declare function initializeMarketStructureFetcher(options?: MarketStructureFetcherOptions): MarketStructureFetcher;
export default MarketStructureFetcher;
//# sourceMappingURL=market-structure-fetcher.d.ts.map