/**
 * Enhanced Signal Tracking System
 * Real-time signal correlation and persistence for 4-report workflow
 */
import { createLogger } from './logging.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
const logger = createLogger('signal-tracking');
/**
 * Signal Tracking Constants
 */
const SIGNAL_CONFIDENCE_THRESHOLD = 70;
const HIGH_CONFIDENCE_THRESHOLD = 80;
const TRACKING_PERIODS = {
    MORNING: 'morning', // 8:30 AM - Pre-Market Briefing
    INTRADAY: 'intraday', // 12:00 PM - Intraday Check
    CLOSE: 'close', // 4:05 PM - End-of-Day Summary
    WEEKLY: 'weekly' // Sunday - Weekly Review
};
/**
 * Signal Status Types
 */
const SIGNAL_STATUS = {
    PENDING: 'pending', // Signal generated, awaiting market validation
    TRACKING: 'tracking', // Being monitored throughout the day
    VALIDATED: 'validated', // Prediction matched actual movement
    DIVERGENT: 'divergent', // Prediction diverged from actual
    COMPLETED: 'completed', // End-of-day analysis complete
    ARCHIVED: 'archived' // Weekly review complete
};
/**
 * Enhanced Signal Structure
 */
class EnhancedSignal {
    constructor(symbol, prediction, confidence, timestamp) {
        this.id = globalThis.crypto.randomUUID();
        this.symbol = symbol;
        this.prediction = prediction; // 'up' | 'down' | 'neutral'
        this.confidence = confidence;
        this.timestamp = timestamp;
        this.status = SIGNAL_STATUS.PENDING;
        this.period = TRACKING_PERIODS.MORNING;
        // Tracking fields
        this.morningPrediction = prediction;
        this.intradayPerformance = null;
        this.endOfDayPerformance = null;
        this.weeklyPerformance = null;
        // Price tracking
        this.openPrice = null;
        this.currentPrice = null;
        this.closePrice = null;
        this.priceTargets = {
            morning: null,
            intraday: null,
            close: null
        };
        // Performance metrics
        this.accuracyScore = null;
        this.divergenceLevel = null;
        this.consistencyRating = null;
        // Analysis metadata
        this.sentimentLayers = [];
        this.marketConditions = {};
        this.reasoning = '';
        this.tags = [];
    }
}
/**
 * Signal Tracking Manager
 */
class SignalTrackingManager {
    constructor() {
        this.activeSignals = new Map();
        this.archivedSignals = new Map();
        this.performanceHistory = new Map();
    }
    /**
     * Create new high-confidence signal
     */
    createHighConfidenceSignal(symbol, prediction, confidence, analysisData) {
        if (confidence < SIGNAL_CONFIDENCE_THRESHOLD) {
            logger.warn(`Signal confidence ${confidence}% below threshold ${SIGNAL_CONFIDENCE_THRESHOLD}%`, { symbol });
            return null;
        }
        const signal = new EnhancedSignal(symbol, prediction, confidence, Date.now());
        // Enrich with analysis data
        signal.sentimentLayers = analysisData.sentiment_layers || [];
        signal.marketConditions = analysisData.market_conditions || {};
        signal.reasoning = analysisData.reasoning || '';
        signal.tags = analysisData.tags || [];
        // Store for tracking
        this.activeSignals.set(signal.id, signal);
        logger.info('Created high-confidence signal', {
            signalId: signal.id,
            symbol,
            prediction,
            confidence,
            status: signal.status
        });
        return signal;
    }
    /**
     * Get high-confidence signals by date
     */
    async getHighConfidenceSignalsByDate(env, date) {
        const dateStr = date.toISOString().split('T')[0];
        const signalsKey = `signals_${dateStr}`;
        try {
            const dal = createSimplifiedEnhancedDAL(env);
            const result = await dal.read(signalsKey);
            if (result.data) {
                return result.data.signals || [];
            }
        }
        catch (error) {
            logger.error('Failed to retrieve signals', { date: dateStr, error: (error instanceof Error ? error.message : String(error)) });
        }
        return [];
    }
    /**
     * Save signals to KV storage
     */
    async saveSignalsToKV(env, date, signals) {
        const dateStr = date.toISOString().split('T')[0];
        const signalsKey = `signals_${dateStr}`;
        try {
            const signalsData = {
                date: dateStr,
                signals: signals,
                metadata: {
                    totalSignals: signals.length,
                    highConfidenceSignals: signals.filter(s => s.confidence >= HIGH_CONFIDENCE_THRESHOLD).length,
                    generatedAt: Date.now()
                }
            };
            const dal = createSimplifiedEnhancedDAL(env);
            await dal.write(signalsKey, signalsData);
            logger.info('Saved signals to KV storage', {
                date: dateStr,
                totalSignals: signals.length,
                highConfidenceSignals: signalsData.metadata.highConfidenceSignals
            });
            return true;
        }
        catch (error) {
            logger.error('Failed to save signals to KV', { date: dateStr, error: (error instanceof Error ? error.message : String(error)) });
            return false;
        }
    }
    /**
     * Update signal performance in real-time
     */
    async updateSignalPerformance(signalId, performanceData) {
        const signal = this.activeSignals.get(signalId);
        if (!signal) {
            logger.warn('Signal not found for performance update', { signalId });
            return false;
        }
        // Update performance data
        signal.intradayPerformance = performanceData.intradayPerformance;
        signal.currentPrice = performanceData.currentPrice;
        signal.divergenceLevel = calculateDivergenceLevel(signal, performanceData);
        // Update status based on performance
        signal.status = determineSignalStatus(signal, performanceData);
        logger.debug('Updated signal performance', {
            signalId,
            status: signal.status,
            divergenceLevel: signal.divergenceLevel,
            currentPrice: signal.currentPrice
        });
        return true;
    }
    /**
     * Complete end-of-day signal analysis
     */
    async completeSignalAnalysis(signalId, marketCloseData) {
        const signal = this.activeSignals.get(signalId);
        if (!signal)
            return false;
        signal.endOfDayPerformance = marketCloseData.performance;
        signal.closePrice = marketCloseData.closePrice;
        signal.accuracyScore = calculateAccuracyScore(signal, marketCloseData);
        signal.status = SIGNAL_STATUS.COMPLETED;
        // Move to performance history
        this.performanceHistory.set(signalId, {
            ...signal,
            completedAt: Date.now()
        });
        logger.info('Completed signal analysis', {
            signalId,
            symbol: signal.symbol,
            accuracyScore: signal.accuracyScore,
            status: signal.status
        });
        return true;
    }
    /**
     * Get signals by status
     */
    getSignalsByStatus(status) {
        return Array.from(this.activeSignals.values()).filter((signal) => signal.status === status);
    }
    /**
     * Get performance statistics
     */
    getPerformanceStatistics() {
        const signals = Array.from(this.performanceHistory.values());
        if (signals.length === 0) {
            return {
                totalSignals: 0,
                averageAccuracy: 0,
                highConfidenceAccuracy: 0,
                divergenceRate: 0
            };
        }
        const totalSignals = signals.length;
        const highConfidenceSignals = signals.filter((s) => s.confidence >= HIGH_CONFIDENCE_THRESHOLD);
        const accurateSignals = signals.filter((s) => s.accuracyScore >= 0.7);
        const divergentSignals = signals.filter((s) => s.divergenceLevel === 'high');
        return {
            totalSignals,
            averageAccuracy: signals.reduce((sum, s) => sum + (s.accuracyScore || 0), 0) / totalSignals,
            highConfidenceAccuracy: highConfidenceSignals.length > 0
                ? highConfidenceSignals.reduce((sum, s) => sum + (s.accuracyScore || 0), 0) / highConfidenceSignals.length
                : 0,
            divergenceRate: divergentSignals.length / totalSignals
        };
    }
}
/**
 * Helper functions
 */
function calculateDivergenceLevel(signal, performanceData) {
    if (!signal.currentPrice || !performanceData.expectedPrice) {
        return 'unknown';
    }
    const divergence = Math.abs(signal.currentPrice - performanceData.expectedPrice) / performanceData.expectedPrice;
    if (divergence > 0.05)
        return 'high';
    if (divergence > 0.02)
        return 'medium';
    return 'low';
}
function determineSignalStatus(signal, performanceData) {
    if (signal.divergenceLevel === 'high') {
        return SIGNAL_STATUS.DIVERGENT;
    }
    if (performanceData.isValidated) {
        return SIGNAL_STATUS.VALIDATED;
    }
    return SIGNAL_STATUS.TRACKING;
}
function calculateAccuracyScore(signal, marketCloseData) {
    if (!signal.prediction || !marketCloseData.actualMovement) {
        return 0;
    }
    const predictedCorrect = signal.prediction === marketCloseData.actualMovement;
    const confidenceWeight = signal.confidence / 100;
    return predictedCorrect ? confidenceWeight : 0;
}
// Global instance
const signalTrackingManager = new SignalTrackingManager();
export { EnhancedSignal, SignalTrackingManager, SIGNAL_CONFIDENCE_THRESHOLD, HIGH_CONFIDENCE_THRESHOLD, SIGNAL_STATUS, TRACKING_PERIODS, signalTrackingManager };
//# sourceMappingURL=signal-tracking.js.map