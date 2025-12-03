/**
 * Pre-Market Analysis Module
 * Core logic for morning high-confidence signal analysis (≥70%)
 */
interface TradingSignal {
    sentiment_layers?: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
    overall_confidence?: number;
    primary_direction?: string;
}
interface AIModel {
    direction: string;
    confidence: number;
}
interface DualAIComparison {
    agree: boolean;
    agreement_type: string;
}
interface TradingSignalData {
    direction: string;
    strength: 'STRONG' | 'MODERATE' | 'WEAK';
    action: string;
}
interface AnalysisSignal {
    analysis_type?: string;
    models?: {
        gpt?: AIModel;
        distilbert?: AIModel;
    };
    comparison?: DualAIComparison;
    signal?: TradingSignalData;
    trading_signals?: TradingSignal;
    sentiment_layers?: Array<{
        sentiment: string;
        confidence: number;
        reasoning: string;
    }>;
}
interface AnalysisData {
    trading_signals: Record<string, AnalysisSignal>;
}
interface ProcessedSignal {
    symbol: string;
    sentiment: string;
    direction: string;
    confidence: number;
    expectedMove: string;
    driver: string;
    aiInsights?: {
        agree: boolean;
        agreement_type: string;
        gpt_direction?: string;
        distilbert_direction?: string;
        signal_action?: string;
    };
}
interface PreMarketResult {
    bias: string;
    biasDisplay: string;
    confidence: number;
    bullishCount: number;
    bearishCount: number;
    totalSymbols: number;
    highConfidenceUps: ProcessedSignal[];
    highConfidenceDowns: ProcessedSignal[];
    strongestSectors: string[];
    weakestSectors: string[];
    riskItems: Array<{
        symbol: string;
        description: string;
    }>;
}
/**
 * Generate high-confidence pre-market signals from analysis data
 */
export declare function generatePreMarketSignals(analysisData: AnalysisData | null): PreMarketResult;
export type { TradingSignal, AIModel, DualAIComparison, TradingSignalData, AnalysisSignal, AnalysisData, ProcessedSignal, PreMarketResult };
//# sourceMappingURL=pre-market-analysis.d.ts.map