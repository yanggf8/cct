/**
 * Enhanced Feature Analysis Module
 * Integrates 33 technical indicators with existing GPT-OSS-120B + DistilBERT-SST-2 dual AI models
 * Combines feature-rich analysis with sentiment for maximum prediction accuracy
 */
import type { CloudflareEnvironment } from '../types.js';
interface FeatureWeights {
    dual_ai_models: number;
    technical_features: number;
    sentiment_analysis: number;
}
interface FeatureImportance {
    'rsi_14': number;
    'bb_position': number;
    'macd_histogram': number;
    'return_5d': number;
    'volume_ratio': number;
    'price_vs_sma20': number;
    'atr': number;
    'stoch_k': number;
    'williams_r': number;
    'sma20_slope': number;
}
interface SentimentData {
    sentiment_score: number;
    confidence: number;
    reasoning: string;
    error?: string;
}
interface NeuralSignal {
    symbol: string;
    current_price: number;
    predicted_price: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    [key: string]: any;
}
interface TechnicalFeatures {
    [key: string]: number | null;
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
}
interface TechnicalPrediction {
    predicted_price: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    technical_score: number;
    reasoning: string;
    signal_strength: number;
}
interface NeuralComponent {
    predicted_price: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    weight: number;
}
interface TechnicalComponent extends TechnicalPrediction {
    weight: number;
    feature_count: number;
}
interface SentimentComponent {
    sentiment_score: number;
    confidence: number;
    reasoning: string;
    weight: number;
}
interface Components {
    neural_networks: NeuralComponent | null;
    technical_features: TechnicalComponent | null;
    sentiment_analysis: SentimentComponent;
}
interface EnhancedSignal {
    symbol: string;
    timestamp: string;
    current_price: number;
    predicted_price: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    model: string;
    components: Components;
    technical_summary?: string;
    feature_status?: string;
    error?: string;
}
interface SystemPerformance {
    success_rate: number;
    avg_confidence: number;
    feature_coverage: number;
}
interface Methodology {
    neural_networks: string;
    technical_features: string;
    sentiment_analysis: string;
}
interface EnhancedFeatureAnalysisResult {
    timestamp: string;
    analysis_type: string;
    feature_count: number;
    symbols_analyzed: string[];
    trading_signals: {
        [symbol: string]: EnhancedSignal | any;
    };
    system_performance: SystemPerformance;
    methodology: Methodology;
}
interface OHLCData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface ConsensusVotes {
    UP: number;
    DOWN: number;
    NEUTRAL: number;
}
interface CombinedPrediction {
    predicted_price: number;
    direction: 'UP' | 'DOWN' | 'NEUTRAL';
    confidence: number;
    consensus_votes: ConsensusVotes;
}
/**
 * Enhanced stock analysis with technical features
 */
export declare function runEnhancedFeatureAnalysis(symbols: string[], env: CloudflareEnvironment): Promise<EnhancedFeatureAnalysisResult>;
export type { FeatureWeights, FeatureImportance, SentimentData, NeuralSignal, TechnicalFeatures, TechnicalPrediction, NeuralComponent, TechnicalComponent, SentimentComponent, Components, EnhancedSignal, SystemPerformance, Methodology, EnhancedFeatureAnalysisResult, OHLCData, ConsensusVotes, CombinedPrediction };
export type EnhancedAnalysisResults = EnhancedFeatureAnalysisResult;
declare const _default: {
    runEnhancedFeatureAnalysis: typeof runEnhancedFeatureAnalysis;
    FEATURE_WEIGHTS: FeatureWeights;
    FEATURE_IMPORTANCE: FeatureImportance;
};
export default _default;
//# sourceMappingURL=enhanced_feature_analysis.d.ts.map