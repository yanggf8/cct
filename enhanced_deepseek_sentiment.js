/**
 * Enhanced DeepSeek V3.1 Sentiment Analysis with Multi-Aspect Analysis
 * Upgrades the current basic sentiment to include reasoning, market impact, and confidence scoring
 */

/**
 * Enhanced sentiment analysis using ModelScope DeepSeek-V3.1 with multi-aspect analysis
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @param {Object} env - Environment variables
 * @returns {Object} Comprehensive sentiment analysis results
 */
async function getEnhancedSentimentAnalysis(symbol, env) {
  try {
    // Get financial news for sentiment analysis
    const newsData = await getFinancialNews(symbol);
    
    if (!newsData.success || newsData.articles.length === 0) {
      console.log(`   ⚠️ No news data for ${symbol}, using neutral sentiment`);
      return {
        signal_score: 0.0,
        confidence: 0.5,
        sentiment: 'NEUTRAL',
        recommendation: 'HOLD',
        market_impact: 'MINIMAL',
        reasoning: 'No recent news available for analysis',
        aspects: {
          technical: { score: 0.0, confidence: 0.5 },
          fundamental: { score: 0.0, confidence: 0.5 },
          market_sentiment: { score: 0.0, confidence: 0.5 },
          risk_assessment: { score: 0.0, confidence: 0.5 }
        },
        news_articles: 0,
        source: 'no_news'
      };
    }
    
    // Enhanced multi-aspect sentiment analysis
    const sentimentResults = [];
    let totalSentiment = 0;
    let sentimentCount = 0;
    
    // Aggregate aspect scores
    const aspectAggregates = {
      technical: { total: 0, count: 0 },
      fundamental: { total: 0, count: 0 }, 
      market_sentiment: { total: 0, count: 0 },
      risk_assessment: { total: 0, count: 0 }
    };
    
    // Process up to 5 most recent articles for comprehensive analysis
    const articlesToAnalyze = newsData.articles.slice(0, 5);
    
    for (const article of articlesToAnalyze) {
      try {
        // Combine title and description for analysis
        const textToAnalyze = `${article.title}. ${article.description || ''}`.substring(0, 1200);
        
        // Check circuit breaker for ModelScope
        if (isCircuitBreakerOpen('modelscope')) {
          console.log(`   🔴 ModelScope circuit breaker open`);
          throw new Error('ModelScope circuit breaker open');
        }
        
        // Enhanced prompt for multi-aspect analysis
        const enhancedPrompt = `As a financial analyst, analyze this news about ${symbol}: "${textToAnalyze}"

Provide a comprehensive analysis in JSON format:
{
  "overall_sentiment": "POSITIVE/NEGATIVE/NEUTRAL",
  "sentiment_score": 0.0-1.0,
  "market_impact": "HIGH/MEDIUM/LOW/MINIMAL", 
  "confidence": 0.0-1.0,
  "reasoning": "detailed explanation of sentiment drivers",
  "aspects": {
    "technical": {"score": -1.0-1.0, "reasoning": "technical analysis impact"},
    "fundamental": {"score": -1.0-1.0, "reasoning": "fundamental business impact"},
    "market_sentiment": {"score": -1.0-1.0, "reasoning": "market psychology impact"},
    "risk_assessment": {"score": -1.0-1.0, "reasoning": "risk factors identified"}
  },
  "time_horizon": "SHORT/MEDIUM/LONG",
  "recommendation": "STRONG_BUY/BUY/HOLD/SELL/STRONG_SELL"
}`;
        
        const sentimentResponse = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'deepseek-ai/DeepSeek-V3.1',
            messages: [
              {
                role: 'system',
                content: 'You are an expert financial analyst. Always respond with valid JSON only. Be precise and analytical.'
              },
              { 
                role: 'user', 
                content: enhancedPrompt 
              }
            ],
            max_tokens: 500,
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });
        
        updateCircuitBreaker('modelscope', true);
        
        if (sentimentResponse.ok) {
          const data = await sentimentResponse.json();
          const content = data.choices[0].message.content;
          
          try {
            // Parse enhanced JSON response
            const sentimentData = JSON.parse(content);
            
            // Convert overall sentiment to numeric score
            let overallScore = 0;
            if (sentimentData.overall_sentiment === 'POSITIVE') {
              overallScore = sentimentData.sentiment_score;
            } else if (sentimentData.overall_sentiment === 'NEGATIVE') {
              overallScore = -sentimentData.sentiment_score;
            }
            
            totalSentiment += overallScore;
            sentimentCount++;
            
            // Aggregate aspect scores
            if (sentimentData.aspects) {
              Object.keys(aspectAggregates).forEach(aspect => {
                if (sentimentData.aspects[aspect] && typeof sentimentData.aspects[aspect].score === 'number') {
                  aspectAggregates[aspect].total += sentimentData.aspects[aspect].score;
                  aspectAggregates[aspect].count++;
                }
              });
            }
            
            sentimentResults.push({
              title: article.title.substring(0, 100),
              sentiment: sentimentData.overall_sentiment,
              score: overallScore,
              confidence: sentimentData.confidence,
              market_impact: sentimentData.market_impact,
              reasoning: sentimentData.reasoning,
              aspects: sentimentData.aspects,
              time_horizon: sentimentData.time_horizon,
              recommendation: sentimentData.recommendation,
              url: article.url
            });
            
          } catch (parseError) {
            console.log(`   ⚠️ Failed to parse DeepSeek response for ${symbol}: ${parseError.message}`);
          }
        }
        
      } catch (aiError) {
        updateCircuitBreaker('modelscope', false);
        console.log(`   ⚠️ ModelScope enhanced sentiment analysis failed: ${aiError.message}`);
      }
    }
    
    if (sentimentCount === 0) {
      return {
        signal_score: 0.0,
        confidence: 0.5,
        sentiment: 'NEUTRAL',
        recommendation: 'HOLD',
        market_impact: 'MINIMAL',
        reasoning: 'Failed to analyze available news articles',
        aspects: {
          technical: { score: 0.0, confidence: 0.5 },
          fundamental: { score: 0.0, confidence: 0.5 },
          market_sentiment: { score: 0.0, confidence: 0.5 },
          risk_assessment: { score: 0.0, confidence: 0.5 }
        },
        news_articles: articlesToAnalyze.length,
        articles_processed: 0,
        source: 'modelscope_deepseek_v3.1_failed'
      };
    }
    
    // Calculate final metrics
    const avgSentiment = totalSentiment / sentimentCount;
    const confidence = Math.max(0.1, Math.min(0.99, sentimentCount / articlesToAnalyze.length));
    
    // Calculate aspect averages
    const finalAspects = {};
    Object.keys(aspectAggregates).forEach(aspect => {
      const agg = aspectAggregates[aspect];
      finalAspects[aspect] = {
        score: agg.count > 0 ? agg.total / agg.count : 0.0,
        confidence: agg.count > 0 ? Math.min(0.99, agg.count / sentimentCount) : 0.5
      };
    });
    
    // Determine overall sentiment and recommendation
    let sentiment = 'NEUTRAL';
    let recommendation = 'HOLD';
    let marketImpact = 'MINIMAL';
    
    if (avgSentiment > 0.3) {
      sentiment = 'POSITIVE';
      recommendation = avgSentiment > 0.6 ? 'BUY' : 'HOLD';
      marketImpact = avgSentiment > 0.6 ? 'HIGH' : 'MEDIUM';
    } else if (avgSentiment < -0.3) {
      sentiment = 'NEGATIVE'; 
      recommendation = avgSentiment < -0.6 ? 'SELL' : 'HOLD';
      marketImpact = avgSentiment < -0.6 ? 'HIGH' : 'MEDIUM';
    }
    
    // Generate reasoning based on aspects
    const aspectInsights = [];
    Object.entries(finalAspects).forEach(([aspect, data]) => {
      if (Math.abs(data.score) > 0.3) {
        const direction = data.score > 0 ? 'positive' : 'negative';
        aspectInsights.push(`${aspect}: ${direction} (${data.score.toFixed(2)})`);
      }
    });
    
    const reasoning = aspectInsights.length > 0 
      ? `Multi-aspect analysis shows: ${aspectInsights.join(', ')}`
      : `Sentiment analysis across ${sentimentCount} articles shows ${sentiment.toLowerCase()} outlook`;
    
    return {
      signal_score: avgSentiment,
      confidence: confidence,
      sentiment: sentiment,
      recommendation: recommendation,
      market_impact: marketImpact,
      reasoning: reasoning,
      aspects: finalAspects,
      news_articles: sentimentCount,
      articles_processed: sentimentResults.length,
      articles_analyzed: sentimentResults,
      source: 'modelscope_deepseek_v3.1_enhanced',
      analysis_timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`   ❌ Enhanced sentiment analysis error for ${symbol}:`, error.message);
    return {
      signal_score: 0.0,
      confidence: 0.5,
      sentiment: 'NEUTRAL',
      recommendation: 'HOLD',
      market_impact: 'MINIMAL',
      reasoning: `Analysis failed: ${error.message}`,
      aspects: {
        technical: { score: 0.0, confidence: 0.5 },
        fundamental: { score: 0.0, confidence: 0.5 },
        market_sentiment: { score: 0.0, confidence: 0.5 },
        risk_assessment: { score: 0.0, confidence: 0.5 }
      },
      news_articles: 0,
      articles_processed: 0,
      source: 'error',
      error: error.message
    };
  }
}

/**
 * Reasoning-enhanced DeepSeek analysis for complex market situations
 * Uses DeepSeek's reasoning mode for deeper analysis
 */
async function getReasoningEnhancedSentiment(symbol, marketContext, env) {
  try {
    // Get financial news
    const newsData = await getFinancialNews(symbol);
    
    if (!newsData.success || newsData.articles.length === 0) {
      return { error: 'No news data available' };
    }
    
    // Prepare complex reasoning prompt
    const reasoningPrompt = `<|thinking|>
I need to analyze the sentiment for ${symbol} considering both recent news and broader market context.

Market Context: ${marketContext}

Recent News:
${newsData.articles.slice(0, 3).map(article => 
  `- ${article.title}: ${article.description}`
).join('\n')}

Let me think through this step by step:
1. What are the key sentiment drivers in the news?
2. How does the broader market context affect this?
3. What are the potential risks and opportunities?
4. What's the likely market reaction and time horizon?
</|thinking|>

Analyze the sentiment for ${symbol} with the provided market context and news. Consider:
- Direct impact of news on stock price
- Broader market implications
- Risk-reward analysis
- Time horizon considerations

Respond in JSON:
{
  "overall_sentiment": "POSITIVE/NEGATIVE/NEUTRAL",
  "confidence": 0.0-1.0,
  "market_impact": "HIGH/MEDIUM/LOW",
  "reasoning_chain": "step by step analysis",
  "risk_factors": ["factor1", "factor2"],
  "opportunities": ["opportunity1", "opportunity2"],
  "time_horizon": "SHORT/MEDIUM/LONG",
  "recommendation": "action with rationale"
}`;

    const reasoningResponse = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MODELSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3.1',
        messages: [{ role: 'user', content: reasoningPrompt }],
        max_tokens: 800,
        temperature: 0.1
      })
    });
    
    if (reasoningResponse.ok) {
      const data = await reasoningResponse.json();
      const content = data.choices[0].message.content;
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const reasoningData = JSON.parse(jsonMatch[0]);
        return {
          ...reasoningData,
          source: 'deepseek_reasoning_mode',
          raw_response: content
        };
      }
    }
    
    return { error: 'Failed to get reasoning analysis' };
    
  } catch (error) {
    console.error(`Reasoning sentiment analysis failed: ${error.message}`);
    return { error: error.message };
  }
}

// Export functions for integration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getEnhancedSentimentAnalysis,
    getReasoningEnhancedSentiment
  };
}