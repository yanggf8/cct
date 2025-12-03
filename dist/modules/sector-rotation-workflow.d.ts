/**
 * Sector Rotation Analysis Workflow - Sequential Processing
 *
 * Processes 11 SPDR ETFs one by one to avoid rate limiting
 * Implements sequential analysis workflow for sector rotation insights
 *
 * ETFs Analyzed:
 * - XLK: Technology
 * - XLF: Financials
 * - XLV: Health Care
 * - XLE: Energy
 * - XLY: Consumer Discretionary
 * - XLP: Consumer Staples
 * - XLI: Industrials
 * - XLB: Materials
 * - XLU: Utilities
 * - XLRE: Real Estate
 * - XLC: Communication Services
 */
import type { CloudflareEnvironment } from '../types.js';
export declare const SPDR_ETFs: {
    readonly XLK: {
        readonly symbol: "XLK";
        readonly name: "Technology";
        readonly description: "Software, hardware, IT services";
    };
    readonly XLF: {
        readonly symbol: "XLF";
        readonly name: "Financials";
        readonly description: "Banks, insurance, financial services";
    };
    readonly XLV: {
        readonly symbol: "XLV";
        readonly name: "Health Care";
        readonly description: "Pharma, biotech, healthcare providers";
    };
    readonly XLE: {
        readonly symbol: "XLE";
        readonly name: "Energy";
        readonly description: "Oil, gas, energy equipment";
    };
    readonly XLY: {
        readonly symbol: "XLY";
        readonly name: "Consumer Discretionary";
        readonly description: "Retail, autos, entertainment";
    };
    readonly XLP: {
        readonly symbol: "XLP";
        readonly name: "Consumer Staples";
        readonly description: "Food, household products, retail";
    };
    readonly XLI: {
        readonly symbol: "XLI";
        readonly name: "Industrials";
        readonly description: "Manufacturing, transportation, construction";
    };
    readonly XLB: {
        readonly symbol: "XLB";
        readonly name: "Materials";
        readonly description: "Chemicals, metals, mining";
    };
    readonly XLU: {
        readonly symbol: "XLU";
        readonly name: "Utilities";
        readonly description: "Electric, gas, water utilities";
    };
    readonly XLRE: {
        readonly symbol: "XLRE";
        readonly name: "Real Estate";
        readonly description: "REITs, real estate services";
    };
    readonly XLC: {
        readonly symbol: "XLC";
        readonly name: "Communication Services";
        readonly description: "Telecom, media, internet";
    };
};
export type ETFSymbol = keyof typeof SPDR_ETFs;
export interface ETFMarketData {
    symbol: string;
    name: string;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
    volume: number;
    avgVolume: number;
    marketCap: number;
    week52High: number;
    week52Low: number;
    dividend: number;
    dividendYield: number;
    lastUpdated: string;
    ohlcv: number[][];
}
export interface ETFSentimentAnalysis {
    symbol: string;
    name: string;
    sentiment: {
        overall: 'bullish' | 'bearish' | 'neutral';
        confidence: number;
        reasoning: string;
        model: string;
    };
    technicalIndicators: {
        rsi: number;
        macd: number;
        movingAvg50: number;
        movingAvg200: number;
        trend: 'uptrend' | 'downtrend' | 'sideways';
    };
    performanceMetrics: {
        daily: number;
        weekly: number;
        monthly: number;
        ytd: number;
        volatility: number;
    };
    newsSentiment: {
        positiveCount: number;
        negativeCount: number;
        neutralCount: number;
        topHeadlines: string[];
    };
    rotationSignal: {
        strength: 'strong' | 'moderate' | 'weak';
        direction: 'inflow' | 'outflow' | 'neutral';
        reasoning: string;
    };
}
export interface SectorRotationResult {
    timestamp: string;
    analysisDate: string;
    marketConditions: {
        overallTrend: 'bull' | 'bear' | 'neutral';
        volatility: 'low' | 'medium' | 'high';
        riskOn: boolean;
    };
    etfAnalyses: ETFSentimentAnalysis[];
    topSectors: {
        inflow: ETFSymbol[];
        outflow: ETFSymbol[];
    };
    rotationSignals: {
        leadingSector: ETFSymbol;
        laggingSector: ETFSymbol;
        emergingSectors: ETFSymbol[];
        decliningSectors: ETFSymbol[];
    };
    executionMetrics: {
        totalProcessingTime: number;
        averageTimePerETF: number;
        cacheHitRate: number;
        rateLimitAvoided: boolean;
    };
}
export interface WorkflowProgress {
    currentETF: ETFSymbol;
    completed: ETFSymbol[];
    remaining: ETFSymbol[];
    totalProgress: number;
    startTime: string;
    estimatedCompletion: string;
}
/**
 * Sequential Sector Rotation Workflow Manager
 */
export declare class SectorRotationWorkflow {
    private env;
    private dal;
    private etfSymbols;
    private progress;
    private results;
    constructor(env: CloudflareEnvironment);
    /**
     * Execute complete sector rotation analysis sequentially
     */
    executeSequentialAnalysis(): Promise<SectorRotationResult>;
    /**
     * Analyze a single ETF comprehensively
     */
    private analyzeSingleETF;
    /**
     * Get comprehensive market data for ETF
     */
    private getETFMarketData;
    /**
     * Fetch ETF data from Yahoo Finance
     */
    private fetchETFData;
    /**
     * Run AI analysis for ETF using optimized rate-limit-aware analysis
     */
    private runETFAnalysis;
    /**
     * Calculate technical indicators
     */
    private calculateTechnicalIndicators;
    /**
     * Calculate performance metrics
     */
    private calculatePerformanceMetrics;
    /**
     * Get news sentiment for ETF
     */
    private getNewsSentiment;
    /**
     * Generate rotation signal for ETF
     */
    private generateRotationSignal;
    /**
     * Generate comprehensive rotation signals from all ETF analyses
     */
    private generateRotationSignals;
    /**
     * Cache analysis results
     */
    private cacheResults;
    /**
     * Create neutral analysis on failure
     */
    private createNeutralAnalysis;
    /**
     * Helper function for delays
     */
    private delay;
    /**
     * Calculate Simple Moving Average
     */
    private calculateSMA;
    /**
     * Calculate RSI
     */
    private calculateRSI;
    /**
     * Calculate MACD (simplified)
     */
    private calculateMACD;
    /**
     * Calculate Exponential Moving Average
     */
    private calculateEMA;
    /**
     * Get current workflow progress
     */
    getProgress(): WorkflowProgress;
}
/**
 * Execute sector rotation analysis with workflow
 */
export declare function executeSectorRotationAnalysis(env: CloudflareEnvironment): Promise<SectorRotationResult>;
/**
 * Get cached sector rotation results
 */
export declare function getCachedSectorRotationResults(env: CloudflareEnvironment, date?: string): Promise<SectorRotationResult | null>;
/**
 * Alias function for scheduler compatibility
 */
export declare function performSectorRotationAnalysis(env: CloudflareEnvironment, options?: any): Promise<SectorRotationResult | null>;
//# sourceMappingURL=sector-rotation-workflow.d.ts.map