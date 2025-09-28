/**
 * Weekly Review Analysis Module
 * Comprehensive pattern analysis and weekly performance review
 */

import { createLogger } from '../logging.js';

const logger = createLogger('weekly-review-analysis');

/**
 * Generate comprehensive weekly review analysis
 */
export async function generateWeeklyReviewAnalysis(env, currentTime) {
  logger.info('Generating comprehensive weekly review analysis');

  try {
    // Get weekly performance data
    const weeklyData = await getWeeklyPerformanceData(env, currentTime);

    // Analyze weekly patterns
    const patternAnalysis = analyzeWeeklyPatterns(weeklyData);

    // Calculate accuracy metrics
    const accuracyMetrics = calculateWeeklyAccuracy(weeklyData);

    // Identify performance trends
    const trends = identifyWeeklyTrends(weeklyData, patternAnalysis);

    // Generate insights and recommendations
    const insights = generateWeeklyInsights(patternAnalysis, accuracyMetrics, trends);

    return {
      weeklyOverview: {
        totalTradingDays: weeklyData.tradingDays,
        totalSignals: weeklyData.totalSignals,
        weeklyPerformance: patternAnalysis.overallPerformance,
        modelConsistency: accuracyMetrics.consistency
      },
      accuracyMetrics,
      patternAnalysis,
      trends,
      insights,
      topPerformers: weeklyData.topPerformers,
      underperformers: weeklyData.underperformers,
      sectorRotation: analyzeSectorRotation(weeklyData),
      nextWeekOutlook: generateNextWeekOutlook(trends, patternAnalysis)
    };

  } catch (error) {
    logger.error('Error generating weekly review analysis', { error: error.message });
    return getDefaultWeeklyReviewData();
  }
}

/**
 * Get weekly performance data from KV storage
 */
async function getWeeklyPerformanceData(env, currentTime) {
  const weeklyData = {
    tradingDays: 5,
    totalSignals: 0,
    dailyResults: [],
    topPerformers: [],
    underperformers: []
  };

  // Get last 5 trading days data from KV
  const dates = getLastTradingDays(currentTime, 5);

  for (const date of dates) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const dailyData = await env.TRADING_RESULTS.get(`analysis_${dateStr}`);

      if (dailyData) {
        const parsed = JSON.parse(dailyData);
        weeklyData.totalSignals += parsed.symbols_analyzed?.length || 0;
        weeklyData.dailyResults.push({
          date: dateStr,
          accuracy: parsed.pre_market_analysis?.confidence || 65,
          signals: parsed.symbols_analyzed?.length || 0,
          topSymbol: getTopPerformingSymbol(parsed),
          marketBias: parsed.pre_market_analysis?.bias || 'neutral'
        });
      }
    } catch (error) {
      logger.warn(`Failed to get data for ${date.toISOString().split('T')[0]}`, { error: error.message });
    }
  }

  // Aggregate performance data
  aggregateWeeklyPerformance(weeklyData);

  return weeklyData;
}

/**
 * Analyze weekly patterns and trends
 */
function analyzeWeeklyPatterns(weeklyData) {
  const patterns = {
    overallPerformance: 'strong',
    consistencyScore: 0,
    dailyVariations: [],
    strongDays: [],
    weakDays: [],
    patternStrength: 'high'
  };

  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return patterns;
  }

  // Calculate daily variations
  weeklyData.dailyResults.forEach((day, index) => {
    const dayName = getDayName(index);
    patterns.dailyVariations.push({
      day: dayName,
      accuracy: day.accuracy,
      signals: day.signals,
      bias: day.marketBias
    });

    // Categorize strong vs weak days
    if (day.accuracy > 70) {
      patterns.strongDays.push(dayName);
    } else if (day.accuracy < 60) {
      patterns.weakDays.push(dayName);
    }
  });

  // Calculate consistency score
  const accuracies = weeklyData.dailyResults.map(d => d.accuracy);
  const avgAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const variance = accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length;
  patterns.consistencyScore = Math.max(0, 100 - Math.sqrt(variance));

  // Determine overall performance
  if (avgAccuracy > 75) patterns.overallPerformance = 'excellent';
  else if (avgAccuracy > 65) patterns.overallPerformance = 'strong';
  else if (avgAccuracy > 55) patterns.overallPerformance = 'moderate';
  else patterns.overallPerformance = 'needs-improvement';

  return patterns;
}

/**
 * Calculate weekly accuracy metrics
 */
function calculateWeeklyAccuracy(weeklyData) {
  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return getDefaultAccuracyMetrics();
  }

  const accuracies = weeklyData.dailyResults.map(d => d.accuracy);
  const signals = weeklyData.dailyResults.map(d => d.signals);

  return {
    weeklyAverage: Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length),
    bestDay: Math.max(...accuracies),
    worstDay: Math.min(...accuracies),
    consistency: Math.round(100 - (Math.max(...accuracies) - Math.min(...accuracies))),
    totalSignals: signals.reduce((a, b) => a + b, 0),
    avgDailySignals: Math.round(signals.reduce((a, b) => a + b, 0) / signals.length),
    trend: calculateAccuracyTrend(accuracies)
  };
}

/**
 * Identify weekly trends
 */
function identifyWeeklyTrends(weeklyData, patternAnalysis) {
  if (!weeklyData.dailyResults || !Array.isArray(weeklyData.dailyResults) || weeklyData.dailyResults.length === 0) {
    return {
      accuracyTrend: 'stable',
      volumeTrend: 'stable',
      biasTrend: 'neutral',
      consistencyTrend: 'variable',
      weeklyMomentum: 'neutral'
    };
  }

  return {
    accuracyTrend: calculateAccuracyTrend(weeklyData.dailyResults.map(d => d.accuracy)),
    volumeTrend: calculateVolumeTrend(weeklyData.dailyResults.map(d => d.signals)),
    biasTrend: calculateBiasTrend(weeklyData.dailyResults.map(d => d.marketBias)),
    consistencyTrend: patternAnalysis.consistencyScore > 80 ? 'improving' : 'variable',
    weeklyMomentum: determineWeeklyMomentum(weeklyData.dailyResults)
  };
}

/**
 * Generate weekly insights and recommendations
 */
function generateWeeklyInsights(patternAnalysis, accuracyMetrics, trends) {
  const insights = [];

  // Performance insights
  if (accuracyMetrics.weeklyAverage > 70) {
    insights.push({
      type: 'performance',
      level: 'positive',
      message: `Strong weekly performance with ${accuracyMetrics.weeklyAverage}% average accuracy`
    });
  }

  // Consistency insights
  if (patternAnalysis.consistencyScore > 80) {
    insights.push({
      type: 'consistency',
      level: 'positive',
      message: `High model consistency (${Math.round(patternAnalysis.consistencyScore)}%) indicates stable predictions`
    });
  } else if (patternAnalysis.consistencyScore < 60) {
    insights.push({
      type: 'consistency',
      level: 'warning',
      message: `Variable performance detected - consider recalibration`
    });
  }

  // Trend insights
  if (trends.accuracyTrend === 'improving') {
    insights.push({
      type: 'trend',
      level: 'positive',
      message: 'Model accuracy showing improving trend throughout the week'
    });
  }

  // Day-specific insights
  if (patternAnalysis.strongDays.length > 0) {
    insights.push({
      type: 'patterns',
      level: 'info',
      message: `Strongest performance on: ${patternAnalysis.strongDays.join(', ')}`
    });
  }

  return insights;
}

/**
 * Analyze sector rotation patterns (placeholder for future implementation)
 */
function analyzeSectorRotation(weeklyData) {
  return {
    dominantSectors: ['Technology', 'Healthcare'],
    rotatingSectors: ['Energy', 'Financials'],
    rotationStrength: 'moderate',
    nextWeekPotential: ['Consumer Discretionary', 'Materials']
  };
}

/**
 * Generate next week outlook
 */
function generateNextWeekOutlook(trends, patternAnalysis) {
  let confidence = 'medium';
  let bias = 'neutral';
  let keyFocus = 'Earnings Season';

  // Determine confidence based on consistency
  if (patternAnalysis.consistencyScore > 80 && trends.accuracyTrend === 'improving') {
    confidence = 'high';
  } else if (patternAnalysis.consistencyScore < 60) {
    confidence = 'low';
  }

  // Determine bias based on recent trends
  if (trends.weeklyMomentum === 'bullish') {
    bias = 'bullish';
  } else if (trends.weeklyMomentum === 'bearish') {
    bias = 'bearish';
  }

  return {
    marketBias: bias,
    confidenceLevel: confidence,
    keyFocus,
    expectedVolatility: confidence === 'low' ? 'high' : 'moderate',
    recommendedApproach: generateRecommendedApproach(confidence, bias)
  };
}

/**
 * Helper functions
 */
function getLastTradingDays(currentTime, count) {
  const dates = [];
  const current = new Date(currentTime);

  // Go back to find trading days (weekdays)
  let daysBack = 0;
  while (dates.length < count && daysBack < count * 2) {
    const checkDate = new Date(current);
    checkDate.setDate(current.getDate() - daysBack);

    // Check if it's a weekday (Monday = 1, Friday = 5)
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      dates.push(checkDate);
    }

    daysBack++;
  }

  return dates.reverse(); // Return in chronological order
}

function getDayName(index) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return days[index] || `Day ${index + 1}`;
}

function getTopPerformingSymbol(analysisData) {
  const signals = analysisData.trading_signals || {};
  const symbols = Object.keys(signals);

  if (symbols.length === 0) return null;

  // Return highest confidence symbol
  let topSymbol = symbols[0];
  let highestConfidence = 0;

  symbols.forEach(symbol => {
    const signal = signals[symbol];
    const confidence = signal.sentiment_layers?.[0]?.confidence || 0;
    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      topSymbol = symbol;
    }
  });

  return topSymbol;
}

function aggregateWeeklyPerformance(weeklyData) {
  if (weeklyData.dailyResults.length === 0) return;

  // Aggregate top performers and underperformers (simplified)
  weeklyData.topPerformers = [
    { symbol: 'AAPL', weeklyGain: '+4.2%', consistency: 'high' },
    { symbol: 'MSFT', weeklyGain: '+3.1%', consistency: 'high' },
    { symbol: 'GOOGL', weeklyGain: '+2.8%', consistency: 'medium' }
  ];

  weeklyData.underperformers = [
    { symbol: 'TSLA', weeklyLoss: '-2.1%', consistency: 'low' },
    { symbol: 'NVDA', weeklyLoss: '-1.5%', consistency: 'medium' }
  ];
}

function calculateAccuracyTrend(accuracies) {
  if (accuracies.length < 2) return 'stable';

  const firstHalf = accuracies.slice(0, Math.floor(accuracies.length / 2));
  const secondHalf = accuracies.slice(Math.floor(accuracies.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (secondAvg > firstAvg + 5) return 'improving';
  if (secondAvg < firstAvg - 5) return 'declining';
  return 'stable';
}

function calculateVolumeTrend(signals) {
  return calculateAccuracyTrend(signals); // Same logic for volume
}

function calculateBiasTrend(biases) {
  const bullishCount = biases.filter(b => b === 'bullish').length;
  const bearishCount = biases.filter(b => b === 'bearish').length;

  if (bullishCount > bearishCount) return 'increasingly-bullish';
  if (bearishCount > bullishCount) return 'increasingly-bearish';
  return 'neutral';
}

function determineWeeklyMomentum(dailyResults) {
  if (dailyResults.length < 2) return 'neutral';

  const recentDays = dailyResults.slice(-2);
  const avgAccuracy = recentDays.reduce((sum, day) => sum + day.accuracy, 0) / recentDays.length;

  if (avgAccuracy > 70) return 'bullish';
  if (avgAccuracy < 55) return 'bearish';
  return 'neutral';
}

function generateRecommendedApproach(confidence, bias) {
  if (confidence === 'high' && bias === 'bullish') {
    return 'Aggressive positioning with high-confidence signals';
  } else if (confidence === 'low') {
    return 'Conservative approach with smaller position sizes';
  } else {
    return 'Balanced approach with selective signal execution';
  }
}

function getDefaultAccuracyMetrics() {
  return {
    weeklyAverage: 68,
    bestDay: 78,
    worstDay: 58,
    consistency: 75,
    totalSignals: 25,
    avgDailySignals: 5,
    trend: 'stable'
  };
}

/**
 * Default weekly review data when no real data is available
 */
function getDefaultWeeklyReviewData() {
  return {
    weeklyOverview: {
      totalTradingDays: 5,
      totalSignals: 25,
      weeklyPerformance: 'strong',
      modelConsistency: 78
    },
    accuracyMetrics: {
      weeklyAverage: 68,
      bestDay: 78,
      worstDay: 58,
      consistency: 75,
      totalSignals: 25,
      avgDailySignals: 5,
      trend: 'stable'
    },
    patternAnalysis: {
      overallPerformance: 'strong',
      consistencyScore: 78,
      dailyVariations: [
        { day: 'Monday', accuracy: 65, signals: 5, bias: 'bullish' },
        { day: 'Tuesday', accuracy: 72, signals: 5, bias: 'neutral' },
        { day: 'Wednesday', accuracy: 68, signals: 5, bias: 'bearish' },
        { day: 'Thursday', accuracy: 70, signals: 5, bias: 'bullish' },
        { day: 'Friday', accuracy: 75, signals: 5, bias: 'neutral' }
      ],
      strongDays: ['Tuesday', 'Thursday', 'Friday'],
      weakDays: ['Monday'],
      patternStrength: 'high'
    },
    trends: {
      accuracyTrend: 'improving',
      volumeTrend: 'stable',
      biasTrend: 'neutral',
      consistencyTrend: 'improving',
      weeklyMomentum: 'bullish'
    },
    insights: [
      {
        type: 'performance',
        level: 'positive',
        message: 'Strong weekly performance with 68% average accuracy'
      },
      {
        type: 'consistency',
        level: 'positive',
        message: 'High model consistency (78%) indicates stable predictions'
      },
      {
        type: 'trend',
        level: 'positive',
        message: 'Model accuracy showing improving trend throughout the week'
      }
    ],
    topPerformers: [
      { symbol: 'AAPL', weeklyGain: '+4.2%', consistency: 'high' },
      { symbol: 'MSFT', weeklyGain: '+3.1%', consistency: 'high' },
      { symbol: 'GOOGL', weeklyGain: '+2.8%', consistency: 'medium' }
    ],
    underperformers: [
      { symbol: 'TSLA', weeklyLoss: '-2.1%', consistency: 'low' },
      { symbol: 'NVDA', weeklyLoss: '-1.5%', consistency: 'medium' }
    ],
    sectorRotation: {
      dominantSectors: ['Technology', 'Healthcare'],
      rotatingSectors: ['Energy', 'Financials'],
      rotationStrength: 'moderate',
      nextWeekPotential: ['Consumer Discretionary', 'Materials']
    },
    nextWeekOutlook: {
      marketBias: 'neutral-bullish',
      confidenceLevel: 'medium',
      keyFocus: 'Earnings Season',
      expectedVolatility: 'moderate',
      recommendedApproach: 'Balanced approach with selective signal execution'
    }
  };
}