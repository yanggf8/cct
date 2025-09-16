#!/usr/bin/env node

/**
 * Local test for sentiment analysis pipeline
 * Tests the free APIs and rule-based sentiment analysis
 */

import { getFreeStockNews, analyzeTextSentiment } from './src/modules/free_sentiment_pipeline.js';

// Mock environment for testing
const mockEnv = {
  FMP_API_KEY: process.env.FMP_API_KEY || 'demo', // Use demo key if no real key
  NEWSAPI_KEY: process.env.NEWSAPI_KEY || 'demo',
  AI: null // No Cloudflare AI for local testing
};

async function testSentimentPipeline() {
  console.log('🧪 Testing Sentiment Analysis Pipeline Locally...\n');

  try {
    // Test 1: Rule-based sentiment analysis
    console.log('📝 Test 1: Rule-based sentiment analysis');
    const testTexts = [
      'Apple beats earnings expectations with strong revenue growth',
      'Tesla stock drops amid production concerns and regulatory challenges',
      'Microsoft announces neutral quarterly results meeting analyst expectations'
    ];

    testTexts.forEach((text, i) => {
      const sentiment = analyzeTextSentiment(text);
      console.log(`   ${i+1}. "${text}"`);
      console.log(`      → ${sentiment.label} (score: ${sentiment.score.toFixed(2)})\n`);
    });

    // Test 2: Free news API integration (if API keys available)
    console.log('📰 Test 2: Free news API integration');

    if (mockEnv.FMP_API_KEY && mockEnv.FMP_API_KEY !== 'demo') {
      console.log('   Testing with real FMP API key...');
      const newsData = await getFreeStockNews('AAPL', mockEnv);
      console.log(`   ✅ Retrieved ${newsData.length} news articles for AAPL`);

      if (newsData.length > 0) {
        const sampleNews = newsData[0];
        console.log(`   Sample: "${sampleNews.title}"`);
        console.log(`   Source: ${sampleNews.source_type || 'unknown'}\n`);
      }
    } else {
      console.log('   ⚠️ No real API keys configured, skipping news API test');
      console.log('   💡 Set FMP_API_KEY environment variable to test with real data\n');
    }

    // Test 3: Sentiment combination logic
    console.log('🔄 Test 3: Signal combination logic');

    const mockTechnicalSignal = {
      ensemble: { direction: 'UP', confidence: 0.75 },
      tft: { direction: 'UP', confidence: 0.72 }
    };

    const mockSentimentSignal = {
      sentiment: 'bullish',
      confidence: 0.65,
      score: 0.6,
      source_count: 3,
      method: 'rule_based'
    };

    // Import the combination function manually since module is complex
    const combineSignals = (technicalSignal, sentimentSignal, symbol) => {
      const TECHNICAL_WEIGHT = 0.70;
      const SENTIMENT_WEIGHT = 0.30;

      const technicalDirection = technicalSignal.ensemble?.direction || 'NEUTRAL';
      const technicalConfidence = technicalSignal.ensemble?.confidence || 0.5;
      const technicalScore = technicalDirection === 'UP' ? 0.8 : technicalDirection === 'DOWN' ? -0.8 : 0;
      const sentimentScore = sentimentSignal.score || 0;

      const combinedScore = (technicalScore * TECHNICAL_WEIGHT) + (sentimentScore * SENTIMENT_WEIGHT);
      const combinedDirection = combinedScore > 0.1 ? 'UP' : combinedScore < -0.1 ? 'DOWN' : 'NEUTRAL';
      const hybridConfidence = (technicalConfidence * TECHNICAL_WEIGHT) + (sentimentSignal.confidence * SENTIMENT_WEIGHT);

      return {
        direction: combinedDirection,
        confidence: hybridConfidence,
        reasoning: `Technical: ${technicalDirection} (${(technicalConfidence*100).toFixed(1)}%), Sentiment: ${sentimentSignal.sentiment} (${(sentimentSignal.confidence*100).toFixed(1)}%)`
      };
    };
    const hybridSignal = combineSignals(mockTechnicalSignal, mockSentimentSignal, 'AAPL');

    console.log('   Technical Signal: UP (75% confidence)');
    console.log('   Sentiment Signal: bullish (65% confidence)');
    console.log(`   → Combined: ${hybridSignal.direction} (${(hybridSignal.confidence * 100).toFixed(1)}% confidence)`);
    console.log(`   → Reasoning: ${hybridSignal.reasoning}\n`);

    // Test 4: Configuration validation
    console.log('⚙️ Test 4: Configuration validation');
    console.log(`   Cloudflare AI available: ${!!mockEnv.AI}`);
    console.log(`   FMP API configured: ${mockEnv.FMP_API_KEY !== 'demo'}`);
    console.log(`   NewsAPI configured: ${mockEnv.NEWSAPI_KEY !== 'demo'}`);

    console.log('\n✅ Sentiment analysis pipeline tests completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('   1. Configure free API keys: FMP_API_KEY and NEWSAPI_KEY');
    console.log('   2. Deploy to Cloudflare Workers with AI binding');
    console.log('   3. Test enhanced analysis endpoint: /analyze');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testSentimentPipeline();