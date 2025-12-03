/**
 * Shared Sentiment Analysis Utilities
 * Consolidates common functions used across sentiment modules
 */
interface ParsedSentimentResponse {
    sentiment: string;
    confidence: number;
    price_impact: string;
    reasoning: string;
    time_horizon: string;
    key_factors: string[];
    market_context: string;
}
interface ModelCost {
    input_tokens: number;
    output_tokens: number;
    input_cost: number;
    output_cost: number;
    total_cost: number;
    model: string;
}
interface ModelPricing {
    input: number;
    output: number;
}
/**
 * Parse natural language response from AI models (GPT, Llama, etc.)
 * Extracts sentiment, confidence, and reasoning from unstructured text
 */
export declare function parseNaturalLanguageResponse(content: string): ParsedSentimentResponse;
/**
 * Structured logger with log levels and request ID support
 */
export declare class SentimentLogger {
    private requestId;
    constructor(requestId?: string | null);
    private _log;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any): void;
    debug(message: string, data?: any): void;
}
/**
 * Calculate cost estimates for different AI models
 */
export declare function calculateModelCost(model: string, inputTokens: number, outputTokens: number): ModelCost;
/**
 * Map sentiment strings to trading directions
 */
export declare function mapSentimentToDirection(sentiment: string): string;
/**
 * Check if two sentiment directions agree
 */
export declare function checkDirectionAgreement(direction1: string, direction2: string): boolean;
/**
 * Convert confidence percentage to reliability level
 */
export declare function confidenceToReliability(confidence: number): 'high' | 'medium' | 'low';
/**
 * Generate sentiment signal based on confidence and sentiment
 */
export declare function generateSentimentSignal(sentiment: string, confidence: number): {
    signal: 'BUY' | 'SELL' | 'HOLD';
    strength: 'strong' | 'moderate' | 'weak';
    confidence: number;
};
/**
 * Format sentiment data for API response
 */
export declare function formatSentimentForAPI(parsed: ParsedSentimentResponse, symbol?: string, timestamp?: string): {
    symbol?: string;
    sentiment: string;
    confidence: number;
    direction: string;
    price_impact: string;
    reasoning: string;
    signal: string;
    strength: string;
    timestamp: string;
};
export type { ParsedSentimentResponse, ModelCost, ModelPricing };
//# sourceMappingURL=sentiment-utils.d.ts.map