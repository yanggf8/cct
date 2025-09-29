# 3-Degree Sentiment Analysis System Design

## Overview

The 3-Degree Sentiment Analysis System is a sophisticated trading analysis architecture that provides comprehensive market insights through multiple analytical dimensions. Unlike simple fallback chains, this system analyzes data through three distinct analytical degrees, each examining different aspects of the information to create a holistic, multi-dimensional view of market sentiment.

## Architecture Philosophy

### Core Design Principles
1. **Multi-Dimensional Analysis**: Each degree examines different analytical dimensions of the same data
2. **Simultaneous Processing**: All degrees analyze the same dataset but from different perspectives
3. **Quality Weighting**: Temporal and relevance factors ensure higher-quality insights dominate
4. **Consensus Building**: Multiple analytical dimensions create more reliable signals through consensus
5. **Robust Fallback**: Single fallback mechanism maintains system reliability

## Degree Architecture

### Degree 1: AI Sentiment Analysis
**Purpose**: High-level market sentiment using advanced AI models
**Focus**: Comprehensive contextual understanding and market-aware sentiment assessment

**Components**:
- **Primary Model**: GPT-OSS-120B (OpenChat-3.5-0106)
- **Fallback Model**: DistilBERT-SST-2-INT8
- **Input**: Top 8 most relevant articles per symbol
- **Analysis Method**: Contextual understanding with market-aware prompts

**Key Features**:
```javascript
// Enhanced market-aware prompting
const enhancedPrompt = `As a trading analyst specializing in ${symbol}, analyze the following news articles and provide:
1. Overall sentiment (bullish/bearish/neutral)
2. Confidence level (0-100%)
3. Key insights affecting ${symbol}
4. Market impact assessment

Articles:
${newsContext}

Please provide a comprehensive analysis considering market context, timing, and potential trading implications.`;
```

**Output Structure**:
```javascript
{
  layer_type: 'gpt_oss_120b_enhanced',
  sentiment: 'bullish|bearish|neutral',
  confidence: 0.85,
  detailed_analysis: {
    key_insights: [...],
    market_impact: '...',
    trading_signals: [...],
    risk_factors: [...]
  },
  articles_analyzed: 8,
  processing_time: Date.now()
}
```

### Degree 2: Article-Level Analysis
**Purpose**: Granular examination of individual article characteristics and impact
**Focus**: Micro-level sentiment analysis, topic classification, and urgency assessment

**Components**:
- **Article Selection**: Top 12 most relevant articles
- **Analysis Dimensions**: Sentiment impact, topic categorization, urgency assessment
- **Weighting Method**: Relevance-score weighted aggregation

**Key Features**:
```javascript
// Article-level impact calculation
function calculateArticleSentimentImpact(article) {
  const titleWeight = 0.6;  // Title sentiment more important
  const summaryWeight = 0.4; // Summary provides context

  const titleSentiment = analyzeTextSentiment(article.title);
  const summarySentiment = analyzeTextSentiment(article.summary || '');

  return (titleSentiment.score * titleWeight) +
         (summarySentiment.score * summaryWeight);
}

// Topic categorization
function categorizeArticleTopic(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();

  if (text.includes('earnings') || text.includes('revenue')) return 'earnings';
  if (text.includes('merger') || text.includes('acquisition')) return 'mna';
  if (text.includes('product') || text.includes('launch')) return 'product';
  if (text.includes('regulation') || text.includes('legal')) return 'regulatory';
  return 'general';
}

// Urgency assessment
function assessArticleUrgency(article) {
  const urgencyKeywords = ['breaking', 'urgent', 'immediate', 'alert', 'critical'];
  const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

  const urgencyCount = urgencyKeywords.filter(keyword =>
    text.includes(keyword)
  ).length;

  return Math.min(1.0, urgencyCount * 0.3); // Max urgency score of 1.0
}
```

**Output Structure**:
```javascript
{
  layer_type: 'article_level_analysis',
  articles_analyzed: 12,
  sentiment_distribution: {
    positive_impact: 0.45,
    negative_impact: 0.30,
    neutral_impact: 0.25
  },
  topic_distribution: {
    earnings: 0.40,
    mna: 0.20,
    product: 0.15,
    regulatory: 0.10,
    general: 0.15
  },
  urgency_profile: {
    high_urgency: 0.15,
    medium_urgency: 0.35,
    low_urgency: 0.50
  },
  aggregate_sentiment_score: 0.65
}
```

### Degree 3: Temporal Analysis
**Purpose**: Time-weighted quality assessment and recency bias
**Focus**: Quality weighting through temporal factors, source reliability, and information freshness

**Components**:
- **Time Decay Function**: Exponential decay based on article age
- **Quality Weighting**: Source reliability and article quality factors
- **Recency Bias**: Recent articles given higher weight
- **Temporal Patterns**: Time-of-day and publication timing analysis

**Key Features**:
```javascript
// Time decay calculation
function calculateTimeDecay(ageInHours) {
  // Exponential decay: 50% weight loss every 6 hours
  const halfLife = 6; // hours
  const decayRate = Math.log(2) / halfLife;
  return Math.exp(-decayRate * ageInHours);
}

// Quality weighting
function calculateArticleQualityWeight(article) {
  let qualityScore = 1.0; // Base quality

  // Source reliability bonus/penalty
  const sourceReliability = {
    'bloomberg': 1.2,
    'reuters': 1.15,
    'ap': 1.1,
    'cnbc': 1.05,
    'yahoo': 0.95
  };

  const source = article.source.toLowerCase();
  if (sourceReliability[source]) {
    qualityScore *= sourceReliability[source];
  }

  // Content length bonus (longer articles often more detailed)
  const contentLength = (article.title + ' ' + (article.summary || '')).length;
  if (contentLength > 500) qualityScore *= 1.1;

  // Urgency bonus
  if (article.urgency_level > 0.7) qualityScore *= 1.05;

  return Math.min(2.0, qualityScore); // Cap at 2.0x weight
}

// Temporal aggregation
function performTemporalWeighting(articles, sentimentLayers) {
  const currentTime = new Date();
  let weightedSentiment = 0;
  let totalWeight = 0;

  articles.forEach(article => {
    const ageInHours = (currentTime - new Date(article.published_at)) / (1000 * 60 * 60);
    const timeDecay = calculateTimeDecay(ageInHours);
    const qualityWeight = calculateArticleQualityWeight(article);
    const sentimentImpact = article.sentiment_impact || 0;

    const finalWeight = timeDecay * qualityWeight * (article.relevance_score || 1.0);
    weightedSentiment += sentimentImpact * finalWeight;
    totalWeight += finalWeight;
  });

  return {
    temporal_sentiment_score: totalWeight > 0 ? weightedSentiment / totalWeight : 0,
    temporal_confidence: Math.min(1.0, totalWeight / articles.length),
    average_article_age: articles.reduce((sum, a) =>
      sum + (currentTime - new Date(a.published_at)) / (1000 * 60 * 60), 0) / articles.length,
    quality_adjusted_weight: totalWeight / articles.length
  };
}
```

**Output Structure**:
```javascript
{
  layer_type: 'temporal_analysis',
  temporal_sentiment_score: 0.72,
  temporal_confidence: 0.89,
  time_decay_profile: {
    average_article_age: 2.4, // hours
    recency_bias: 0.15,
    quality_weighting: 1.25
  },
  temporal_insights: {
    most_recent_impact: 0.78,
    quality_adjusted_sentiment: 0.71,
    timing_signal: 'recent_positive_bias' // 'recent_positive_bias', 'aging_neutral', 'mixed_timing'
  }
}
```

## System Integration

### Degree Coordination
```javascript
async function performThreeDegreeSentimentAnalysis(symbol, newsData, env) {
  const analyticalDegrees = [];

  try {
    // Degree 1: AI Sentiment Analysis
    const aiDegree = await performAIDegreeAnalysis(symbol, newsData, env);
    analyticalDegrees.push(aiDegree);

    // Degree 2: Article-Level Analysis (can run in parallel with Degree 1)
    const articleDegree = await performArticleDegreeAnalysis(symbol, newsData, env);
    analyticalDegrees.push(articleDegree);

    // Degree 3: Temporal Analysis (can run in parallel with Degrees 1 & 2)
    const temporalDegree = await performTemporalDegreeAnalysis(symbol, newsData, analyticalDegrees, env);
    analyticalDegrees.push(temporalDegree);

    // Cross-degree consensus calculation
    const consensus = calculateCrossDegreeConsensus(analyticalDegrees);

    return {
      degrees: analyticalDegrees,
      consensus: consensus,
      primary_signal: consensus.dominant_sentiment,
      confidence_score: consensus.overall_confidence,
      analytical_depth: '3_degree_comprehensive'
    };

  } catch (error) {
    logError('3-degree analysis failed:', error);
    return fallbackToSimpleAnalysis(symbol, newsData, env);
  }
}
```

### Consensus Calculation
```javascript
function calculateCrossDegreeConsensus(analyticalDegrees) {
  const degree1 = analyticalDegrees[0]; // AI Sentiment Analysis
  const degree2 = analyticalDegrees[1]; // Article-level
  const degree3 = analyticalDegrees[2]; // Temporal

  // Convert all sentiments to numerical scores
  const sentimentScores = {
    bullish: 1.0,
    positive: 0.8,
    neutral: 0.0,
    negative: -0.8,
    bearish: -1.0
  };

  const scores = [
    sentimentScores[degree1.sentiment] * degree1.confidence,
    (degree2.aggregate_sentiment_score * 2 - 1) * degree2.sentiment_distribution.positive_impact,
    (degree3.temporal_sentiment_score * 2 - 1) * degree3.temporal_confidence
  ];

  // Calculate weighted average based on degree importance
  const weights = [0.5, 0.3, 0.2]; // Degree 1 (AI) has highest weight
  const weightedScore = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
  const overallConfidence = Math.max(...scores.map(Math.abs));

  // Determine dominant sentiment
  let dominantSentiment = 'neutral';
  if (weightedScore > 0.3) dominantSentiment = 'bullish';
  else if (weightedScore < -0.3) dominantSentiment = 'bearish';

  return {
    dominant_sentiment: dominantSentiment,
    overall_confidence: overallConfidence,
    weighted_score: weightedScore,
    degree_agreement: calculateDegreeAgreement(scores),
    consensus_strength: calculateConsensusStrength(scores),
    analytical_depth: 'multi_dimensional'
  };
}
```

## Implementation Details

### File Structure
```
src/modules/
├── 3-degree-analysis/
│   ├── degree1-ai-analysis.js         # GPT-OSS-120B with fallback
│   ├── degree2-article-analysis.js     # Article-level impact analysis
│   ├── degree3-temporal-analysis.js   # Time-weighted quality analysis
│   ├── consensus-calculator.js        # Cross-degree consensus logic
│   └── index.js                       # Main coordinator
├── analysis-utils/
│   ├── sentiment-scoring.js           # Sentiment scoring utilities
│   ├── time-decay.js                 # Temporal decay functions
│   ├── quality-weighting.js           # Article quality assessment
│   └── topic-categorization.js       # Article topic classification
└── integration/
    ├── main-analysis-coordinator.js   # Integration with main system
    └── fallback-handler.js           # Single fallback mechanism
```

### Performance Considerations
- **Parallel Processing**: Degrees 2 and 3 can run in parallel with Degree 1 (all analyze same dataset)
- **Caching**: Article-level analysis results can be cached for reuse
- **Batching**: Multiple symbols processed in optimized batches
- **Rate Limiting**: GPT-OSS-120B calls managed to stay within limits

### Error Handling
- **Single Fallback**: DistilBERT when GPT-OSS-120B fails
- **Graceful Degradation**: System continues with available degrees if one fails
- **Quality Monitoring**: Track degree success rates and confidence levels
- **Fallback Triggers**: Automatic fallback based on confidence thresholds

## Benefits Over Simple Fallback Chains

1. **Multi-Dimensional Insights**: Each degree examines different analytical dimensions of the same data
2. **Quality Weighting**: Temporal and relevance factors ensure higher-quality insights dominate
3. **Consensus Building**: Multiple analytical perspectives create more reliable signals
4. **Adaptive Analysis**: System adapts to different market conditions and news patterns
5. **Explainable Results**: Clear rationale for trading decisions from multiple degrees

## Usage Examples

### Trading Signal Generation
```javascript
const analysis = await performThreeDegreeSentimentAnalysis('AAPL', newsData, env);

if (analysis.confidence_score > 0.7) {
  const signal = {
    symbol: 'AAPL',
    direction: analysis.primary_signal,
    confidence: analysis.confidence_score,
    rationale: `3-degree consensus: ${analysis.consensus.degree_agreement} agreement`,
    degrees: analysis.degrees.map(degree => ({
      type: degree.degree_type,
      sentiment: degree.sentiment || degree.temporal_sentiment_score,
      confidence: degree.confidence || degree.temporal_confidence
    }))
  };

  // Execute trading strategy
  executeTradingSignal(signal);
}
```

### Risk Management
```javascript
function assessSignalRisk(analysis) {
  const risks = [];

  // Degree disagreement risk
  if (analysis.consensus.degree_agreement < 0.6) {
    risks.push({
      type: 'degree_disagreement',
      severity: 'medium',
      description: 'Analytical degrees show significant disagreement'
    });
  }

  // Low confidence risk
  if (analysis.confidence_score < 0.6) {
    risks.push({
      type: 'low_confidence',
      severity: 'high',
      description: 'Overall confidence below acceptable threshold'
    });
  }

  // Temporal risk (aging news)
  if (analysis.degrees[2].temporal_insights.most_recent_impact < 0.5) {
    risks.push({
      type: 'stale_data',
      severity: 'medium',
      description: 'Analysis based on older news articles'
    });
  }

  return risks;
}
```

This 3-degree design provides a sophisticated, multi-dimensional approach to market sentiment analysis that goes far beyond simple fallback chains, delivering higher-quality, more explainable trading signals.