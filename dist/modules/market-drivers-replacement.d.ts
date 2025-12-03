/**
 * Production Market Drivers - Real Data Integration Only
 *
 * Complete replacement for mock data with real data sources:
 * - FRED API for economic indicators (with circuit breaker and caching)
 * - Yahoo Finance for market data (with rate limiting and deduplication)
 * - Production guards enforcement (no mock fallbacks)
 * - Structured error handling and source provenance
 * - Request deduplication and TTL management
 */
/**
 * Standardized data source interface with provenance
 */
export interface DataSourceResult {
    value: number;
    timestamp: string;
    source: 'FRED' | 'YahooFinance' | 'AlphaVantage';
    seriesId?: string;
    quality: 'high' | 'medium' | 'low';
    lastValidated: string;
    confidence: number;
}
/**
 * Economic indicators with source provenance
 */
export interface MacroDrivers {
    fedFundsRate: DataSourceResult;
    treasury10Y: DataSourceResult;
    treasury2Y: DataSourceResult;
    yieldCurveSpread: DataSourceResult;
    cpi: DataSourceResult;
    ppi: DataSourceResult;
    inflationRate: DataSourceResult;
    unemploymentRate: DataSourceResult;
    nonFarmPayrolls: DataSourceResult;
    laborForceParticipation: DataSourceResult;
    realGDP: DataSourceResult;
    gdpGrowthRate: DataSourceResult;
    consumerConfidence: DataSourceResult;
    buildingPermits: DataSourceResult;
    housingStarts: DataSourceResult;
    lastUpdated: string;
    dataSourceCompliance: boolean;
}
/**
 * Market structure with source provenance
 */
export interface MarketStructure {
    vix: DataSourceResult;
    vixTrend: 'bullish' | 'bearish' | 'stable';
    vixPercentile: number;
    vixSourceCompliance: boolean;
    usDollarIndex: DataSourceResult;
    dollarTrend: 'bullish' | 'bearish' | 'stable';
    spy: DataSourceResult;
    spyTrend: 'bullish' | 'bearish' | 'stable';
    qqq: DataSourceResult;
    qqqTrend: 'bullish' | 'bearish' | 'stable';
    yield10Y: DataSourceResult;
    yieldCurveStatus: 'normal' | 'inverted' | 'flattening';
    sofrRate: DataSourceResult;
    lastUpdated: string;
    marketDataCompliance: boolean;
}
/**
 * Geopolitical risk with news source provenance
 */
export interface GeopoliticalRisk {
    tradePolicy: DataSourceResult;
    elections: DataSourceResult;
    conflicts: DataSourceResult;
    overallRiskScore: DataSourceResult;
    highImpactEvents: number;
    articlesAnalyzed: number;
    sourcesAnalyzed: string[];
    lastUpdated: string;
    newsSourceCompliance: boolean;
}
/**
 * Production Market Drivers - Real Data Only
 */
export declare class ProductionMarketDrivers {
    private readonly fredIntegration;
    private readonly yahooFinance;
    private readonly deduplicator;
    private readonly fredCircuitBreaker;
    private readonly yahooCircuitBreaker;
    private readonly cache;
    constructor();
    /**
     * Validate API response against production guards
     */
    private validateApiResponse;
    /**
     * Create standardized data result with provenance
     */
    private createDataSourceResult;
    /**
     * Fetch FRED series with deduplication and caching
     */
    private fetchFREDSeries;
    /**
     * Fetch market data with deduplication and caching
     */
    private fetchMarketData;
    /**
     * Get real macroeconomic drivers
     */
    getMacroDrivers(): Promise<MacroDrivers>;
    /**
     * Get real market structure
     */
    getMarketStructure(): Promise<MarketStructure>;
    /**
     * Get real geopolitical risk (placeholder - would integrate with news APIs)
     */
    getGeopoliticalRisk(): Promise<GeopoliticalRisk>;
    /**
     * Simplified VIX percentile calculation (production would use historical data)
     */
    private calculateVIXPercentile;
    /**
     * Simplified trend determination (production would use technical analysis)
     */
    private determineTrend;
    /**
     * Get compliance status
     */
    getComplianceStatus(): {
        isCompliant: boolean;
        mockDataViolations: number;
        apiHealthStatus: {
            fred: string;
            yahooFinance: string;
        };
        lastValidation: string;
    };
}
export declare const productionMarketDrivers: ProductionMarketDrivers;
export type { DataSourceResult, MacroDrivers, MarketStructure, GeopoliticalRisk };
export default ProductionMarketDrivers;
//# sourceMappingURL=market-drivers-replacement.d.ts.map