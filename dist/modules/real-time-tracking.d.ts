/**
 * Real-Time Signal Tracking System
 * Live monitoring and performance analysis for high-confidence signals
 */
import type { CloudflareEnvironment } from '../types';
interface TrackingConfig {
    PRICE_UPDATE_INTERVAL: number;
    SIGNAL_CHECK_INTERVAL: number;
    PERFORMANCE_UPDATE_INTERVAL: number;
    DIVERGENCE_THRESHOLD_HIGH: number;
    DIVERGENCE_THRESHOLD_MEDIUM: number;
    ACCURACY_THRESHOLD_HIGH: number;
    ACCURACY_THRESHOLD_LOW: number;
    HIGH_CONFIDENCE_MIN: number;
    VERY_HIGH_CONFIDENCE_MIN: number;
}
interface PriceData {
    symbol: string;
    currentPrice: number;
    previousPrice: number;
    change: number;
    changePercent: number;
    timestamp: number;
    volume: number;
    lastUpdated: number;
}
interface PriceCache {
    [symbol: string]: PriceData;
}
interface SignalPerformance {
    currentPrice: number;
    changePercent: number;
    isCorrect: boolean;
    accuracy: number;
    divergenceLevel: 'low' | 'medium' | 'high';
    status: 'pending' | 'tracking' | 'validated' | 'divergent';
    lastUpdated: number;
    priceTimestamp: number;
}
interface SignalTracking {
    intradayPerformance?: SignalPerformance;
}
interface SignalData {
    id: string;
    symbol: string;
    prediction: 'up' | 'down' | 'neutral';
    predictedPrice: number;
    currentPrice: number;
    confidence: number;
    status: 'pending' | 'tracking' | 'validated' | 'divergent';
    tracking?: SignalTracking;
}
interface SignalSummary {
    totalSignals: number;
    highConfidenceSignals: number;
    validatedSignals: number;
    divergentSignals: number;
    trackingSignals: number;
    averageAccuracy: number;
    topPerformers: SignalPerformanceInfo[];
    underperformers: SignalPerformanceInfo[];
    signalsByStatus: {
        [status: string]: SignalData[];
    };
}
interface SignalPerformanceInfo {
    symbol: string;
    confidence: number;
    accuracy: number;
    divergenceLevel: string;
    status: string;
}
/**
 * Real-time tracking configuration
 */
declare const TRACKING_CONFIG: TrackingConfig;
/**
 * Real-time price tracking
 */
declare class RealTimePriceTracker {
    private priceCache;
    private lastUpdateTime;
    /**
     * Get current market price for a symbol
     */
    getCurrentPrice(symbol: string): Promise<PriceData | null>;
    /**
     * Get batch prices for multiple symbols
     */
    getBatchPrices(symbols: string[]): Promise<PriceCache>;
    /**
     * Clear price cache
     */
    clearCache(): void;
}
/**
 * Real-time signal performance tracking
 */
declare class RealTimeSignalTracker {
    private priceTracker;
    private activeSignals;
    constructor();
    /**
     * Load active signals for tracking
     */
    loadActiveSignals(env: CloudflareEnvironment, date: Date): Promise<void>;
    /**
     * Update all signal performances in real-time
     */
    updateAllSignalPerformances(env: CloudflareEnvironment, date: Date): Promise<void>;
    /**
     * Calculate signal performance based on current price
     */
    calculateSignalPerformance(signal: SignalData, currentPrice: PriceData): SignalPerformance;
    /**
     * Update individual signal performance
     */
    updateSignalPerformance(env: CloudflareEnvironment, signalId: string, performanceUpdate: SignalPerformance, date: Date): Promise<void>;
    /**
     * Get signal summary for intraday report
     */
    getSignalSummary(env: CloudflareEnvironment, date: Date): Promise<SignalSummary>;
    /**
     * Get divergent signals for alerting
     */
    getDivergentSignals(): SignalData[];
    /**
     * Clear active signals
     */
    clearActiveSignals(): void;
}
declare const realTimeSignalTracker: RealTimeSignalTracker;
export { RealTimePriceTracker, RealTimeSignalTracker, TRACKING_CONFIG, realTimeSignalTracker };
export type { TrackingConfig, PriceData, PriceCache, SignalPerformance, SignalTracking, SignalData, SignalSummary, SignalPerformanceInfo };
//# sourceMappingURL=real-time-tracking.d.ts.map