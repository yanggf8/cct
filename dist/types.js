// Re-export for backward compatibility
export { toAppError, isAppError } from './types/errors';
// AI Analysis types
export { isGPTAnalysisResult, isDistilBERTAnalysisResult, isDualAIAnalysisResult } from './types/ai-analysis';
// API types
export { createSuccessResponse, createErrorResponse, isErrorResponse, isSuccessResponse } from './types/api';
// ============================================================================
// Type Guard Functions
// ============================================================================
/**
 * Type guard for SignalTrackingData
 */
export function isSignalTrackingData(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    // Check basic structure
    const hasValidDate = typeof data.date === 'string';
    const hasValidSignals = Array.isArray(data.signals);
    if (!hasValidDate || !hasValidSignals)
        return false;
    // Check signal structure - ensure they have required TrackedSignal properties
    const hasValidSignalStructure = data.signals.length === 0 || data.signals.every((signal) => typeof signal.id === 'string' &&
        typeof signal.symbol === 'string' &&
        typeof signal.prediction === 'string' &&
        typeof signal.confidence === 'number' &&
        typeof signal.currentPrice === 'number' &&
        typeof signal.status === 'string' &&
        typeof signal.tracking === 'object');
    if (!hasValidSignalStructure)
        return false;
    // Check for either metadata (from types.ts) or lastUpdated (from analysis.ts)
    const hasMetadata = typeof data.metadata === 'object' && typeof data.metadata.total_signals === 'number';
    const hasLastUpdated = typeof data.lastUpdated === 'string';
    return hasMetadata || hasLastUpdated;
}
/**
 * Type guard for AnalysisResult
 */
export function isAnalysisResult(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return (typeof data.date === 'string' &&
        Array.isArray(data.symbols) &&
        typeof data.summary === 'object' &&
        typeof data.summary.total_symbols === 'number' &&
        typeof data.metadata === 'object');
}
/**
 * Type guard for DualAISignal
 */
export function isDualAISignal(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return (typeof data.symbol === 'string' &&
        typeof data.models === 'object' &&
        typeof data.comparison === 'object' &&
        typeof data.final_signal === 'string' &&
        typeof data.confidence === 'number');
}
/**
 * Type guard for MessageTracking
 */
export function isMessageTracking(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return (typeof data.tracking_id === 'string' &&
        typeof data.platform === 'string' &&
        typeof data.message_type === 'string' &&
        typeof data.recipient_id === 'string' &&
        typeof data.status === 'string' &&
        typeof data.error_count === 'number');
}
/**
 * Type guard for SymbolAnalysis
 */
export function isSymbolAnalysis(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return (typeof data.symbol === 'string' &&
        typeof data.confidence === 'number' &&
        typeof data.timestamp === 'string');
}
/**
 * Type guard for KVResult
 */
export function isKVResult(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return (typeof data.success === 'boolean' &&
        (data.data !== undefined || data.error !== undefined));
}
/**
 * Type guard for ApiResponse
 */
export function isApiResponse(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return typeof data.success === 'boolean';
}
/**
 * Type guard for SystemHealth
 */
export function isSystemHealth(value) {
    if (!value || typeof value !== 'object')
        return false;
    const data = value;
    return (typeof data.success === 'boolean' &&
        typeof data.status === 'string' &&
        typeof data.version === 'string' &&
        typeof data.services === 'object');
}
/**
 * Safely extract primary sentiment from sentiment layers
 * @param layers - Optional array of sentiment layers
 * @returns Primary sentiment with defaults if layers are missing or empty
 */
export function getPrimarySentiment(layers) {
    if (!layers || layers.length === 0) {
        return {
            sentiment: 'NEUTRAL',
            confidence: 0,
            reasoning: 'No sentiment data available'
        };
    }
    // Find layer with highest confidence
    const primaryLayer = layers.reduce((prev, current) => (current.confidence > prev.confidence) ? current : prev);
    return {
        sentiment: primaryLayer.sentiment,
        confidence: primaryLayer.confidence,
        reasoning: primaryLayer.reasoning || 'Automated sentiment analysis'
    };
}
/**
 * SafeGet - safely get nested object property with default value
 */
export function safeGet(obj, path, defaultValue) {
    try {
        const keys = path.split('.');
        let result = obj;
        for (const key of keys) {
            if (result === null || result === undefined) {
                return defaultValue;
            }
            result = result[key];
        }
        return result !== undefined && result !== null ? result : defaultValue;
    }
    catch (error) {
        return defaultValue;
    }
}
/**
 * AssertNonEmpty - runtime check that array is not empty
 */
export function assertNonEmpty(array, message = 'Array must not be empty') {
    if (array.length === 0) {
        throw new Error(message);
    }
    // @ts-ignore - Type assertion for non-empty array
    return array;
}
/**
 * Apply defaults to partial options object
 */
export function applyDefaults(partial, defaults) {
    return { ...defaults, ...partial };
}
/**
 * Normalize input to array - handles single item, array, or undefined
 */
export function asArray(input) {
    if (input === undefined || input === null) {
        return [];
    }
    return Array.isArray(input) ? input : [input];
}
/**
 * Type guard for non-empty arrays
 */
export function isNonEmpty(arr) {
    return Array.isArray(arr) && arr.length > 0;
}
//# sourceMappingURL=types.js.map