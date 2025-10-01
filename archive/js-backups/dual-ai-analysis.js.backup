/**
 * Dual AI Comparison Analysis Module
 * Simple, transparent dual AI system that runs GPT-OSS-120B and DistilBERT side-by-side
 * and reports whether they agree or disagree with clear decision rules.
 */

import { getFreeStockNews } from './free_sentiment_pipeline.js';
import { parseNaturalLanguageResponse, mapSentimentToDirection } from './sentiment_utils.js';
import { initLogging, logInfo, logError, logSentimentDebug, logAIDebug } from './logging.js';

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env) {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

/**
 * Main dual AI comparison function
 * Runs both AI models in parallel and provides simple comparison
 */
export async function performDualAIComparison(symbol, newsData, env) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting dual AI comparison for ${symbol}...`);

  try {
    // Run both AI models independently and in parallel
    const [gptResult, distilBERTResult] = await Promise.all([
      performGPTAnalysis(symbol, newsData, env),
      performDistilBERTAnalysis(symbol, newsData, env)
    ]);

    // Simple agreement check
    const agreement = checkAgreement(gptResult, distilBERTResult);

    // Generate trading signal based on simple rules
    const signal = generateSignal(agreement, gptResult, distilBERTResult);

    const executionTime = Date.now() - startTime;

    return {
      symbol,
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,

      // Individual model results
      models: {
        gpt: gptResult,
        distilbert: distilBERTResult
      },

      // Simple comparison
      comparison: {
        agree: agreement.agree,
        agreement_type: agreement.type, // 'full_agreement', 'partial_agreement', 'disagreement'
        match_details: agreement.details
      },

      // Clear signal based on agreement
      signal: signal,

      // Performance tracking
      performance_metrics: {
        total_time: executionTime,
        models_executed: 2,
        successful_models: [gptResult, distilBERTResult].filter(r => !r.error).length
      }
    };

  } catch (error) {
    logError(`Dual AI comparison failed for ${symbol}:`, error);
    return {
      symbol,
      timestamp: new Date().toISOString(),
      error: error.message,
      models: { gpt: null, distilbert: null },
      comparison: { agree: false, type: 'error', details: { error: error.message } },
      signal: { type: 'ERROR', direction: 'UNCLEAR', strength: 'FAILED', action: 'SKIP' }
    };
  }
}

/**
 * GPT Analysis (Same as before but standalone)
 */
async function performGPTAnalysis(symbol, newsData, env) {
  if (!newsData || newsData.length === 0) {
    return {
      model: 'gpt-oss-120b',
      direction: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      error: 'No data'
    };
  }

  try {
    const topArticles = newsData.slice(0, 8);
    const newsContext = topArticles
      .map((item, i) => `${i+1}. ${item.title}\n   ${item.summary || ''}\n   Source: ${item.source}`)
      .join('\n\n');

    const prompt = `As a financial analyst specializing in ${symbol}, analyze these news articles and provide:

1. Overall sentiment (bullish/bearish/neutral)
2. Confidence level (0-100%)
3. Key reasons for this sentiment
4. Short-term trading implications

${newsContext}`;

    const response = await env.AI.run('@cf/openchat/openchat-3.5-0106', {
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 600
    });

    const analysisData = parseNaturalLanguageResponse(response.response);

    return {
      model: 'gpt-oss-120b',
      direction: mapSentimentToDirection(analysisData.sentiment),
      confidence: analysisData.confidence,
      reasoning: analysisData.reasoning || 'No detailed reasoning provided',
      raw_response: response.response,
      articles_analyzed: topArticles.length,
      analysis_type: 'contextual_analysis'
    };

  } catch (error) {
    logError(`GPT analysis failed for ${symbol}:`, error);
    return {
      model: 'gpt-oss-120b',
      direction: 'neutral',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * DistilBERT Analysis (Same as before but standalone)
 */
async function performDistilBERTAnalysis(symbol, newsData, env) {
  if (!newsData || newsData.length === 0) {
    return {
      model: 'distilbert-sst-2-int8',
      direction: 'neutral',
      confidence: 0,
      reasoning: 'No news data available',
      error: 'No data'
    };
  }

  try {
    const results = await Promise.all(
      newsData.slice(0, 10).map(async (article, index) => {
        try {
          const text = `${article.title}. ${article.summary || ''}`.substring(0, 500);

          const response = await env.AI.run(
            '@cf/huggingface/distilbert-sst-2-int8',
            { text: text }
          );

          const result = response[0];
          return {
            index,
            sentiment: result.label.toLowerCase(),
            confidence: result.score,
            title: article.title.substring(0, 100)
          };
        } catch (error) {
          return { index, sentiment: 'neutral', confidence: 0, error: error.message };
        }
      })
    );

    // Simple aggregation
    const validResults = results.filter(r => !r.error);
    const bullishCount = validResults.filter(r => r.sentiment === 'positive').length;
    const bearishCount = validResults.filter(r => r.sentiment === 'negative').length;

    let direction = 'neutral';
    if (bullishCount > bearishCount * 1.5) direction = 'bullish';
    else if (bearishCount > bullishCount * 1.5) direction = 'bearish';

    const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;

    return {
      model: 'distilbert-sst-2-int8',
      direction: mapSentimentToDirection(direction),
      confidence: avgConfidence,
      articles_analyzed: validResults.length,
      sentiment_breakdown: {
        bullish: bullishCount,
        bearish: bearishCount,
        neutral: validResults.length - bullishCount - bearishCount
      },
      individual_results: validResults,
      analysis_type: 'sentiment_classification'
    };

  } catch (error) {
    logError(`DistilBERT analysis failed for ${symbol}:`, error);
    return {
      model: 'distilbert-sst-2-int8',
      direction: 'neutral',
      confidence: 0,
      reasoning: `Analysis failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Simple Agreement Check
 */
function checkAgreement(gptResult, distilBERTResult) {
  const gptDir = gptResult.direction;
  const dbDir = distilBERTResult.direction;

  // Full agreement: same direction
  if (gptDir === dbDir) {
    return {
      agree: true,
      type: 'full_agreement',
      details: {
        match_direction: gptDir,
        confidence_spread: Math.abs(gptResult.confidence - distilBERTResult.confidence)
      }
    };
  }

  // Partial agreement: neutral vs directional
  if (gptDir === 'neutral' || dbDir === 'neutral') {
    return {
      agree: false,
      type: 'partial_agreement',
      details: {
        gpt_direction: gptDir,
        distilbert_direction: dbDir,
        dominant_direction: gptDir === 'neutral' ? dbDir : gptDir
      }
    };
  }

  // Full disagreement: opposite directions
  return {
    agree: false,
    type: 'disagreement',
    details: {
      gpt_direction: gptDir,
      distilbert_direction: dbDir,
      confidence_spread: Math.abs(gptResult.confidence - distilBERTResult.confidence)
    }
  };
}

/**
 * Simple Signal Generation Rules
 */
function generateSignal(agreement, gptResult, distilBERTResult) {
  if (agreement.agree) {
    // Both models agree - this is our strongest signal
    return {
      type: 'AGREEMENT',
      direction: gptResult.direction,
      strength: calculateAgreementStrength(gptResult.confidence, distilBERTResult.confidence),
      reasoning: `Both AI models agree on ${gptResult.direction} sentiment`,
      action: getActionForAgreement(gptResult.direction, gptResult.confidence, distilBERTResult.confidence)
    };
  }

  if (agreement.type === 'partial_agreement') {
    // One model neutral, one directional
    const directionalModel = gptResult.direction === 'neutral' ? distilBERTResult : gptResult;
    return {
      type: 'PARTIAL_AGREEMENT',
      direction: directionalModel.direction,
      strength: 'MODERATE',
      reasoning: `Mixed signals: ${agreement.details.gpt_direction} vs ${agreement.details.distilbert_direction}`,
      action: directionalModel.confidence > 0.7 ? 'CONSIDER' : 'HOLD'
    };
  }

  // Full disagreement
  return {
    type: 'DISAGREEMENT',
    direction: 'UNCLEAR',
    strength: 'WEAK',
    reasoning: `Models disagree: GPT says ${gptResult.direction}, DistilBERT says ${distilBERTResult.direction}`,
    action: 'AVOID'
  };
}

/**
 * Action rules for agreement signals
 */
function getActionForAgreement(direction, gptConfidence, dbConfidence) {
  const avgConfidence = (gptConfidence + dbConfidence) / 2;

  if (avgConfidence >= 0.8) {
    return direction === 'bullish' ? 'STRONG_BUY' : 'STRONG_SELL';
  } else if (avgConfidence >= 0.6) {
    return direction === 'bullish' ? 'BUY' : 'SELL';
  } else {
    return direction === 'bullish' ? 'WEAK_BUY' : 'WEAK_SELL';
  }
}

/**
 * Calculate agreement strength
 */
function calculateAgreementStrength(gptConfidence, dbConfidence) {
  const avgConfidence = (gptConfidence + dbConfidence) / 2;
  if (avgConfidence >= 0.8) return 'STRONG';
  if (avgConfidence >= 0.6) return 'MODERATE';
  return 'WEAK';
}

/**
 * Batch dual AI analysis for multiple symbols
 */
export async function batchDualAIAnalysis(symbols, env, options = {}) {
  const startTime = Date.now();
  ensureLoggingInitialized(env);
  logInfo(`Starting batch dual AI analysis for ${symbols.length} symbols...`);

  const results = [];
  const statistics = {
    total_symbols: symbols.length,
    full_agreement: 0,
    partial_agreement: 0,
    disagreement: 0,
    errors: 0
  };

  // Process symbols in small batches for rate limiting
  const batchSize = 2; // Conservative for AI rate limits
  const batches = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const batchPromises = batch.map(async (symbol) => {
      try {
        logAIDebug(`Analyzing ${symbol} with dual AI...`);

        // Get news data
        const newsData = await getFreeStockNews(symbol, env);

        // Run dual AI comparison
        const dualAIResult = await performDualAIComparison(symbol, newsData, env);

        // Track statistics
        if (dualAIResult.error) {
          statistics.errors++;
        } else if (dualAIResult.comparison.agree) {
          statistics.full_agreement++;
        } else if (dualAIResult.comparison.agreement_type === 'partial_agreement') {
          statistics.partial_agreement++;
        } else {
          statistics.disagreement++;
        }

        return {
          symbol,
          success: !dualAIResult.error,
          result: dualAIResult,
          newsCount: newsData?.length || 0
        };

      } catch (error) {
        logError(`Dual AI analysis failed for ${symbol}:`, error);
        statistics.errors++;
        return {
          symbol,
          success: false,
          error: error.message
        };
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.allSettled(batchPromises);

    // Process results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.push(result.value.result);
      } else {
        const symbol = result.status === 'fulfilled' ? result.value.symbol : 'unknown';
        const error = result.status === 'fulfilled' ? result.value.error : result.reason?.message;

        results.push({
          symbol,
          timestamp: new Date().toISOString(),
          error: error || 'Unknown error',
          models: { gpt: null, distilbert: null },
          comparison: { agree: false, type: 'error', details: { error } },
          signal: { type: 'ERROR', direction: 'UNCLEAR', strength: 'FAILED', action: 'SKIP' }
        });
      }
    });

    // Small delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const totalTime = Date.now() - startTime;
  logInfo(`Batch dual AI analysis completed in ${totalTime}ms: ${statistics.full_agreement} agreements, ${statistics.disagreement} disagreements`);

  return {
    results,
    statistics,
    execution_metadata: {
      total_execution_time: totalTime,
      symbols_processed: results.length,
      agreement_rate: statistics.full_agreement / symbols.length,
      success_rate: (symbols.length - statistics.errors) / symbols.length
    }
  };
}