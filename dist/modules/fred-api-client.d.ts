/**
 * FRED API Client
 *
 * Federal Reserve Economic Data API client for comprehensive macroeconomic data.
 * Provides access to U.S. economic indicators including interest rates,
 * inflation, employment, GDP, and other key metrics.
 *
 * Features:
 * - Rate limiting and retry logic
 * - Caching integration
 * - Data validation and error handling
 * - Bulk data fetching with optimization
 * - Real-time and historical data support
 *
 * @author Market Drivers Pipeline - Phase 2 Day 2
 * @since 2025-10-10
 */
import { FredSeries } from './market-drivers.js';
/**
 * FRED API Response Types
 */
interface FredObservation {
    date: string;
    value: string | null;
    realtime_start: string;
    realtime_end: string;
}
interface FredSeriesResponse {
    realtime_start: string;
    realtime_end: string;
    observation_start: string;
    observation_end: string;
    units: string;
    unit_mult: string;
    seasonal_adjustment: string;
    seasonal_adjustment_short: string;
    frequency: string;
    frequency_short: string;
    last_updated: string;
    sort_order: string;
    count: number;
    observations: FredObservation[];
}
interface FredSeriesInfo {
    id: string;
    title: string;
    units: string;
    unit_mult: string;
    seasonal_adjustment: string;
    seasonal_adjustment_short: string;
    frequency: string;
    frequency_short: string;
    last_updated: string;
    observation_start: string;
    observation_end: string;
    popularity: number;
    notes: string;
}
/**
 * FRED API Client Options
 */
export interface FredApiClientOptions {
    apiKey: string;
    baseUrl?: string;
    rateLimitDelay?: number;
    maxRetries?: number;
    cacheEnabled?: boolean;
    defaultStartDate?: string;
}
/**
 * Processed Economic Data
 */
export interface EconomicData {
    series: FredSeries;
    value: number;
    date: string;
    change: number;
    changePercent: number;
    trend: 'up' | 'down' | 'stable';
    source: string;
    lastUpdated: string;
}
/**
 * Macro Economic Snapshot
 */
export interface MacroEconomicSnapshot {
    timestamp: number;
    date: string;
    fedFundsRate: EconomicData;
    treasury10Y: EconomicData;
    treasury2Y: EconomicData;
    yieldCurveSpread: EconomicData;
    cpi: EconomicData;
    cpiChangePercent: EconomicData;
    coreCpi: EconomicData;
    ppi: EconomicData;
    inflationRate: EconomicData;
    unemploymentRate: EconomicData;
    nonFarmPayrolls: EconomicData;
    laborForceParticipation: EconomicData;
    realGDP: EconomicData;
    gdpGrowthRate: EconomicData;
    industrialProduction: EconomicData;
    consumerConfidence: EconomicData;
    retailSales: EconomicData;
    buildingPermits: EconomicData;
    housingStarts: EconomicData;
    m2MoneySupply: EconomicData;
    leadingIndex: EconomicData;
    metadata: {
        source: 'FRED';
        lastUpdated: string;
        dataFreshness: number;
        seriesCount: number;
        cacheHit: boolean;
    };
}
/**
 * FRED API Client Implementation
 */
export declare class FredApiClient {
    private apiKey;
    private baseUrl;
    private dal;
    private circuitBreaker;
    private rateLimitDelay;
    private maxRetries;
    private cacheEnabled;
    private defaultStartDate;
    constructor(options: FredApiClientOptions);
    /**
     * Get current macro economic snapshot
     */
    getMacroEconomicSnapshot(): Promise<MacroEconomicSnapshot>;
    /**
     * Get specific economic series data
     */
    getSeriesData(series: FredSeries, startDate?: string, endDate?: string, limit?: number): Promise<FredSeriesResponse>;
    /**
     * Get series information
     */
    getSeriesInfo(series: FredSeries): Promise<FredSeriesInfo>;
    /**
     * Fetch all required series for macro snapshot
     */
    private fetchAllRequiredSeries;
    /**
     * Process series data into macro snapshot
     */
    private processSeriesDataToSnapshot;
    /**
     * Make HTTP request with retry logic
     */
    private makeRequest;
    /**
     * Cache operations
     */
    private getCachedSnapshot;
    private cacheSnapshot;
    /**
     * Helper functions
     */
    private calculateTrend;
    private createEmptyEconomicData;
    private getDefaultStartDate;
    private delay;
    /**
     * Health check for FRED API
     */
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
/**
 * Initialize FRED API Client
 */
export declare function initializeFredApiClient(options: FredApiClientOptions): FredApiClient;
/**
 * Mock FRED API Client for development/testing
 * Only used when explicitly requested or when no API key is available
 */
export declare class MockFredApiClient extends FredApiClient {
    constructor();
    getMacroEconomicSnapshot(): Promise<MacroEconomicSnapshot>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export default FredApiClient;
//# sourceMappingURL=fred-api-client.d.ts.map