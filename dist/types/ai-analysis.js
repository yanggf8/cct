/**
 * AI Analysis Type Definitions
 *
 * Comprehensive type definitions for AI analysis results, replacing AI: any patterns.
 * Covers GPT, DistilBERT, and dual AI analysis interfaces.
 */
// ============================================================================
// Type Guards
// ============================================================================
/**
 * Type guard for GPTAnalysisResult
 */
export function isGPTAnalysisResult(result) {
    return result?.model === 'gpt' &&
        typeof result?.sentiment === 'string' &&
        typeof result?.confidence === 'number' &&
        typeof result?.reasoning === 'string';
}
/**
 * Type guard for DistilBERTAnalysisResult
 */
export function isDistilBERTAnalysisResult(result) {
    return result?.model === 'distilbert' &&
        typeof result?.sentiment === 'string' &&
        typeof result?.confidence === 'number' &&
        typeof result?.scores === 'object';
}
/**
 * Type guard for SingleModelAnalysis
 */
export function isSingleModelAnalysis(result) {
    return isGPTAnalysisResult(result) || isDistilBERTAnalysisResult(result);
}
/**
 * Type guard for DualAIAnalysisResult
 */
export function isDualAIAnalysisResult(result) {
    return result?.symbol &&
        typeof result?.timestamp === 'string' &&
        typeof result?.analysis === 'object' &&
        typeof result?.comparison === 'object' &&
        typeof result?.recommendation === 'object';
}
/**
 * Type guard for BatchAnalysisResult
 */
export function isBatchAnalysisResult(result) {
    return result?.timestamp &&
        typeof result?.requestId === 'string' &&
        Array.isArray(result?.results) &&
        typeof result?.summary === 'object';
}
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Extract sentiment from analysis result
 */
export function getSentiment(result) {
    if (isSingleModelAnalysis(result)) {
        return result.sentiment;
    }
    if (isDualAIAnalysisResult(result)) {
        return result.recommendation.signal.toLowerCase().includes('buy') ? 'bullish' :
            result.recommendation.signal.toLowerCase().includes('sell') ? 'bearish' : 'neutral';
    }
    return 'neutral';
}
/**
 * Extract confidence from analysis result
 */
export function getConfidence(result) {
    if (isSingleModelAnalysis(result)) {
        return result.confidence;
    }
    if (isDualAIAnalysisResult(result)) {
        return result.recommendation.confidence;
    }
    return 0;
}
/**
 * Check if analysis is high confidence
 */
export function isHighConfidence(result, threshold = 0.7) {
    return getConfidence(result) >= threshold;
}
/**
 * Get primary recommendation from dual analysis
 */
export function getPrimaryRecommendation(result) {
    return result.recommendation.signal;
}
/**
 * Get reasoning summary from analysis
 */
export function getReasoningSummary(result) {
    if (isSingleModelAnalysis(result)) {
        return isGPTAnalysisResult(result) ? result.reasoning : `Sentiment: ${result.sentiment} (${(result.confidence * 100).toFixed(1)}%)`;
    }
    if (isDualAIAnalysisResult(result)) {
        return result.recommendation.reasoning;
    }
    return 'No reasoning available';
}
//# sourceMappingURL=ai-analysis.js.map