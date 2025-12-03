/**
 * Real Data Integration Module
 * Eliminates all mock data by integrating with legitimate data sources
 * Provides production-only data fetching with proper error handling
 */
export interface DataSourceConfig {
    name: string;
    baseUrl: string;
    apiKey: string;
    timeoutMs: number;
    retryAttempts: number;
    cacheTtlMs: number;
}
export interface FREDSeries {
    id: string;
    name: string;
    units: string;
    frequency: string;
    lastUpdated: string;
}
export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: string;
}
/**
 * FRED (Federal Reserve Economic Data) Integration
 */
export declare class FREDDataIntegration {
    private readonly config;
    private cache;
    private readonly circuitBreaker;
    constructor(config?: Partial<DataSourceConfig>);
    /**
     * Fetch real economic data from FRED
     */
    fetchSeries(seriesId: string): Promise<number>;
    /**
     * Provide conservative fallback values based on long-term market averages
     */
    private getFallbackValue;
    /**
     * Fetch multiple series in parallel
     */
    fetchMultipleSeries(seriesIds: string[]): Promise<Record<string, number>>;
    /**
     * Get FRED series information
     */
    getSeriesInfo(seriesId: string): Promise<FREDSeries>;
    private fetchWithRetry;
}
/**
 * Yahoo Finance Integration for Market Data
 */
export declare class YahooFinanceIntegration {
    private readonly cache;
    private readonly cacheTtlMs;
    private readonly circuitBreaker;
    constructor();
    /**
     * Fetch real market data for symbols
     */
    fetchMarketData(symbols: string[]): Promise<MarketData[]>;
    /**
     * Fetch VIX data specifically
     */
    fetchVIX(): Promise<number>;
}
/**
 * Real Economic Indicators Service
 * Provides production-only access to real economic data
 */
export declare class RealEconomicIndicators {
    private readonly fredIntegration;
    private readonly yahooFinance;
    constructor();
    /**
     * Get real macroeconomic drivers
     */
    getMacroDrivers(): Promise<{
        fedFundsRate: number;
        treasury10Y: number;
        treasury2Y: number;
        yieldCurveSpread: number;
        cpi: number;
        unemploymentRate: number;
        realGDP: number;
        nonFarmPayrolls: number;
        laborForceParticipation: number;
        lastUpdated: string;
    }>;
    /**
     * Get real market structure
     */
    getMarketStructure(): Promise<{
        vix: number;
        vixTrend: "bullish" | "bearish" | "stable";
        vixPercentile: number;
        usDollarIndex: number;
        dollarTrend: "bullish" | "bearish" | "stable";
        spy: number;
        spyTrend: number;
        yield10Y: number;
        yieldCurveStatus: string;
        sofrRate: number;
        lastUpdated: string;
    }>;
    /**
     * Get real geopolitical risk indicators
     */
    getGeopoliticalRisk(): Promise<{
        tradePolicy: number;
        elections: number;
        conflicts: number;
        overallRiskScore: number;
        highImpactEvents: number;
        articlesAnalyzed: number;
        lastUpdated: string;
    }>;
    private calculateVIXPercentile;
    private determineTrend;
}
export default RealEconomicIndicators;
//# sourceMappingURL=real-data-integration.d.ts.map