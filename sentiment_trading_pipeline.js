/**
 * Sentiment-Based Trading Pipeline
 * Hybrid approach: LLM sentiment analysis + technical indicators
 * Target: 75-82% direction accuracy (vs current 58-62%)
 */

// Configuration
const SENTIMENT_CONFIG = {
  sources: {
    news: { weight: 0.4, api: 'alpha_vantage' },
    reddit: { weight: 0.2, api: 'sentiment_radar' },
    twitter: { weight: 0.2, api: 'custom_scraper' },
    earnings: { weight: 0.2, api: 'seeking_alpha' }
  },
  llm: {
    provider: 'openai', // or 'gemini'
    model: 'gpt-4o-mini', // Cost-effective for sentiment
    max_tokens: 150
  },
  temporal_weights: {
    '1h': 0.5,   // Recent sentiment weighted higher
    '4h': 0.3,
    '24h': 0.2
  }
};

/**
 * Main sentiment analysis pipeline
 */
async function analyzeSentiment(symbol, env) {
  try {
    // 1. Gather multi-source data
    const sentimentData = await gatherSentimentData(symbol, env);

    // 2. Process with LLM
    const llmSentiment = await processWithLLM(sentimentData, symbol, env);

    // 3. Calculate temporal-weighted sentiment
    const weightedSentiment = calculateTemporalSentiment(llmSentiment);

    // 4. Generate trading signal
    const sentimentSignal = generateSentimentSignal(weightedSentiment, symbol);

    return sentimentSignal;

  } catch (error) {
    console.error(`Sentiment analysis failed for ${symbol}:`, error);
    return { sentiment: 'neutral', confidence: 0, reasoning: 'Analysis failed' };
  }
}

/**
 * Gather sentiment data from multiple sources
 */
async function gatherSentimentData(symbol, env) {
  const data = {};

  // News data (Alpha Vantage News API)
  try {
    data.news = await getNewsData(symbol, env);
  } catch (error) {
    console.log(`News data failed for ${symbol}:`, error.message);
    data.news = [];
  }

  // Reddit sentiment (simplified - would use SentimentRadar API in production)
  try {
    data.reddit = await getRedditSentiment(symbol, env);
  } catch (error) {
    console.log(`Reddit data failed for ${symbol}:`, error.message);
    data.reddit = { sentiment: 'neutral', posts: 0 };
  }

  // Twitter/X sentiment (simplified)
  try {
    data.twitter = await getTwitterSentiment(symbol, env);
  } catch (error) {
    console.log(`Twitter data failed for ${symbol}:`, error.message);
    data.twitter = { sentiment: 'neutral', mentions: 0 };
  }

  return data;
}

/**
 * Get news data from Alpha Vantage
 */
async function getNewsData(symbol, env) {
  const API_KEY = env.ALPHA_VANTAGE_API_KEY;
  if (!API_KEY) {
    throw new Error('Alpha Vantage API key not configured');
  }

  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${API_KEY}&limit=10`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.Note || data['Error Message']) {
    throw new Error(data.Note || data['Error Message']);
  }

  // Extract relevant news items
  const newsItems = data.feed?.slice(0, 5).map(item => ({
    title: item.title,
    summary: item.summary,
    time_published: item.time_published,
    source: item.source,
    sentiment_score: item.overall_sentiment_score,
    sentiment_label: item.overall_sentiment_label
  })) || [];

  return newsItems;
}

/**
 * Get Reddit sentiment (mock implementation - would use SentimentRadar API)
 */
async function getRedditSentiment(symbol, env) {
  // Mock implementation - in production would use SentimentRadar API
  // or scrape specific subreddits like r/wallstreetbets, r/stocks

  return {
    sentiment: 'neutral',
    score: 0.0,
    posts: 0,
    comments: 0,
    reasoning: 'Mock Reddit sentiment - implement SentimentRadar API'
  };
}

/**
 * Get Twitter sentiment (mock implementation)
 */
async function getTwitterSentiment(symbol, env) {
  // Mock implementation - in production would monitor specific accounts
  // @DeItaone, @unusual_whales, @zerohedge, etc.

  return {
    sentiment: 'neutral',
    score: 0.0,
    mentions: 0,
    reasoning: 'Mock Twitter sentiment - implement Twitter API v2'
  };
}

/**
 * Process sentiment data with LLM (GPT-4 or Gemini)
 */
async function processWithLLM(sentimentData, symbol, env) {
  // Prepare context for LLM
  const context = prepareLLMContext(sentimentData, symbol);

  const prompt = `Analyze the financial sentiment for ${symbol} based on recent data:

${context}

Provide analysis in this exact JSON format:
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 0.85,
  "price_impact": "high|medium|low",
  "reasoning": "One sentence explanation of key sentiment drivers",
  "time_horizon": "hours|days|weeks"
}

Focus on market-moving information and institutional sentiment over retail noise.`;

  try {
    // Use OpenAI API (or switch to Gemini)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: SENTIMENT_CONFIG.llm.model,
        messages: [
          {
            role: 'system',
            content: 'You are a financial sentiment analyst specializing in stock price prediction. Provide precise, actionable sentiment analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: SENTIMENT_CONFIG.llm.max_tokens,
        temperature: 0.1 // Low temperature for consistent analysis
      })
    });

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Parse JSON response
    const sentimentAnalysis = JSON.parse(content);

    return {
      ...sentimentAnalysis,
      timestamp: new Date().toISOString(),
      source: 'llm_analysis'
    };

  } catch (error) {
    console.error('LLM sentiment analysis failed:', error);
    return {
      sentiment: 'neutral',
      confidence: 0,
      price_impact: 'low',
      reasoning: 'LLM analysis failed',
      time_horizon: 'unknown'
    };
  }
}

/**
 * Prepare context for LLM analysis
 */
function prepareLLMContext(sentimentData, symbol) {
  let context = `Stock: ${symbol}\n\n`;

  // Add news headlines and sentiment
  if (sentimentData.news?.length > 0) {
    context += "Recent News:\n";
    sentimentData.news.forEach((item, index) => {
      context += `${index + 1}. ${item.title} (${item.sentiment_label}: ${item.sentiment_score})\n`;
    });
    context += "\n";
  }

  // Add social media context
  if (sentimentData.reddit?.posts > 0) {
    context += `Reddit: ${sentimentData.reddit.sentiment} sentiment (${sentimentData.reddit.posts} posts)\n`;
  }

  if (sentimentData.twitter?.mentions > 0) {
    context += `Twitter: ${sentimentData.twitter.sentiment} sentiment (${sentimentData.twitter.mentions} mentions)\n`;
  }

  return context;
}

/**
 * Calculate temporal-weighted sentiment
 */
function calculateTemporalSentiment(llmSentiment) {
  // In a full implementation, this would weight recent sentiment higher
  // and combine multiple timeframes

  const sentimentScore = mapSentimentToScore(llmSentiment.sentiment);
  const confidence = llmSentiment.confidence || 0;

  return {
    score: sentimentScore,
    confidence: confidence,
    weighted_score: sentimentScore * confidence,
    direction: sentimentScore > 0.1 ? 'bullish' : sentimentScore < -0.1 ? 'bearish' : 'neutral',
    strength: Math.abs(sentimentScore) * confidence,
    reasoning: llmSentiment.reasoning
  };
}

/**
 * Map sentiment labels to numerical scores
 */
function mapSentimentToScore(sentiment) {
  const mapping = {
    'bullish': 0.8,
    'bearish': -0.8,
    'neutral': 0.0,
    'positive': 0.6,
    'negative': -0.6
  };

  return mapping[sentiment?.toLowerCase()] || 0.0;
}

/**
 * Generate trading signal from sentiment
 */
function generateSentimentSignal(weightedSentiment, symbol) {
  const { score, confidence, direction, strength, reasoning } = weightedSentiment;

  // Determine signal strength based on sentiment score and confidence
  let signal_strength = 'weak';
  if (strength > 0.6) signal_strength = 'strong';
  else if (strength > 0.3) signal_strength = 'medium';

  return {
    symbol: symbol,
    sentiment_direction: direction,
    sentiment_score: score,
    confidence: confidence,
    signal_strength: signal_strength,
    reasoning: reasoning,
    timestamp: new Date().toISOString(),

    // Trading recommendations
    recommendation: generateTradeRecommendation(direction, strength),
    risk_level: calculateRiskLevel(confidence, strength),
    time_horizon: strength > 0.5 ? 'short_term' : 'medium_term'
  };
}

/**
 * Generate trade recommendation based on sentiment
 */
function generateTradeRecommendation(direction, strength) {
  if (strength < 0.2) return 'hold';

  if (direction === 'bullish') {
    return strength > 0.6 ? 'strong_buy' : 'buy';
  } else if (direction === 'bearish') {
    return strength > 0.6 ? 'strong_sell' : 'sell';
  }

  return 'hold';
}

/**
 * Calculate risk level for sentiment-based trade
 */
function calculateRiskLevel(confidence, strength) {
  const risk_score = (1 - confidence) + (strength * 0.5);

  if (risk_score < 0.3) return 'low';
  if (risk_score < 0.6) return 'medium';
  return 'high';
}

/**
 * Hybrid prediction: combine sentiment with technical analysis
 */
async function generateHybridPrediction(symbol, technicalSignal, env) {
  // Get sentiment analysis
  const sentimentSignal = await analyzeSentiment(symbol, env);

  // Combine signals with weighted approach
  const hybridSignal = combineSignals(technicalSignal, sentimentSignal, symbol);

  return hybridSignal;
}

/**
 * Combine technical and sentiment signals
 */
function combineSignals(technicalSignal, sentimentSignal, symbol) {
  // Weight allocation (can be adjusted based on market conditions)
  const TECHNICAL_WEIGHT = 0.6;
  const SENTIMENT_WEIGHT = 0.4;

  // Convert technical direction to score
  const technicalScore = mapDirectionToScore(technicalSignal.direction);
  const sentimentScore = sentimentSignal.sentiment_score;

  // Calculate weighted prediction
  const combinedScore = (technicalScore * TECHNICAL_WEIGHT) + (sentimentScore * SENTIMENT_WEIGHT);
  const combinedDirection = combinedScore > 0.1 ? 'UP' : combinedScore < -0.1 ? 'DOWN' : 'FLAT';

  // Calculate hybrid confidence
  const technicalConfidence = technicalSignal.confidence || 0.5;
  const sentimentConfidence = sentimentSignal.confidence || 0.5;
  const hybridConfidence = (technicalConfidence * TECHNICAL_WEIGHT) + (sentimentConfidence * SENTIMENT_WEIGHT);

  return {
    symbol: symbol,
    hybrid_prediction: {
      direction: combinedDirection,
      confidence: hybridConfidence,
      combined_score: combinedScore,
      reasoning: `Technical: ${technicalSignal.direction} (${(technicalConfidence*100).toFixed(1)}%), Sentiment: ${sentimentSignal.sentiment_direction} (${(sentimentConfidence*100).toFixed(1)}%)`
    },
    technical_component: {
      direction: technicalSignal.direction,
      confidence: technicalConfidence,
      weight: TECHNICAL_WEIGHT
    },
    sentiment_component: {
      direction: sentimentSignal.sentiment_direction,
      confidence: sentimentConfidence,
      weight: SENTIMENT_WEIGHT,
      reasoning: sentimentSignal.reasoning
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Map direction strings to numerical scores
 */
function mapDirectionToScore(direction) {
  const mapping = {
    'UP': 0.8,
    'DOWN': -0.8,
    'FLAT': 0.0,
    'NEUTRAL': 0.0
  };

  return mapping[direction?.toUpperCase()] || 0.0;
}

// Export functions for use in Cloudflare Workers
export {
  analyzeSentiment,
  generateHybridPrediction,
  combineSignals,
  SENTIMENT_CONFIG
};