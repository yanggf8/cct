/**
 * HTML Generation Utilities for Report Handlers
 * Centralizes HTML generation logic to reduce handler complexity
 */
interface Metric {
    value: string | number;
    label: string;
    icon?: string;
    trend?: string;
    trendColor?: string;
    color?: string;
    description?: string;
    progress?: number;
    progressColor?: string;
}
interface Tab {
    id: string;
    label: string;
    active?: boolean;
}
interface Signal {
    symbol: string;
    direction: string;
    confidence?: number;
    reason?: string;
    targetPrice?: number;
    analysis?: string;
}
interface ModelResult {
    direction?: string;
    confidence?: number;
    reasoning?: string;
    sentiment_breakdown?: {
        bullish?: number;
        bearish?: number;
        neutral?: number;
    };
}
interface Comparison {
    agree?: boolean;
    agreement_type?: string;
    details?: {
        match_direction?: string;
        confidence_spread?: number;
    };
}
interface TradingSignal {
    direction?: string;
    action?: string;
    strength?: string;
    reasoning?: string;
}
interface DualAISignal {
    symbol: string;
    comparison?: Comparison;
    models?: {
        gpt?: ModelResult;
        distilbert?: ModelResult;
    };
    signal?: TradingSignal;
}
interface Validation {
    missing?: string[];
    completionRate?: number;
}
interface SentimentData {
    bullish?: number;
    bearish?: number;
    neutral?: number;
}
interface AgreementStats {
    agreementRate: number;
    avgConfidence: number;
    highConfidenceSignals: number;
}
/**
 * Common HTML header template
 */
export declare function generateHTMLHeader(title: string, description: string): string;
/**
 * Common HTML footer template
 */
export declare function generateHTMLFooter(systemStatus?: string): string;
/**
 * Generate metrics display grid
 */
export declare function generateMetricsGrid(metrics: Metric[]): string;
/**
 * Generate signal display item
 */
export declare function generateSignalItem(signal: Signal): string;
/**
 * Generate dual AI signal display item with enhanced model comparison
 */
export declare function generateDualAISignalItem(signal: DualAISignal): string;
/**
 * Generate waiting/pending state display
 */
export declare function generateWaitingDisplay(message: string, validation?: Validation | null): string;
/**
 * Generate error display
 */
export declare function generateErrorDisplay(error: string, details?: any): string;
/**
 * Generate success display
 */
export declare function generateSuccessDisplay(message: string, data?: any): string;
/**
 * Generate loading spinner
 */
export declare function generateLoadingSpinner(message?: string): string;
/**
 * Generate navigation tabs
 */
export declare function generateNavigationTabs(tabs: Tab[]): string;
/**
 * Complete page generator
 */
export declare function generateCompletePage(title: string, description: string, content: string, status?: string): string;
/**
 * Generate enhanced metrics grid with trend indicators
 */
export declare function generateEnhancedMetricsGrid(metrics: Metric[], title?: string): string;
/**
 * Generate comprehensive dual AI analysis summary
 */
export declare function generateDualAISummary(analysis: Record<string, DualAISignal>): string;
/**
 * Generate market sentiment overview
 */
export declare function generateMarketSentimentOverview(sentiment: SentimentData): string;
declare const _default: {
    generateHTMLHeader: typeof generateHTMLHeader;
    generateHTMLFooter: typeof generateHTMLFooter;
    generateMetricsGrid: typeof generateMetricsGrid;
    generateSignalItem: typeof generateSignalItem;
    generateDualAISignalItem: typeof generateDualAISignalItem;
    generateWaitingDisplay: typeof generateWaitingDisplay;
    generateErrorDisplay: typeof generateErrorDisplay;
    generateSuccessDisplay: typeof generateSuccessDisplay;
    generateLoadingSpinner: typeof generateLoadingSpinner;
    generateNavigationTabs: typeof generateNavigationTabs;
    generateCompletePage: typeof generateCompletePage;
    generateEnhancedMetricsGrid: typeof generateEnhancedMetricsGrid;
    generateDualAISummary: typeof generateDualAISummary;
    generateMarketSentimentOverview: typeof generateMarketSentimentOverview;
};
export default _default;
export type { Metric, Tab, Signal, ModelResult, Comparison, TradingSignal, DualAISignal, Validation, SentimentData, AgreementStats };
//# sourceMappingURL=html-generators.d.ts.map