/**
 * FREE Sentiment Analysis Pipeline
 * Uses free APIs instead of paid services
 * Target: 70-78% accuracy with $0 news API costs
 */
import type { CloudflareEnvironment } from '../types.js';
interface FreeSentimentConfig {
    apis: {
        fmp: {
            baseUrl: string;
            endpoints: {
                stock_news: string;
                social_sentiment: string;
            };
            rateLimit: string;
            hasSentiment: boolean;
        };
        newsapi: {
            baseUrl: string;
            endpoints: {
                everything: string;
                headlines: string;
            };
            rateLimit: string;
            hasSentiment: boolean;
        };
        yahoo: {
            baseUrl: string;
            endpoints: {
                news: string;
            };
            rateLimit: string;
            hasSentiment: boolean;
        };
    };
    llm: {
        provider: string;
        model: string;
        fallback: string;
    };
}
interface NewsArticle {
    title: string;
    summary: string;
    publishedAt: string;
    source: string;
    url: string;
    sentiment: {
        label: string;
        score: number;
    };
    confidence: number;
    source_type: string;
    llm_sentiment?: {
        label: string;
        score: number;
        reasoning: string;
        price_impact: string;
    };
}
interface SentimentSignal {
    symbol: string;
    sentiment: string;
    confidence: number;
    score?: number;
    reasoning: string;
    source_count: number;
    sources?: string[];
    timestamp?: string;
}
interface TechnicalSignal {
    direction: string;
    confidence?: number;
}
interface HybridSignal {
    symbol: string;
    hybrid_prediction: {
        direction: string;
        confidence: number;
        combined_score: number;
        reasoning: string;
    };
    technical_component: {
        direction: string;
        confidence: number;
        weight: number;
    };
    sentiment_component: {
        direction: string;
        confidence: number;
        weight: number;
        reasoning: string;
        sources?: string[];
    };
    timestamp: string;
}
declare const FREE_SENTIMENT_CONFIG: FreeSentimentConfig;
/**
 * Get free stock news with sentiment analysis
 */
export declare function getFreeStockNews(symbol: string, env: CloudflareEnvironment): Promise<NewsArticle[]>;
/**
 * Rule-based sentiment analysis (fallback when LLM unavailable)
 */
export declare function analyzeTextSentiment(text: string): {
    label: string;
    score: number;
};
/**
 * Main free sentiment analysis function
 */
export declare function getFreeSentimentSignal(symbol: string, env: CloudflareEnvironment): Promise<SentimentSignal>;
/**
 * Integrate free sentiment with existing technical analysis
 */
export declare function generateFreeSentimentHybrid(symbol: string, technicalSignal: TechnicalSignal, env: CloudflareEnvironment): Promise<HybridSignal>;
export type { NewsArticle, SentimentSignal, TechnicalSignal, HybridSignal, FreeSentimentConfig };
export { FREE_SENTIMENT_CONFIG };
//# sourceMappingURL=free_sentiment_pipeline.d.ts.map