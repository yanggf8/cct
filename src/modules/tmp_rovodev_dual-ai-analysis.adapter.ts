// Adapter for v1 sentiment routes expecting performDualAIAnalysis(symbols, env)
import type { CloudflareEnvironment } from '../types.js';
import { getFreeStockNews } from './free_sentiment_pipeline.js';
import { performDualAIComparison } from './dual-ai-analysis.js';

export async function performDualAIAnalysis(symbols: string[], env: CloudflareEnvironment): Promise<any> {
  const results: any[] = [];
  for (const symbol of symbols) {
    try {
      const newsData = await getFreeStockNews(symbol, env);
      const comp = await performDualAIComparison(symbol, newsData, env);
      results.push({
        symbol,
        gpt_sentiment: comp.models.gpt?.direction || 'neutral',
        gpt_confidence: comp.models.gpt?.confidence ?? 0,
        gpt_reasoning: comp.models.gpt?.reasoning || '',
        distilbert_sentiment: comp.models.distilbert?.direction || 'neutral',
        distilbert_confidence: comp.models.distilbert?.confidence ?? 0,
        distilbert_positive: comp.models.distilbert?.sentiment_breakdown?.bullish ?? 0,
        distilbert_negative: comp.models.distilbert?.sentiment_breakdown?.bearish ?? 0,
        distilbert_neutral: comp.models.distilbert?.sentiment_breakdown?.neutral ?? 0,
        agreement_type: comp.comparison.agreement_type?.toUpperCase?.() || 'DISAGREEMENT',
        overall_confidence: ((comp.models.gpt?.confidence ?? 0) + (comp.models.distilbert?.confidence ?? 0)) / 2,
        recommendation: comp.signal?.action || 'HOLD',
        news_count: comp.models.gpt?.articles_analyzed || 0,
        top_articles: []
      });
    } catch (e) {
      results.push({ symbol, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  }

  const score = results.reduce((acc, r) => {
    const dir = (r.gpt_sentiment || 'neutral');
    const val = dir === 'bullish' ? 1 : dir === 'bearish' ? -1 : 0;
    return acc + val;
  }, 0) / (results.length || 1);

  return {
    overall_sentiment: score,
    overall_sentiment_label: score > 0.1 ? 'BULLISH' : score < -0.1 ? 'BEARISH' : 'NEUTRAL',
    overall_confidence: Math.abs(score),
    signals: results
  };
}
