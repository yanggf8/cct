/**
 * Sector Rotation Analysis Workflow - Sequential Processing
 *
 * Processes 11 SPDR ETFs one by one to avoid rate limiting
 * Implements sequential analysis workflow for sector rotation insights
 *
 * ETFs Analyzed:
 * - XLK: Technology
 * - XLF: Financials
 * - XLV: Health Care
 * - XLE: Energy
 * - XLY: Consumer Discretionary
 * - XLP: Consumer Staples
 * - XLI: Industrials
 * - XLB: Materials
 * - XLU: Utilities
 * - XLRE: Real Estate
 * - XLC: Communication Services
 */

import { createLogger } from './logging.js';
import type { MarketDataResponse } from './validation-utilities.js';
import { createSimplifiedEnhancedDAL, type CacheAwareResult } from './simplified-enhanced-dal.js';
import { rateLimitedFetch } from './rate-limiter.js';
import { withCache } from './market-data-cache.js';
import { CONFIG } from './config.js';
import { analyzeSingleSymbolOptimized } from './optimized-ai-analysis.js';
import type { CloudflareEnvironment, SentimentLayer } from '../types.js';

const logger = createLogger('sector-rotation-workflow');

// Sector ETF Definitions
export const SPDR_ETFs = {
  XLK: { symbol: 'XLK', name: 'Technology', description: 'Software, hardware, IT services' },
  XLF: { symbol: 'XLF', name: 'Financials', description: 'Banks, insurance, financial services' },
  XLV: { symbol: 'XLV', name: 'Health Care', description: 'Pharma, biotech, healthcare providers' },
  XLE: { symbol: 'XLE', name: 'Energy', description: 'Oil, gas, energy equipment' },
  XLY: { symbol: 'XLY', name: 'Consumer Discretionary', description: 'Retail, autos, entertainment' },
  XLP: { symbol: 'XLP', name: 'Consumer Staples', description: 'Food, household products, retail' },
  XLI: { symbol: 'XLI', name: 'Industrials', description: 'Manufacturing, transportation, construction' },
  XLB: { symbol: 'XLB', name: 'Materials', description: 'Chemicals, metals, mining' },
  XLU: { symbol: 'XLU', name: 'Utilities', description: 'Electric, gas, water utilities' },
  XLRE: { symbol: 'XLRE', name: 'Real Estate', description: 'REITs, real estate services' },
  XLC: { symbol: 'XLC', name: 'Communication Services', description: 'Telecom, media, internet' }
} as const;

export type ETFSymbol = keyof typeof SPDR_ETFs;

export interface ETFMarketData {
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  week52High: number;
  week52Low: number;
  dividend: number;
  dividendYield: number;
  lastUpdated: string;
  ohlcv: number[][];
}

export interface ETFSentimentAnalysis {
  symbol: string;
  name: string;
  sentiment: {
    overall: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning: string;
    model: string;
  };
  technicalIndicators: {
    rsi: number;
    macd: number;
    movingAvg50: number;
    movingAvg200: number;
    trend: 'uptrend' | 'downtrend' | 'sideways';
  };
  performanceMetrics: {
    daily: number;
    weekly: number;
    monthly: number;
    ytd: number;
    volatility: number;
  };
  newsSentiment: {
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    topHeadlines: string[];
  };
  rotationSignal: {
    strength: 'strong' | 'moderate' | 'weak';
    direction: 'inflow' | 'outflow' | 'neutral';
    reasoning: string;
  };
}

export interface SectorRotationResult {
  timestamp: string;
  analysisDate: string;
  marketConditions: {
    overallTrend: 'bull' | 'bear' | 'neutral';
    volatility: 'low' | 'medium' | 'high';
    riskOn: boolean;
  };
  etfAnalyses: ETFSentimentAnalysis[];
  topSectors: {
    inflow: ETFSymbol[];
    outflow: ETFSymbol[];
  };
  rotationSignals: {
    leadingSector: ETFSymbol;
    laggingSector: ETFSymbol;
    emergingSectors: ETFSymbol[];
    decliningSectors: ETFSymbol[];
  };
  executionMetrics: {
    totalProcessingTime: number;
    averageTimePerETF: number;
    cacheHitRate: number;
    rateLimitAvoided: boolean;
  };
}

export interface WorkflowProgress {
  currentETF: ETFSymbol;
  completed: ETFSymbol[];
  remaining: ETFSymbol[];
  totalProgress: number;
  startTime: string;
  estimatedCompletion: string;
}

/**
 * Sequential Sector Rotation Workflow Manager
 */
export class SectorRotationWorkflow {
  private env: CloudflareEnvironment;
  private dal: ReturnType<typeof createSimplifiedEnhancedDAL>;
  private etfSymbols: ETFSymbol[];
  private progress: WorkflowProgress;
  private results: ETFSentimentAnalysis[];

  constructor(env: CloudflareEnvironment) {
    this.env = env;
    this.dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });
    this.etfSymbols = Object.keys(SPDR_ETFs) as ETFSymbol[];
    this.results = [];
    this.progress = {
      currentETF: '' as ETFSymbol,
      completed: [],
      remaining: [...this.etfSymbols],
      totalProgress: 0,
      startTime: new Date().toISOString(),
      estimatedCompletion: ''
    };
  }

  /**
   * Execute complete sector rotation analysis sequentially
   */
  async executeSequentialAnalysis(): Promise<SectorRotationResult> {
    const startTime = Date.now();
    logger.info('Starting sequential sector rotation analysis', {
      totalETFs: this.etfSymbols.length,
      strategy: 'sequential'
    });

    try {
      // Process each ETF sequentially to avoid rate limiting
      for (let i = 0; i < this.etfSymbols.length; i++) {
        const etfSymbol = this.etfSymbols[i];

        // Update progress
        this.progress.currentETF = etfSymbol;
        this.progress.completed.push(etfSymbol);
        this.progress.remaining = this.etfSymbols.slice(i + 1);
        this.progress.totalProgress = Math.round(((i + 1) / this.etfSymbols.length) * 100);

        // Estimate completion time
        const elapsed = Date.now() - startTime;
        const avgTimePerETF = elapsed / (i + 1);
        const remainingETFs = this.etfSymbols.length - (i + 1);
        const estimatedRemaining = remainingETFs * avgTimePerETF;
        this.progress.estimatedCompletion = new Date(Date.now() + estimatedRemaining).toISOString();

        logger.info('Processing ETF', {
          etf: etfSymbol,
          name: SPDR_ETFs[etfSymbol].name,
          progress: `${this.progress.totalProgress}%`,
          completed: i + 1,
          remaining: remainingETFs
        });

        // Analyze single ETF with delay to avoid rate limiting
        const etfAnalysis = await this.analyzeSingleETF(etfSymbol);
        this.results.push(etfAnalysis);

        // Rate limiting delay between ETFs
        if (i < this.etfSymbols.length - 1) {
          const delay = 1000; // 1 second delay between ETFs
          logger.debug('Rate limiting delay', { delay, nextETF: this.etfSymbols[i + 1] });
          await this.delay(delay);
        }
      }

      // Generate comprehensive rotation analysis
      const rotationResult = await this.generateRotationSignals(startTime);

      // Cache the complete results
      await this.cacheResults(rotationResult);

      const totalTime = Date.now() - startTime;
      logger.info('Sector rotation analysis completed', {
        totalTime: `${totalTime}ms`,
        averageTimePerETF: `${Math.round(totalTime / this.etfSymbols.length)}ms`,
        etfsAnalyzed: this.results.length
      });

      return rotationResult;

    } catch (error: any) {
      logger.error('Sector rotation workflow failed', {
        error: (error instanceof Error ? error.message : String(error)),
        stack: error.stack,
        progress: this.progress
      });
      throw error;
    }
  }

  /**
   * Analyze a single ETF comprehensively
   */
  private async analyzeSingleETF(symbol: ETFSymbol): Promise<ETFSentimentAnalysis> {
    const etfInfo = SPDR_ETFs[symbol];
    logger.debug('Starting ETF analysis', { symbol, name: etfInfo.name });

    try {
      // Get market data with caching
      const marketData = await this.getETFMarketData(symbol);

      // Run enhanced AI analysis
      const aiAnalysis = await this.runETFAnalysis(symbol, marketData);

      // Calculate technical indicators
      const technicals = await this.calculateTechnicalIndicators(marketData);

      // Analyze performance metrics
      const performance = this.calculatePerformanceMetrics(marketData);

      // Generate rotation signal
      const rotationSignal = await this.generateRotationSignal(symbol, marketData, aiAnalysis, technicals);

      const analysis: ETFSentimentAnalysis = {
        symbol,
        name: etfInfo.name,
        sentiment: aiAnalysis,
        technicalIndicators: technicals,
        performanceMetrics: performance,
        newsSentiment: await this.getNewsSentiment(symbol),
        rotationSignal
      };

      logger.debug('ETF analysis completed', {
        symbol,
        sentiment: analysis.sentiment.overall,
        rotationDirection: analysis.rotationSignal.direction,
        confidence: analysis.sentiment.confidence
      });

      return analysis;

    } catch (error: any) {
      logger.error('ETF analysis failed', {
        symbol,
        error: (error instanceof Error ? error.message : String(error))
      });

      // Return neutral analysis on failure
      return this.createNeutralAnalysis(symbol, etfInfo.name, error.message);
    }
  }

  /**
   * Get comprehensive market data for ETF
   */
  private async getETFMarketData(symbol: string): Promise<ETFMarketData> {
    const cacheKey = `etf_market_data_${symbol}_${new Date().toISOString().split('T')[0]}`;

    // Check cache first
    const cached = await this.dal.read(cacheKey);
    if (cached.success && cached.data) {
      logger.debug('ETF market data cache hit', { symbol });
      return cached.data as ETFMarketData;
    }

    // Fetch fresh data
    const response = await withCache(symbol, () => this.fetchETFData(symbol));

    // Cache for 4 hours
    await this.dal.write(cacheKey, response.data, { expirationTtl: 14400 });

    return response.data;
  }

  /**
   * Fetch ETF data from Yahoo Finance
   */
  private async fetchETFData(symbol: string): Promise<any> {
    const url = `${CONFIG.MARKET_DATA.YAHOO_FINANCE_BASE_URL}/v8/finance/chart/${symbol}?period1=${Math.floor(Date.now() / 1000) - 60*60*24*90}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;

    const response = await rateLimitedFetch(url, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ETF data: ${response.status}`);
    }

    const data = await response.json();
    const result = (data as any).chart.result[0];

    if (!result || !result.indicators) {
      throw new Error('Invalid ETF data response');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    // Convert to OHLCV format
    const ohlcv: number[][] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i]) {
        ohlcv.push([
          quote.open[i],
          quote.high[i],
          quote.low[i],
          quote.close[i],
          quote.volume[i] || 0,
          timestamps[i]
        ]);
      }
    }

    const currentPrice = ohlcv[ohlcv.length - 1][3];
    const previousPrice = ohlcv[ohlcv.length - 2][3];
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = (priceChange / previousPrice) * 100;

    return {
      success: true,
      symbol,
      data: {
        symbol,
        name: SPDR_ETFs[symbol as ETFSymbol]?.name || symbol,
        currentPrice,
        priceChange,
        priceChangePercent,
        volume: quote.volume[quote.volume.length - 1] || 0,
        avgVolume: 0, // Would need additional API call
        marketCap: 0, // Would need additional API call
        week52High: Math.max(...ohlcv.map(candle => candle[1])),
        week52Low: Math.min(...ohlcv.map(candle => candle[2])),
        dividend: 0, // Would need additional API call
        dividendYield: 0,
        lastUpdated: new Date().toISOString(),
        ohlcv
      }
    };
  }

  /**
   * Run AI analysis for ETF using optimized rate-limit-aware analysis
   */
  private async runETFAnalysis(symbol: string, marketData: ETFMarketData): Promise<any> {
    try {
      logger.debug('Starting optimized AI analysis for ETF', { symbol });

      // Use optimized AI analysis with rate limit protection
      const optimizedResult = await analyzeSingleSymbolOptimized(symbol, this.env, false);

      // Convert optimized result to expected format
      const sentiment = optimizedResult.sentiment;
      const metadata = optimizedResult.metadata;

      logger.debug('Optimized AI analysis completed for ETF', {
        symbol,
        analysisType: optimizedResult.analysis_type,
        rateLimitHit: metadata.rate_limit_hit,
        processingTime: metadata.processing_time_ms
      });

      return {
        overall: sentiment.direction,
        confidence: sentiment.confidence,
        reasoning: sentiment.reasoning,
        model: metadata.model_used
      };

    } catch (error: any) {
      logger.warn('Optimized AI analysis failed for ETF', { symbol, error: (error instanceof Error ? error.message : String(error)) });

      return {
        overall: 'neutral',
        confidence: 0.5,
        reasoning: 'AI analysis unavailable, using technical indicators',
        model: 'technical_fallback'
      };
    }
  }

  /**
   * Calculate technical indicators
   */
  private async calculateTechnicalIndicators(marketData: ETFMarketData): Promise<any> {
    const prices = marketData.ohlcv.map(candle => candle[3]); // Close prices
    const currentPrice = prices[prices.length - 1];

    // Simple moving averages
    const ma50 = this.calculateSMA(prices, 50);
    const ma200 = this.calculateSMA(prices, 200);

    // RSI calculation
    const rsi = this.calculateRSI(prices, 14);

    // MACD calculation (simplified)
    const macd = this.calculateMACD(prices);

    // Trend determination
    let trend: 'uptrend' | 'downtrend' | 'sideways';
    if (currentPrice > ma50 && ma50 > ma200) {
      trend = 'uptrend';
    } else if (currentPrice < ma50 && ma50 < ma200) {
      trend = 'downtrend';
    } else {
      trend = 'sideways';
    }

    return {
      rsi,
      macd,
      movingAvg50: ma50,
      movingAvg200: ma200,
      trend
    };
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(marketData: ETFMarketData): any {
    const prices = marketData.ohlcv.map(candle => candle[3]);
    const currentPrice = prices[prices.length - 1];

    // Daily performance
    const dailyPerformance = marketData.priceChangePercent;

    // Weekly performance (5 trading days)
    const weeklyPrice = prices[Math.max(0, prices.length - 6)];
    const weeklyPerformance = ((currentPrice - weeklyPrice) / weeklyPrice) * 100;

    // Monthly performance (21 trading days)
    const monthlyPrice = prices[Math.max(0, prices.length - 22)];
    const monthlyPerformance = ((currentPrice - monthlyPrice) / monthlyPrice) * 100;

    // YTD performance (start of year)
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearStartTimestamp = Math.floor(yearStart.getTime() / 1000);
    let ytdPrice = prices[0];

    for (const candle of marketData.ohlcv) {
      if (candle[5] >= yearStartTimestamp) {
        ytdPrice = candle[3];
        break;
      }
    }

    const ytdPerformance = ((currentPrice - ytdPrice) / ytdPrice) * 100;

    // Volatility (standard deviation of daily returns)
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const avgReturn = returns.reduce((sum: any, r: any) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum: any, r: any) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility

    return {
      daily: dailyPerformance,
      weekly: weeklyPerformance,
      monthly: monthlyPerformance,
      ytd: ytdPerformance,
      volatility
    };
  }

  /**
   * Get news sentiment for ETF
   */
  private async getNewsSentiment(symbol: string): Promise<any> {
    // This would integrate with news APIs
    // For now, return mock data
    return {
      positiveCount: Math.floor(Math.random() * 10) + 5,
      negativeCount: Math.floor(Math.random() * 5) + 1,
      neutralCount: Math.floor(Math.random() * 8) + 3,
      topHeadlines: [
        `Sector analysis for ${SPDR_ETFs[symbol as ETFSymbol]?.name}`,
        `Market sentiment update for ${symbol}`
      ]
    };
  }

  /**
   * Generate rotation signal for ETF
   */
  private async generateRotationSignal(
    symbol: string,
    marketData: ETFMarketData,
    sentiment: any,
    technicals: any
  ): Promise<any> {
    let strength: 'strong' | 'moderate' | 'weak';
    let direction: 'inflow' | 'outflow' | 'neutral';
    let reasoning = '';

    // Combine multiple factors for rotation signal
    const sentimentScore = sentiment.overall === 'bullish' ? 1 : sentiment.overall === 'bearish' ? -1 : 0;
    const trendScore = technicals.trend === 'uptrend' ? 1 : technicals.trend === 'downtrend' ? -1 : 0;
    const performanceScore = marketData.priceChangePercent > 1 ? 1 : marketData.priceChangePercent < -1 ? -1 : 0;

    const totalScore = (sentimentScore + trendScore + performanceScore) / 3;

    if (totalScore > 0.5) {
      direction = 'inflow';
      strength = totalScore > 0.8 ? 'strong' : 'moderate';
      reasoning = `Strong ${technicals.trend} trend with positive sentiment and price momentum`;
    } else if (totalScore < -0.5) {
      direction = 'outflow';
      strength = totalScore < -0.8 ? 'strong' : 'moderate';
      reasoning = `Weak ${technicals.trend} trend with negative sentiment and price pressure`;
    } else {
      direction = 'neutral';
      strength = 'weak';
      reasoning = `Mixed signals with ${technicals.trend} trend and neutral sentiment`;
    }

    return {
      strength,
      direction,
      reasoning
    };
  }

  /**
   * Generate comprehensive rotation signals from all ETF analyses
   */
  private async generateRotationSignals(startTime: number): Promise<SectorRotationResult> {
    // Determine overall market conditions
    const avgPerformance = this.results.reduce((sum: any, etf: any) => sum + etf.performanceMetrics.daily, 0) / this.results.length;
    const overallTrend = avgPerformance > 0.5 ? 'bull' : avgPerformance < -0.5 ? 'bear' : 'neutral';

    const avgVolatility = this.results.reduce((sum: any, etf: any) => sum + etf.performanceMetrics.volatility, 0) / this.results.length;
    const volatility = avgVolatility > 25 ? 'high' : avgVolatility > 15 ? 'medium' : 'low';

    const riskOn = overallTrend === 'bull' && volatility !== 'high';

    // Sort sectors by performance and rotation signals
    const inflowSectors = this.results
      .filter(etf => etf.rotationSignal.direction === 'inflow')
      .sort((a: any, b: any) => b.performanceMetrics.daily - a.performanceMetrics.daily)
      .map(etf => etf.symbol as ETFSymbol);

    const outflowSectors = this.results
      .filter(etf => etf.rotationSignal.direction === 'outflow')
      .sort((a: any, b: any) => a.performanceMetrics.daily - b.performanceMetrics.daily)
      .map(etf => etf.symbol as ETFSymbol);

    const leadingSector = inflowSectors[0] || this.results.sort((a: any, b: any) => b.performanceMetrics.daily - a.performanceMetrics.daily)[0].symbol as ETFSymbol;
    const laggingSector = outflowSectors[0] || this.results.sort((a: any, b: any) => a.performanceMetrics.daily - b.performanceMetrics.daily)[0].symbol as ETFSymbol;

    const emergingSectors = this.results
      .filter(etf => etf.rotationSignal.direction === 'inflow' && etf.rotationSignal.strength === 'strong')
      .map(etf => etf.symbol as ETFSymbol);

    const decliningSectors = this.results
      .filter(etf => etf.rotationSignal.direction === 'outflow' && etf.rotationSignal.strength === 'strong')
      .map(etf => etf.symbol as ETFSymbol);

    const totalTime = Date.now() - startTime;
    const averageTimePerETF = totalTime / this.etfSymbols.length;

    return {
      timestamp: new Date().toISOString(),
      analysisDate: new Date().toISOString().split('T')[0],
      marketConditions: {
        overallTrend,
        volatility,
        riskOn
      },
      etfAnalyses: this.results,
      topSectors: {
        inflow: inflowSectors,
        outflow: outflowSectors
      },
      rotationSignals: {
        leadingSector,
        laggingSector,
        emergingSectors,
        decliningSectors
      },
      executionMetrics: {
        totalProcessingTime: totalTime,
        averageTimePerETF,
        cacheHitRate: 0, // Would need to track this during execution
        rateLimitAvoided: true
      }
    };
  }

  /**
   * Cache analysis results
   */
  private async cacheResults(results: SectorRotationResult): Promise<void> {
    const cacheKey = `sector_rotation_analysis_${results.analysisDate}`;
    await this.dal.write(cacheKey, results, { expirationTtl: 3600 });

    logger.info('Sector rotation results cached', {
      date: results.analysisDate,
      etfsAnalyzed: results.etfAnalyses.length,
      leadingSector: results.rotationSignals.leadingSector
    });
  }

  /**
   * Create neutral analysis on failure
   */
  private createNeutralAnalysis(symbol: string, name: string, error: string): ETFSentimentAnalysis {
    return {
      symbol,
      name,
      sentiment: {
        overall: 'neutral',
        confidence: 0.5,
        reasoning: `Analysis failed: ${error}`,
        model: 'fallback'
      },
      technicalIndicators: {
        rsi: 50,
        macd: 0,
        movingAvg50: 0,
        movingAvg200: 0,
        trend: 'sideways'
      },
      performanceMetrics: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        ytd: 0,
        volatility: 0
      },
      newsSentiment: {
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        topHeadlines: []
      },
      rotationSignal: {
        strength: 'weak',
        direction: 'neutral',
        reasoning: 'Analysis failed - insufficient data'
      }
    };
  }

  /**
   * Helper function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((a: any, b: any) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.slice(-period).filter(change => change > 0);
    const losses = changes.slice(-period).filter(change => change < 0).map(loss => Math.abs(loss));

    const avgGain = gains.length > 0 ? gains.reduce((a: any, b: any) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a: any, b: any) => a + b, 0) / period : 0;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD (simplified)
   */
  private calculateMACD(prices: number[]): number {
    if (prices.length < 26) return 0;

    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);

    return ema12 - ema26;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a: any, b: any) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Get current workflow progress
   */
  getProgress(): WorkflowProgress {
    return { ...this.progress };
  }
}

/**
 * Execute sector rotation analysis with workflow
 */
export async function executeSectorRotationAnalysis(env: CloudflareEnvironment): Promise<SectorRotationResult> {
  const workflow = new SectorRotationWorkflow(env);
  return await workflow.executeSequentialAnalysis();
}

/**
 * Get cached sector rotation results
 */
export async function getCachedSectorRotationResults(env: CloudflareEnvironment, date?: string): Promise<SectorRotationResult | null> {
  const dal = createSimplifiedEnhancedDAL(env);
  const analysisDate = date || new Date().toISOString().split('T')[0];
  const cacheKey = `sector_rotation_analysis_${analysisDate}`;

  const result = await dal.read(cacheKey);
  if (result.success && result.data) {
    return result.data as SectorRotationResult;
  }

  return null;
}

/**
 * Alias function for scheduler compatibility
 */
export async function performSectorRotationAnalysis(env: CloudflareEnvironment, options?: any): Promise<SectorRotationResult | null> {
  try {
    return await executeSectorRotationAnalysis(env);
  } catch (error: any) {
    console.error('Sector rotation analysis failed:', error);
    return null;
  }
}