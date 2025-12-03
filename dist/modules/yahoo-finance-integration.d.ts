/**
 * Yahoo Finance Integration Module
 *
 * Provides simplified Yahoo Finance API integration for market structure indicators.
 * Uses the existing rate limiter and follows established patterns from the codebase.
 *
 * Features:
 * - Rate-limited Yahoo Finance API calls
 * - Simple market data fetching
 * - Error handling and retry logic
 * - Support for key market indicators (VIX, SPY, Dollar Index, etc.)
 *
 * @author Market Drivers Pipeline - Phase 2 Day 3
 * @since 2025-10-10
 */
/**
 * Market data interface
 */
export interface MarketData {
    symbol: string;
    price: number;
    regularMarketPrice: number;
    regularMarketChange: number;
    regularMarketChangePercent: number;
    regularMarketTime: number;
    currency: string;
    marketState: string;
    exchangeName: string;
    quoteType: string;
    success: boolean;
    timestamp: number;
}
/**
 * Get market data for a single symbol
 */
export declare function getMarketData(symbol: string): Promise<MarketData | null>;
/**
 * Get market data for multiple symbols (batch processing)
 */
export declare function getBatchMarketData(symbols: string[]): Promise<Record<string, MarketData | null>>;
/**
 * Get specific market structure indicators
 */
export declare function getMarketStructureIndicators(): Promise<{
    vix?: MarketData;
    spy?: MarketData;
    dollarIndex?: MarketData;
    tenYearTreasury?: MarketData;
    twoYearTreasury?: MarketData;
    qqq?: MarketData;
}>;
/**
 * Health check for Yahoo Finance API
 */
export declare function healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
}>;
/**
 * Format market data for display
 */
export declare function formatMarketData(data: MarketData): string;
/**
 * Check if market is open
 */
export declare function isMarketOpen(marketData?: MarketData): boolean;
/**
 * Get market status description
 */
export declare function getMarketStatus(marketData?: MarketData): string;
export declare function getHistoricalData(symbol: string, startDate: string, endDate: string): Promise<any[]>;
declare const _default: {
    getMarketData: typeof getMarketData;
    getBatchMarketData: typeof getBatchMarketData;
    getMarketStructureIndicators: typeof getMarketStructureIndicators;
    healthCheck: typeof healthCheck;
    formatMarketData: typeof formatMarketData;
    isMarketOpen: typeof isMarketOpen;
    getMarketStatus: typeof getMarketStatus;
};
export default _default;
//# sourceMappingURL=yahoo-finance-integration.d.ts.map