/**
 * Pre-Market Data Bridge Module
 * Bridges the gap between sentiment analysis data and pre-market reporting
 * Transforms modern API v1 sentiment data into the legacy format expected by pre-market reports
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Trading signal structure expected by pre-market reports
 */
interface TradingSignal {
    symbol: string;
    sentiment_layers: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
}
/**
 * Analysis data structure expected by pre-market reports
 */
interface AnalysisData {
    trading_signals: Record<string, TradingSignal>;
    timestamp: string;
    generated_at: string;
}
/**
 * Pre-Market Data Bridge
 * Transforms modern sentiment data into legacy format for pre-market reporting
 */
export declare class PreMarketDataBridge {
    private dal;
    constructor(env: CloudflareEnvironment);
    /**
     * Generate and store pre-market analysis data from modern sentiment data
     * This bridges the gap between the modern API and legacy reporting system
     */
    generatePreMarketAnalysis(symbols?: string[]): Promise<AnalysisData>;
    /**
     * Get symbol sentiment data from cache or by triggering analysis
     */
    private getSymbolSentimentData;
    /**
     * Normalize sentiment values to match expected format
     */
    private normalizeSentiment;
    /**
     * Force refresh of pre-market analysis data
     */
    refreshPreMarketAnalysis(symbols?: string[]): Promise<AnalysisData>;
    /**
     * Check if pre-market analysis data exists
     */
    hasPreMarketAnalysis(): Promise<boolean>;
    /**
     * Get current pre-market analysis data
     */
    getCurrentPreMarketAnalysis(): Promise<AnalysisData | null>;
}
/**
 * Create pre-market data bridge instance
 */
export declare function createPreMarketDataBridge(env: CloudflareEnvironment): PreMarketDataBridge;
/**
 * Quick utility function to generate pre-market data
 * This can be called by scripts or other modules
 */
export declare function generatePreMarketData(env: CloudflareEnvironment, symbols?: string[]): Promise<void>;
/**
 * Quick utility function to refresh pre-market data
 */
export declare function refreshPreMarketData(env: CloudflareEnvironment, symbols?: string[]): Promise<void>;
export {};
//# sourceMappingURL=pre-market-data-bridge.d.ts.map