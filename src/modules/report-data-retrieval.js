/**
 * Report Data Retrieval Module
 * KV data access functions for the 4-report workflow
 */

import { createLogger } from './logging.js';
import { tomorrowOutlookTracker } from './tomorrow-outlook-tracker.js';
import { runEnhancedAnalysis } from './enhanced_analysis.js';

const logger = createLogger('report-data-retrieval');

/**
 * Data retrieval functions for each report type
 */
class ReportDataRetrieval {
  constructor() {
    this.confidenceThreshold = 70;
  }

  /**
   * PRE-MARKET BRIEFING (8:30 AM) - Get morning predictions + evaluate yesterday's outlook
   */
  async getPreMarketBriefingData(env, date) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Get today's analysis
      const analysisKey = `analysis_${dateStr}`;
      const analysisData = await env.TRADING_RESULTS.get(analysisKey);

      // Get morning predictions (if available)
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsData = await env.TRADING_RESULTS.get(predictionsKey);

      // Evaluate yesterday's outlook accuracy
      let outlookEvaluation = null;
      const yesterdayOutlook = await tomorrowOutlookTracker.getTodaysOutlook(env, date);

      if (yesterdayOutlook && yesterdayOutlook.evaluationStatus === 'pending') {
        // We need actual market data to evaluate - for now, we'll use yesterday's predictions
        const yesterdayPredictions = await this.getYesterdaysPredictions(env, date);
        if (yesterdayPredictions) {
          const actualMarketData = this.generateActualMarketData(yesterdayPredictions);
          outlookEvaluation = await tomorrowOutlookTracker.evaluateTodaysOutlook(env, date, actualMarketData);
        }
      }

      const result = {
        date: dateStr,
        analysis: analysisData ? JSON.parse(analysisData) : null,
        morningPredictions: predictionsData ? JSON.parse(predictionsData) : null,
        outlookEvaluation,
        yesterdayOutlook: yesterdayOutlook?.outlook || null,
        marketStatus: 'pre-market',
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical data
      if (!analysisData) {
        logger.error('⚠️ [PRE-MARKET] CRITICAL: Missing analysis data from KV', {
          date: dateStr,
          key: `analysis_${dateStr}`,
          impact: 'Using fallback default data - report may not reflect actual market analysis',
          action: 'Manual investigation required for KV storage system'
        });

        // Send Facebook error notification
        this.sendDataErrorNotification('Pre-Market Briefing', 'Missing analysis data', dateStr, env);
      }

      if (!predictionsData) {
        logger.warn('⚠️ [PRE-MARKET] WARNING: Missing morning predictions data', {
          date: dateStr,
          key: `morning_predictions_${dateStr}`,
          impact: 'Using default signals - trading recommendations may not reflect actual AI analysis',
          action: 'Check cron job execution for morning signal generation'
        });
      }

      logger.info('Retrieved pre-market briefing data', {
        date: dateStr,
        hasAnalysis: !!result.analysis,
        hasPredictions: !!result.morningPredictions,
        outlookEvaluated: !!outlookEvaluation,
        usingFallback: !analysisData || !predictionsData
      });

      return result;

    } catch (error) {
      logger.error('Failed to retrieve pre-market briefing data', {
        date: dateStr,
        error: error.message
      });
      return this.getDefaultPreMarketData(dateStr);
    }
  }

  /**
   * INTRADAY CHECK (12:00 PM) - Get updated morning predictions with current performance
   */
  async getIntradayCheckData(env, date) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Get morning predictions with performance updates
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsData = await env.TRADING_RESULTS.get(predictionsKey);

      let predictions = null;
      let performanceSummary = null;

      if (predictionsData) {
        predictions = JSON.parse(predictionsData);
        performanceSummary = this.generateIntradayPerformanceSummary(predictions);
      }

      const result = {
        date: dateStr,
        morningPredictions: predictions,
        performanceSummary,
        marketStatus: 'intraday',
        currentTime: new Date().toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit'
        }) + ' EDT',
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical data
      if (!predictionsData) {
        logger.error('⚠️ [INTRADAY] CRITICAL: Missing morning predictions for performance tracking', {
          date: dateStr,
          key: `morning_predictions_${dateStr}`,
          impact: 'Cannot track real-time signal performance - using default tracking data',
          action: 'Check morning prediction generation and KV storage'
        });

        // Send Facebook error notification
        this.sendDataErrorNotification('Intraday Performance Check', 'Missing morning predictions', dateStr, env);
      }

      logger.info('Retrieved intraday check data', {
        date: dateStr,
        hasPredictions: !!predictions,
        signalCount: predictions?.predictions?.length || 0,
        usingFallback: !predictionsData
      });

      return result;

    } catch (error) {
      logger.error('Failed to retrieve intraday check data', {
        date: dateStr,
        error: error.message
      });
      return this.getDefaultIntradayData(dateStr);
    }
  }

  /**
   * END-OF-DAY SUMMARY (4:05 PM) - Get complete day performance + store tomorrow outlook
   */
  async getEndOfDaySummaryData(env, date) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Get morning predictions with final performance
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsData = await env.TRADING_RESULTS.get(predictionsKey);

      // Get end-of-day summary if available
      const summaryKey = `end_of_day_summary_${dateStr}`;
      const summaryData = await env.TRADING_RESULTS.get(summaryKey);

      let finalSummary = null;
      let tomorrowOutlook = null;

      if (predictionsData) {
        const predictions = JSON.parse(predictionsData);
        finalSummary = this.generateEndOfDaySummary(predictions);

        // Generate AI-powered tomorrow outlook
        try {
          logger.info('🤖 [END-OF-DAY] Running AI analysis for tomorrow outlook', { date: dateStr });
          const aiAnalysis = await runEnhancedAnalysis(env, {
            purpose: 'tomorrow_outlook',
            context: 'end_of_day_summary'
          });

          tomorrowOutlook = this.generateAITomorrowOutlook(aiAnalysis, predictions);
          logger.info('✅ [END-OF-DAY] AI-powered tomorrow outlook generated', {
            date: dateStr,
            marketBias: tomorrowOutlook.marketBias,
            confidence: tomorrowOutlook.confidence
          });
        } catch (error) {
          logger.warn('⚠️ [END-OF-DAY] AI analysis failed, using fallback', {
            date: dateStr,
            error: error.message
          });
          // Fallback to simple pattern analysis
          tomorrowOutlook = this.generateTomorrowOutlook(predictions);
        }

        // Store tomorrow outlook for next day evaluation
        if (tomorrowOutlook) {
          await tomorrowOutlookTracker.storeTomorrowOutlook(env, date, tomorrowOutlook);
        }
      }

      // If pre-computed summary exists, use it
      if (summaryData) {
        const parsedSummary = JSON.parse(summaryData);
        finalSummary = parsedSummary.summary || finalSummary;
        tomorrowOutlook = parsedSummary.tomorrowOutlook || tomorrowOutlook;
      }

      const result = {
        date: dateStr,
        finalSummary,
        tomorrowOutlook,
        marketStatus: 'closed',
        closingTime: '4:00 PM EDT',
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical data
      if (!predictionsData) {
        logger.error('⚠️ [END-OF-DAY] CRITICAL: Missing predictions data for summary analysis', {
          date: dateStr,
          key: `predictions_${dateStr}`,
          impact: 'Cannot generate daily performance summary - using default data',
          action: 'Check daily prediction generation and KV storage system'
        });

        // Send Facebook error notification
        this.sendDataErrorNotification('End-of-Day Summary', 'Missing predictions data', dateStr, env);
      }

      if (!analysisData) {
        logger.warn('⚠️ [END-OF-DAY] WARNING: Missing analysis data', {
          date: dateStr,
          key: `analysis_${dateStr}`,
          impact: 'Limited analysis context available for summary',
          action: 'Check daily analysis execution and storage'
        });
      }

      // Log if using pattern-based outlook instead of AI
      if (tomorrowOutlook && tomorrowOutlook.basedOnData !== 'ai_analysis') {
        logger.warn('⚠️ [END-OF-DAY] WARNING: Using pattern-based tomorrow outlook instead of AI analysis', {
          date: dateStr,
          outlookSource: tomorrowOutlook.basedOnData || 'pattern_analysis',
          impact: 'Tomorrow outlook not using fresh AI predictions',
          action: 'Check AI analysis execution for tomorrow outlook generation'
        });
      }

      logger.info('Retrieved end-of-day summary data', {
        date: dateStr,
        hasFinalSummary: !!finalSummary,
        hasTomorrowOutlook: !!tomorrowOutlook,
        outlookStored: !!tomorrowOutlook,
        usingFallback: !predictionsData || !analysisData,
        outlookType: tomorrowOutlook?.basedOnData || 'pattern_analysis'
      });

      return result;

    } catch (error) {
      logger.error('Failed to retrieve end-of-day summary data', {
        date: dateStr,
        error: error.message
      });
      return this.getDefaultEndOfDayData(dateStr);
    }
  }

  /**
   * WEEKLY REVIEW (Sunday) - Get weekly performance patterns
   */
  async getWeeklyReviewData(env, date) {
    const dateStr = date.toISOString().split('T')[0];

    try {
      // Get last 5 trading days of data
      const weeklyData = await this.getWeeklyPerformanceData(env, date);

      // Generate weekly analysis
      const weeklyAnalysis = this.generateWeeklyAnalysis(weeklyData);

      const result = {
        date: dateStr,
        weeklyData,
        weeklyAnalysis,
        period: this.getWeeklyPeriod(date),
        generatedAt: new Date().toISOString()
      };

      // Log ERROR level for missing critical weekly data
      if (weeklyData.length === 0) {
        logger.error('⚠️ [WEEKLY-REVIEW] CRITICAL: No weekly performance data found in KV', {
          date: dateStr,
          expectedTradingDays: 5,
          actualDaysFound: weeklyData.length,
          impact: 'Using fallback default data - weekly review may not reflect actual market performance',
          action: 'Manual investigation required for daily summary storage and weekly aggregation'
        });

        // Send Facebook error notification
        await this.sendDataErrorNotification('Weekly Review', 'Missing weekly performance data', dateStr, env);
      } else if (weeklyData.length < 3) {
        logger.warn('⚠️ [WEEKLY-REVIEW] WARNING: Insufficient weekly data for comprehensive analysis', {
          date: dateStr,
          expectedTradingDays: 5,
          actualDaysFound: weeklyData.length,
          impact: 'Limited weekly analysis context - patterns may not be statistically significant',
          action: 'Check daily summary generation for missing trading days'
        });
      }

      logger.info('Retrieved weekly review data', {
        date: dateStr,
        daysAnalyzed: weeklyData.length,
        avgAccuracy: weeklyAnalysis.overview.averageAccuracy.toFixed(1),
        usingFallback: weeklyData.length === 0
      });

      return result;

    } catch (error) {
      logger.error('❌ [WEEKLY-REVIEW] CRITICAL: Failed to retrieve weekly review data', {
        date: dateStr,
        error: error.message,
        impact: 'Weekly review failed - using fallback data only',
        action: 'Investigate KV storage and weekly data aggregation systems'
      });

      // Send Facebook error notification for system failure
      await this.sendDataErrorNotification('Weekly Review', `System error: ${error.message}`, dateStr, env);

      return this.getDefaultWeeklyData(dateStr);
    }
  }

  /**
   * Get last 5 trading days of performance data
   */
  async getWeeklyPerformanceData(env, currentDate) {
    const dates = [];
    const current = new Date(currentDate);

    // Go back to find last 5 trading days (weekdays)
    let daysBack = 0;
    while (dates.length < 5 && daysBack < 14) { // Max 14 days back
      const checkDate = new Date(current);
      checkDate.setDate(current.getDate() - daysBack);

      // Check if it's a weekday (Monday = 1, Friday = 5)
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        dates.push(checkDate);
      }

      daysBack++;
    }

    // Get data for each trading day
    const weeklyData = [];
    for (const date of dates.reverse()) {
      const dateStr = date.toISOString().split('T')[0];
      const dayData = await this.getSingleDayPerformanceData(env, dateStr);
      if (dayData) {
        weeklyData.push({
          date: dateStr,
          dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
          ...dayData
        });
      }
    }

    return weeklyData;
  }

  /**
   * Get single day performance data
   */
  async getSingleDayPerformanceData(env, dateStr) {
    try {
      // Try to get end-of-day summary first
      const summaryKey = `end_of_day_summary_${dateStr}`;
      const summaryData = await env.TRADING_RESULTS.get(summaryKey);

      if (summaryData) {
        const parsed = JSON.parse(summaryData);
        return {
          type: 'summary',
          summary: parsed.summary,
          tomorrowOutlook: parsed.tomorrowOutlook
        };
      }

      // Fall back to morning predictions
      const predictionsKey = `morning_predictions_${dateStr}`;
      const predictionsData = await env.TRADING_RESULTS.get(predictionsKey);

      if (predictionsData) {
        const parsed = JSON.parse(predictionsData);
        const performanceSummary = this.generateIntradayPerformanceSummary(parsed);
        return {
          type: 'predictions',
          predictions: parsed.predictions,
          performanceSummary
        };
      }

      return null;

    } catch (error) {
      logger.warn('Failed to get single day performance data', {
        date: dateStr,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Helper functions for generating summaries
   */
  generateIntradayPerformanceSummary(predictionsData) {
    if (!predictionsData || !predictionsData.predictions) {
      return {
        totalSignals: 0,
        averageAccuracy: 0,
        validatedSignals: 0,
        divergentSignals: 0,
        signalsByStatus: {}
      };
    }

    const predictions = predictionsData.predictions;

    const totalSignals = predictions.length;
    const validatedSignals = predictions.filter(p => p.status === 'validated').length;
    const divergentSignals = predictions.filter(p => p.status === 'divergent').length;
    const trackingSignals = predictions.filter(p => p.status === 'tracking').length;

    const signalsWithPerformance = predictions.filter(p => p.performance?.accuracy !== undefined);
    const averageAccuracy = signalsWithPerformance.length > 0
      ? signalsWithPerformance.reduce((sum, p) => sum + p.performance.accuracy, 0) / signalsWithPerformance.length
      : 0;

    // Group by status
    const signalsByStatus = {};
    predictions.forEach(p => {
      const status = p.status || 'unknown';
      if (!signalsByStatus[status]) {
        signalsByStatus[status] = [];
      }
      signalsByStatus[status].push(p);
    });

    return {
      totalSignals,
      averageAccuracy: Math.round(averageAccuracy),
      validatedSignals,
      divergentSignals,
      trackingSignals,
      signalsByStatus,
      bullishSignals: predictions.filter(p => p.prediction === 'up').length,
      bearishSignals: predictions.filter(p => p.prediction === 'down').length
    };
  }

  generateEndOfDaySummary(predictionsData) {
    const performanceSummary = this.generateIntradayPerformanceSummary(predictionsData);

    // Get top performers and underperformers
    const predictions = predictionsData.predictions || [];
    const topPerformers = predictions
      .filter(p => p.performance?.accuracy !== undefined)
      .sort((a, b) => b.performance.accuracy - a.performance.accuracy)
      .slice(0, 3);

    const underperformers = predictions
      .filter(p => p.performance?.accuracy !== undefined)
      .sort((a, b) => a.performance.accuracy - b.performance.accuracy)
      .slice(0, 3);

    return {
      ...performanceSummary,
      topPerformers,
      underperformers,
      successRate: performanceSummary.totalSignals > 0
        ? Math.round((performanceSummary.validatedSignals / performanceSummary.totalSignals) * 100)
        : 0
    };
  }

  generateTomorrowOutlook(predictionsData) {
    const performanceSummary = this.generateIntradayPerformanceSummary(predictionsData);

    let marketBias = 'neutral';
    let confidence = 'medium';
    let reasoning = '';

    // Determine bias based on performance
    const { validatedSignals, divergentSignals, averageAccuracy } = performanceSummary;

    if (averageAccuracy > 70 && divergentSignals === 0) {
      confidence = 'high';
      reasoning = 'Strong signal performance supports confident outlook';
    } else if (averageAccuracy < 50 || divergentSignals > validatedSignals) {
      confidence = 'low';
      reasoning = 'Poor signal performance suggests cautious approach';
    }

    // Determine bias based on directional accuracy
    const predictions = predictionsData.predictions || [];
    const bullishAccuracy = this.calculateDirectionalAccuracy(predictions, 'up');
    const bearishAccuracy = this.calculateDirectionalAccuracy(predictions, 'down');

    if (bullishAccuracy > bearishAccuracy && bullishAccuracy > 60) {
      marketBias = 'bullish';
    } else if (bearishAccuracy > bullishAccuracy && bearishAccuracy > 60) {
      marketBias = 'bearish';
    }

    return {
      marketBias,
      confidence,
      reasoning,
      keyFocus: marketBias === 'bullish' ? 'Long opportunities' :
                 marketBias === 'bearish' ? 'Risk management' : 'Market neutral',
      recommendations: this.generateRecommendations(performanceSummary)
    };
  }

  generateAITomorrowOutlook(aiAnalysis, predictionsData) {
    // Extract AI-based predictions and sentiment
    const tradingSignals = aiAnalysis.trading_signals || {};
    const sentimentAnalysis = aiAnalysis.sentiment_analysis || {};
    const symbols = Object.keys(tradingSignals);

    let marketBias = 'neutral';
    let confidence = 'medium';
    let reasoning = '';
    let aiInsights = [];
    let keyFactors = [];

    // Analyze AI trading signals
    let bullishCount = 0;
    let bearishCount = 0;
    let highConfidenceSignals = 0;

    symbols.forEach(symbol => {
      const signal = tradingSignals[symbol];
      if (signal && signal.direction) {
        if (signal.direction === 'up') bullishCount++;
        else if (signal.direction === 'down') bearishCount++;

        if (signal.confidence >= 0.7) {
          highConfidenceSignals++;
        }
      }
    });

    // Determine market bias from AI signals
    if (bullishCount > bearishCount * 1.5) {
      marketBias = 'bullish';
      reasoning = 'AI analysis shows strong bullish sentiment across multiple symbols';
    } else if (bearishCount > bullishCount * 1.5) {
      marketBias = 'bearish';
      reasoning = 'AI analysis indicates bearish market conditions';
    } else if (bullishCount === bearishCount) {
      marketBias = 'neutral';
      reasoning = 'AI analysis shows balanced market conditions';
    }

    // Set confidence based on AI signal strength
    if (highConfidenceSignals >= 3) {
      confidence = 'high';
      reasoning += ' with high-confidence AI signals';
    } else if (highConfidenceSignals >= 1) {
      confidence = 'medium';
      reasoning += ' with moderate AI signal confidence';
    } else {
      confidence = 'low';
      reasoning += ' with limited AI signal confidence';
    }

    // Extract key factors from AI analysis
    if (sentimentAnalysis.overall_sentiment) {
      keyFactors.push(`Overall sentiment: ${sentimentAnalysis.overall_sentiment}`);
    }

    if (aiAnalysis.market_context) {
      keyFactors.push(`Market context: ${aiAnalysis.market_context}`);
    }

    if (sentimentAnalysis.news_sentiment_score) {
      const score = (sentimentAnalysis.news_sentiment_score * 100).toFixed(1);
      keyFactors.push(`News sentiment score: ${score}%`);
    }

    // Add AI model information
    aiInsights.push('GPT-OSS-120B sentiment analysis');
    aiInsights.push('Multi-symbol AI prediction');
    if (aiAnalysis.news_sources) {
      aiInsights.push(`${aiAnalysis.news_sources.length} news sources analyzed`);
    }

    return {
      marketBias,
      confidence,
      reasoning,
      keyFactors,
      aiInsights,
      basedOnData: 'ai_analysis',
      aiModelUsed: 'GPT-OSS-120B + DistilBERT',
      analysisTimestamp: aiAnalysis.timestamp,
      symbolsAnalyzed: symbols.length,
      highConfidenceSignals,
      generatedAt: new Date().toISOString()
    };
  }

  generateWeeklyAnalysis(weeklyData) {
    if (weeklyData.length === 0) {
      return this.getDefaultWeeklyAnalysis();
    }

    const totalSignals = weeklyData.reduce((sum, day) => sum + (day.summary?.totalSignals || 0), 0);
    const totalValidated = weeklyData.reduce((sum, day) => sum + (day.summary?.validatedSignals || 0), 0);
    const averageAccuracy = weeklyData.reduce((sum, day) => sum + (day.summary?.averageAccuracy || 0), 0) / weeklyData.length;

    // Find best and worst performing days
    const dayPerformances = weeklyData.map(day => ({
      date: day.date,
      dayName: day.dayName,
      accuracy: day.summary?.averageAccuracy || 0,
      signals: day.summary?.totalSignals || 0
    }));

    const bestDay = dayPerformances.reduce((best, current) =>
      current.accuracy > best.accuracy ? current : best);
    const worstDay = dayPerformances.reduce((worst, current) =>
      current.accuracy < worst.accuracy ? current : worst);

    return {
      overview: {
        totalTradingDays: weeklyData.length,
        totalSignals,
        averageAccuracy: Math.round(averageAccuracy),
        overallPerformance: averageAccuracy > 70 ? 'excellent' :
                           averageAccuracy > 60 ? 'good' : 'needs improvement',
        successRate: totalSignals > 0 ? Math.round((totalValidated / totalSignals) * 100) : 0
      },
      dailyPerformances: dayPerformances,
      bestDay,
      worstDay,
      trends: this.identifyWeeklyTrends(dayPerformances)
    };
  }

  calculateDirectionalAccuracy(predictions, direction) {
    const directionSignals = predictions.filter(p => p.prediction === direction);
    if (directionSignals.length === 0) return 0;

    const correctSignals = directionSignals.filter(p => p.performance?.isCorrect).length;
    return Math.round((correctSignals / directionSignals.length) * 100);
  }

  generateRecommendations(performanceSummary) {
    const recommendations = [];

    if (performanceSummary.divergentSignals > 0) {
      recommendations.push('Monitor divergent signals closely');
    }

    if (performanceSummary.averageAccuracy > 70) {
      recommendations.push('High confidence in signal accuracy');
    } else if (performanceSummary.averageAccuracy < 50) {
      recommendations.push('Consider reducing position sizes');
    }

    return recommendations;
  }

  identifyWeeklyTrends(dailyPerformances) {
    if (dailyPerformances.length < 3) return { accuracyTrend: 'insufficient_data' };

    const firstHalf = dailyPerformances.slice(0, Math.floor(dailyPerformances.length / 2));
    const secondHalf = dailyPerformances.slice(Math.floor(dailyPerformances.length / 2));

    const firstAvg = firstHalf.reduce((sum, day) => sum + day.accuracy, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, day) => sum + day.accuracy, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 10) return { accuracyTrend: 'improving' };
    if (secondAvg < firstAvg - 10) return { accuracyTrend: 'declining' };
    return { accuracyTrend: 'stable' };
  }

  getWeeklyPeriod(date) {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Monday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday

    return {
      start: startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      end: endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      year: date.getFullYear()
    };
  }

  /**
   * Get yesterday's predictions for outlook evaluation
   */
  async getYesterdaysPredictions(env, currentDate) {
    const yesterday = new Date(currentDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const predictionsKey = `morning_predictions_${yesterdayStr}`;
      const predictionsData = await env.TRADING_RESULTS.get(predictionsKey);
      if (predictionsData) {
        return JSON.parse(predictionsData);
      }
    } catch (error) {
      logger.warn('Failed to get yesterday\'s predictions', {
        date: yesterdayStr,
        error: error.message
      });
    }

    return null;
  }

  /**
   * Generate actual market data from predictions for outlook evaluation
   */
  generateActualMarketData(predictionsData) {
    if (!predictionsData || !predictionsData.predictions) {
      return {
        marketBias: 'neutral',
        volatility: 'moderate',
        averageChange: 0
      };
    }

    const predictions = predictionsData.predictions;

    // Calculate actual market bias based on prediction performance
    const bullishAccuracy = this.calculateDirectionalAccuracy(predictions, 'up');
    const bearishAccuracy = this.calculateDirectionalAccuracy(predictions, 'down');

    let marketBias = 'neutral';
    if (bullishAccuracy > bearishAccuracy && bullishAccuracy > 60) {
      marketBias = 'bullish';
    } else if (bearishAccuracy > bullishAccuracy && bearishAccuracy > 60) {
      marketBias = 'bearish';
    }

    // Calculate volatility based on prediction divergence
    const divergentSignals = predictions.filter(p => p.status === 'divergent').length;
    const totalSignals = predictions.length;
    const divergenceRate = divergentSignals / totalSignals;

    let volatility = 'moderate';
    if (divergenceRate > 0.3) volatility = 'high';
    else if (divergenceRate < 0.1) volatility = 'low';

    // Calculate average change based on actual performance
    const avgChange = predictions.reduce((sum, p) => {
      const actualChange = p.performance?.actualChange || 0;
      return sum + actualChange;
    }, 0) / predictions.length;

    return {
      marketBias,
      volatility,
      averageChange: avgChange
    };
  }

  // Default data methods
  getDefaultPreMarketData(dateStr) {
    return {
      date: dateStr,
      analysis: null,
      morningPredictions: null,
      outlookEvaluation: null,
      yesterdayOutlook: null,
      marketStatus: 'pre-market',
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultIntradayData(dateStr) {
    return {
      date: dateStr,
      morningPredictions: null,
      performanceSummary: this.generateIntradayPerformanceSummary(null),
      marketStatus: 'intraday',
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultEndOfDayData(dateStr) {
    return {
      date: dateStr,
      finalSummary: this.generateEndOfDaySummary(null),
      tomorrowOutlook: this.generateTomorrowOutlook(null),
      marketStatus: 'closed',
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultWeeklyData(dateStr) {
    return {
      date: dateStr,
      weeklyData: [],
      weeklyAnalysis: this.getDefaultWeeklyAnalysis(),
      period: this.getWeeklyPeriod(new Date(dateStr)),
      generatedAt: new Date().toISOString()
    };
  }

  getDefaultWeeklyAnalysis() {
    return {
      overview: {
        totalTradingDays: 0,
        totalSignals: 0,
        averageAccuracy: 0,
        overallPerformance: 'unknown',
        successRate: 0
      },
      dailyPerformances: [],
      bestDay: null,
      worstDay: null,
      trends: { accuracyTrend: 'insufficient_data' }
    };
  }

  /**
   * Send Facebook error notification for data issues
   */
  async sendDataErrorNotification(reportType, errorType, dateStr, env) {
    try {
      const errorMessage = `🚨 DATA ALERT: ${reportType}\n` +
        `⚠️ Issue: ${errorType}\n` +
        `📅 Date: ${dateStr}\n` +
        `🔧 Impact: Report using fallback data - may not reflect actual analysis\n` +
        `🛠️  Action: Required - Check KV storage and cron job execution\n` +
        `⏰ Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EDT`;

      // Import Facebook function dynamically
      const { sendFacebookMessage } = await import('./facebook.js');

      logger.info(`📱 [FACEBOOK] Sending data error notification for ${reportType}`, {
        reportType,
        errorType,
        dateStr
      });

      await sendFacebookMessage(errorMessage, env);

      logger.info(`✅ [FACEBOOK] Data error notification sent for ${reportType}`);

    } catch (fbError) {
      logger.error('❌ [FACEBOOK] Failed to send data error notification', {
        reportType,
        errorType,
        dateStr,
        fbError: fbError.message
      });
    }
  }
}

// Global instance
const reportDataRetrieval = new ReportDataRetrieval();

// Export functions for each report type
export async function getPreMarketBriefingData(env, date) {
  return await reportDataRetrieval.getPreMarketBriefingData(env, date);
}

export async function getIntradayCheckData(env, date) {
  return await reportDataRetrieval.getIntradayCheckData(env, date);
}

export async function getEndOfDaySummaryData(env, date) {
  return await reportDataRetrieval.getEndOfDaySummaryData(env, date);
}

export async function getWeeklyReviewData(env, date) {
  return await reportDataRetrieval.getWeeklyReviewData(env, date);
}

export {
  ReportDataRetrieval,
  reportDataRetrieval
};