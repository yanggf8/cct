/**
 * Enhanced Signal Tracking System
 * Real-time signal correlation and persistence for 4-report workflow
 */
/**
 * Signal Tracking Constants
 */
declare const SIGNAL_CONFIDENCE_THRESHOLD = 70;
declare const HIGH_CONFIDENCE_THRESHOLD = 80;
declare const TRACKING_PERIODS: {
    MORNING: string;
    INTRADAY: string;
    CLOSE: string;
    WEEKLY: string;
};
/**
 * Signal Status Types
 */
declare const SIGNAL_STATUS: {
    PENDING: string;
    TRACKING: string;
    VALIDATED: string;
    DIVERGENT: string;
    COMPLETED: string;
    ARCHIVED: string;
};
/**
 * Enhanced Signal Structure
 */
declare class EnhancedSignal {
    id: string;
    symbol: string;
    prediction: string;
    confidence: number;
    timestamp: number;
    status: string;
    period: string;
    morningPrediction: string;
    intradayPerformance: any;
    endOfDayPerformance: any;
    weeklyPerformance: any;
    openPrice: any;
    currentPrice: any;
    closePrice: any;
    priceTargets: any;
    accuracyScore: any;
    divergenceLevel: any;
    consistencyRating: any;
    sentimentLayers: any[];
    marketConditions: any;
    reasoning: string;
    tags: any[];
    constructor(symbol: any, prediction: any, confidence: any, timestamp: any);
}
/**
 * Signal Tracking Manager
 */
declare class SignalTrackingManager {
    activeSignals: Map<any, any>;
    archivedSignals: Map<any, any>;
    performanceHistory: Map<any, any>;
    constructor();
    /**
     * Create new high-confidence signal
     */
    createHighConfidenceSignal(symbol: any, prediction: any, confidence: any, analysisData: any): EnhancedSignal;
    /**
     * Get high-confidence signals by date
     */
    getHighConfidenceSignalsByDate(env: any, date: any): Promise<any>;
    /**
     * Save signals to KV storage
     */
    saveSignalsToKV(env: any, date: any, signals: any): Promise<boolean>;
    /**
     * Update signal performance in real-time
     */
    updateSignalPerformance(signalId: any, performanceData: any): Promise<boolean>;
    /**
     * Complete end-of-day signal analysis
     */
    completeSignalAnalysis(signalId: any, marketCloseData: any): Promise<boolean>;
    /**
     * Get signals by status
     */
    getSignalsByStatus(status: any): any[];
    /**
     * Get performance statistics
     */
    getPerformanceStatistics(): {
        totalSignals: number;
        averageAccuracy: number;
        highConfidenceAccuracy: number;
        divergenceRate: number;
    };
}
declare const signalTrackingManager: SignalTrackingManager;
export { EnhancedSignal, SignalTrackingManager, SIGNAL_CONFIDENCE_THRESHOLD, HIGH_CONFIDENCE_THRESHOLD, SIGNAL_STATUS, TRACKING_PERIODS, signalTrackingManager };
//# sourceMappingURL=signal-tracking.d.ts.map