/**
 * Intraday Analysis Module
 * Real-time performance tracking of morning predictions vs current market performance
 */
import type { CloudflareEnvironment } from '../../types.js';
interface TradingSignal {
    sentiment_layers?: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
    overall_confidence?: number;
    primary_direction?: string;
}
interface AnalysisSignal {
    trading_signals?: TradingSignal;
    sentiment_layers?: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
}
interface AnalysisData {
    symbols_analyzed: string[];
    trading_signals: Record<string, AnalysisSignal>;
}
interface CurrentPrice {
    current: number;
    change: number;
    changePercent: number;
}
interface CurrentPrices {
    [symbol: string]: CurrentPrice;
}
interface SymbolPerformance {
    symbol: string;
    current: number;
    change: number;
    direction: string;
}
interface OnTrackSignal {
    ticker: string;
    predicted: string;
    predictedDirection: string;
    actual: string;
    actualDirection: string;
}
interface Divergence {
    ticker: string;
    predicted: string;
    predictedDirection: string;
    actual: string;
    actualDirection: string;
    level: 'high' | 'medium';
    reason: string;
}
interface ModelHealth {
    status: 'on-track' | 'warning' | 'error';
    display: string;
}
interface RecalibrationAlert {
    status: 'yes' | 'no';
    message: string;
}
interface IntradayResult {
    modelHealth: ModelHealth;
    totalSignals: number;
    correctCalls: number;
    wrongCalls: number;
    pendingCalls: number;
    divergences: Divergence[];
    onTrackSignals: OnTrackSignal[];
    avgDivergence: number;
    liveAccuracy: number;
    recalibrationAlert: RecalibrationAlert;
}
interface MorningPredictions {
    [symbol: string]: any;
}
/**
 * Generate real-time intraday performance tracking
 */
export declare function generateIntradayPerformance(analysisData: AnalysisData | null, morningPredictions: MorningPredictions | null, env: CloudflareEnvironment): Promise<IntradayResult>;
export type { TradingSignal, AnalysisSignal, AnalysisData, CurrentPrice, CurrentPrices, SymbolPerformance, OnTrackSignal, Divergence, ModelHealth, RecalibrationAlert, IntradayResult, MorningPredictions };
//# sourceMappingURL=intraday-analysis.d.ts.map