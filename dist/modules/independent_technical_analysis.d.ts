/**
 * Independent Technical Analysis Module
 * Demonstrates that technical indicators can run completely independently
 * without neural networks or sentiment analysis
 */
import type { CloudflareEnvironment } from '../types.js';
interface TechnicalFeatures {
    close: number;
    rsi_14: number | null;
    bb_position: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_histogram: number | null;
    price_vs_sma20: number | null;
    volume_ratio: number | null;
    williams_r: number | null;
    stoch_k: number | null;
    [key: string]: number | null;
}
interface TechnicalSignal {
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
interface TechnicalSignalError {
    symbol: string;
    error: string;
    status: 'failed';
}
interface OHLCData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface SystemPerformance {
    success_rate: number;
    avg_confidence: number;
    feature_coverage: number;
}
interface IndependentAnalysisResult {
    timestamp: string;
    analysis_type: string;
    feature_count: number;
    symbols_analyzed: string[];
    technical_signals: {
        [symbol: string]: TechnicalSignal | TechnicalSignalError;
    };
    system_performance: SystemPerformance;
}
/**
 * Run pure technical analysis independently
 */
export declare function runIndependentTechnicalAnalysis(symbols: string[], env: CloudflareEnvironment): Promise<IndependentAnalysisResult>;
export type { TechnicalFeatures, TechnicalSignal, TechnicalSignalError, OHLCData, SystemPerformance, IndependentAnalysisResult };
declare const _default: {
    runIndependentTechnicalAnalysis: typeof runIndependentTechnicalAnalysis;
};
export default _default;
//# sourceMappingURL=independent_technical_analysis.d.ts.map