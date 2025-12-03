/**
 * Technical Analysis Routes (API v1)
 * Exposes independent technical indicator analysis endpoints
 */
import type { CloudflareEnvironment } from '../types.js';
export interface TechnicalSignalResponse {
    symbol: string;
    timestamp: string;
    current_price: number;
    predicted_price: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    technical_score: number;
    signal_strength: number;
    reasoning: string;
    analysis_type: string;
    feature_summary: string;
}
export interface TechnicalBatchResponse {
    timestamp: string;
    analysis_type: string;
    feature_count: number;
    symbols_analyzed: string[];
    technical_signals: Record<string, TechnicalSignalResponse | {
        symbol: string;
        status: string;
        error?: string;
    }>;
    system_performance: {
        success_rate: number;
        avg_confidence: number;
        feature_coverage: number;
    };
}
/**
 * Handle all technical analysis routes
 */
export declare function handleTechnicalRoutes(request: Request, env: CloudflareEnvironment, path: string, headers: Record<string, string>): Promise<Response>;
//# sourceMappingURL=technical-routes.d.ts.map