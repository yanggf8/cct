/**
 * Sector Indicators Module - TypeScript
 * Technical analysis indicators for sector rotation analysis
 * Calculates OBV, CMF, and relative strength indicators for institutional money flow tracking
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */
import { OHLCVBar } from './data-validation.js';
export interface OBVData {
    symbol: string;
    obv: number;
    obvChange: number;
    obvTrend: 'up' | 'down' | 'neutral';
    volumeTrend: 'accumulating' | 'distributing' | 'neutral';
    timestamp: number;
}
export interface CMFData {
    symbol: string;
    cmf: number;
    cmfChange: number;
    moneyFlowSignal: 'bullish' | 'bearish' | 'neutral';
    moneyFlowVolume: number;
    timestamp: number;
}
export interface RelativeStrengthData {
    symbol: string;
    benchmark: string;
    relativeStrength: number;
    rsTrend: 'outperforming' | 'underperforming' | 'neutral';
    momentumScore: number;
    timestamp: number;
}
export interface SectorIndicators {
    symbol: string;
    timestamp: number;
    obv?: OBVData;
    cmf?: CMFData;
    relativeStrength?: RelativeStrengthData;
    overallSignal: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
}
export interface IndicatorConfig {
    obv: {
        period: number;
        smoothingFactor: number;
    };
    cmf: {
        period: number;
    };
    relativeStrength: {
        benchmark: string;
        period: number;
    };
}
/**
 * Sector Indicators Calculator
 */
export declare class SectorIndicators {
    private dal;
    private validator;
    private config;
    constructor(env: any, config?: Partial<IndicatorConfig>);
    /**
     * Calculate On-Balance Volume (OBV) indicator
     * OBV measures buying and selling pressure by adding volume on up days and subtracting on down days
     */
    calculateOBV(symbol: string, historicalData: OHLCVBar[]): Promise<OBVData | null>;
    /**
     * Calculate Chaikin Money Flow (CMF) indicator
     * CMF measures money flow volume over a period, indicating buying/selling pressure
     */
    calculateCMF(symbol: string, historicalData: OHLCVBar[]): Promise<CMFData | null>;
    /**
     * Calculate Relative Strength indicator
     * Measures how a sector performs relative to a benchmark (SPY)
     */
    calculateRelativeStrength(symbol: string, sectorData: OHLCVBar[], benchmarkData: OHLCVBar[]): Promise<RelativeStrengthData | null>;
    /**
     * Calculate all indicators for a sector
     */
    calculateAllIndicators(symbol: string, sectorData: OHLCVBar[], benchmarkData?: OHLCVBar[]): Promise<SectorIndicators | null>;
    /**
     * Store indicators in KV cache
     */
    storeIndicators(indicators: SectorIndicators): Promise<void>;
    /**
     * Retrieve indicators from KV cache
     */
    getIndicators(symbol: string): Promise<SectorIndicators | null>;
    /**
     * Calculate Exponential Moving Average
     */
    private calculateEMA;
    /**
     * Determine trend based on change and threshold
     */
    private determineTrend;
    /**
     * Calculate total return over period
     */
    private calculateReturns;
    /**
     * Calculate momentum score based on price action consistency
     */
    private calculateMomentumScore;
    /**
     * Analyze overall signal from individual indicators
     */
    private analyzeOverallSignal;
    /**
     * Get configuration
     */
    getConfig(): IndicatorConfig;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IndicatorConfig>): void;
}
/**
 * Default sector indicators instance
 */
export declare const defaultSectorIndicators: (env: any) => SectorIndicators;
/**
 * Convenience functions for common indicator operations
 */
export declare function calculateSectorOBV(symbol: string, data: OHLCVBar[]): Promise<OBVData | null>;
export declare function calculateSectorCMF(symbol: string, data: OHLCVBar[]): Promise<CMFData | null>;
export declare function calculateSectorRelativeStrength(symbol: string, sectorData: OHLCVBar[], benchmarkData: OHLCVBar[]): Promise<RelativeStrengthData | null>;
//# sourceMappingURL=sector-indicators.d.ts.map