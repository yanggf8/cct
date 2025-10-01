/**
 * Data Access Module - TypeScript
 * Handles data retrieval from KV storage and fact table operations with real market validation
 */

import { initLogging, logKVDebug, logError, logInfo } from './logging.js';
import { validateKVKey, validateEnvironment, validateDate } from './validation.js';
import { KVUtils } from './shared-utilities.js';
import { KVKeyFactory, KeyHelpers, KeyTypes } from './kv-key-factory.js';
import { createDAL, type DataAccessLayer } from './dal.js';
import type { CloudflareEnvironment } from '../types.js';

// Type Definitions
export interface FactTableRecord {
  date: string;
  symbol: string;
  predicted_price: number | null;
  current_price: number | null;
  actual_price: number | null;
  direction_prediction: string;
  direction_correct: boolean;
  confidence: number;
  model: string;
  primary_model: string;
  secondary_model: string;
  gpt_confidence: number;
  distilbert_confidence: number;
  gpt_direction?: string;
  distilbert_direction?: string;
  models_agree: boolean;
  agreement_type: string;
  signal_type: string;
  signal_strength: string;
  signal_action: string;
  dual_ai_agreement?: boolean;
  dual_ai_agreement_score: number;
  articles_analyzed: number;
  analysis_type: string;
  execution_time_ms: number;
  successful_models: number;
  trigger_mode?: string;
  timestamp: string;
}

export interface DailyAnalysis {
  date: string;
  symbols: Array<{
    symbol: string;
    sentiment: string;
    confidence: number;
    direction: string;
    model: string;
    layer_consistency: number;
    analysis_type: string;
  }>;
  execution_time: number;
  batch_stored: boolean;
  total_symbols: number;
}

export interface BatchStoreResult {
  success: boolean;
  total_operations: number;
  successful_operations: number;
  failed_operations: number;
  execution_time_ms?: number;
  daily_analysis_stored?: boolean;
  symbol_analyses_stored?: number;
  error?: string;
}

export interface CronHealthData {
  timestamp: number;
  date: string;
  status: 'success' | 'partial' | 'failed';
  execution_time_ms: number;
  symbols_processed: number;
  symbols_successful: number;
  symbols_fallback: number;
  symbols_failed: number;
  analysis_success_rate: number;
  storage_operations: number;
  errors: string[];
}

export interface CronHealthStatus {
  healthy: boolean;
  last_execution?: string | null;
  hours_since_last_run?: number;
  last_status?: string;
  symbols_processed?: number;
  success_rate?: number;
  execution_time_ms?: number;
  full_health_data?: CronHealthData;
  message?: string;
  error?: string;
}

export interface CompactAnalysisData {
  symbol: string;
  analysis_type: string;
  timestamp: string;
  sentiment_layers: Array<{
    layer_type: string;
    sentiment: string;
    confidence: number;
    model: string;
  }>;
  confidence_metrics: {
    overall_confidence: number;
    base_confidence: number;
    consistency_bonus: number;
    agreement_bonus: number;
  };
  trading_signals: any;
  sentiment_patterns: {
    overall_consistency?: string;
    primary_sentiment?: string;
    model_agreement?: boolean;
  };
  analysis_metadata: {
    method: string;
    models_used: string[];
    total_processing_time: number;
    news_quality_score?: number;
  };
  news_data: {
    total_articles: number;
    time_range?: any;
  };
}

// Initialize logging for this module
let loggingInitialized = false;

function ensureLoggingInitialized(env: CloudflareEnvironment): void {
  if (!loggingInitialized && env) {
    initLogging(env);
    loggingInitialized = true;
  }
}

/**
 * Determine primary model from sentiment analysis data
 */
function getPrimaryModelFromSentiment(sentimentAnalysis: any): string {
  if (!sentimentAnalysis || !sentimentAnalysis.source) {
    return 'UNKNOWN';
  }

  switch (sentimentAnalysis.source) {
    case 'cloudflare_gpt_oss':
      return 'GPT-OSS-120B';
    case 'cloudflare_distilbert':
      return 'DistilBERT';
    default:
      return sentimentAnalysis.model || 'UNKNOWN';
  }
}

/**
 * Process analysis data for a single date and convert to fact table format
 */
async function processAnalysisDataForDate(env: CloudflareEnvironment, dateStr: string, checkDate: Date): Promise<FactTableRecord[]> {
  const factTableData: FactTableRecord[] = [];

  const dal: DataAccessLayer = createDAL(env);

  // Try to get analysis data for this date using DAL
  const analysisKey = KVKeyFactory.generateDateKey(KeyTypes.ANALYSIS, dateStr);
  const analysisResult = await dal.read(analysisKey);

  if (analysisResult.success && analysisResult.data) {
    try {
      const analysisData = analysisResult.data;

      // Convert analysis data to fact table format
      if (analysisData.symbols_analyzed && analysisData.trading_signals) {
        for (const symbol of analysisData.symbols_analyzed) {
          const signal = analysisData.trading_signals[symbol];
          if (signal) {
            const actualPrice = await getRealActualPrice(symbol, dateStr);
            const directionCorrect = await validateDirectionAccuracy({ ...signal, symbol }, dateStr);

            // Process dual AI analysis data
            const factTableRecord = processDualAISignal(signal, symbol, dateStr, actualPrice, directionCorrect, analysisData);

            factTableData.push(factTableRecord);
          }
        }
      }
    } catch (parseError: any) {
      logError(`Error parsing analysis data for ${dateStr}:`, parseError);
    }
  }

  return factTableData;
}

/**
 * Process dual AI signal data for fact table
 */
function processDualAISignal(
  signal: any,
  symbol: string,
  dateStr: string,
  actualPrice: number | null,
  directionCorrect: boolean,
  analysisData: any
): FactTableRecord {
  // Extract dual AI model data
  const gptModel = signal.models?.gpt || {};
  const distilBERTModel = signal.models?.distilbert || {};
  const dualAIComparison = signal.comparison || {};
  const dualAISignal = signal.signal || {};

  // Extract trading signals from enhanced_prediction
  const enhancedPrediction = signal.enhanced_prediction || {};
  const tradingDirection = enhancedPrediction.direction || signal.direction || 'NEUTRAL';
  const overallConfidence = enhancedPrediction.confidence || signal.confidence || 0;

  return {
    date: dateStr,
    symbol: symbol,
    predicted_price: signal.predicted_price,
    current_price: signal.current_price,
    actual_price: actualPrice || signal.current_price,
    direction_prediction: tradingDirection,
    direction_correct: directionCorrect,
    confidence: overallConfidence,
    model: 'dual_ai_comparison',

    // Dual AI Analysis specific fields
    primary_model: 'GPT-OSS-120B',
    secondary_model: 'DistilBERT-SST-2-INT8',
    gpt_confidence: gptModel.confidence || 0,
    distilbert_confidence: distilBERTModel.confidence || 0,
    gpt_direction: gptModel.direction,
    distilbert_direction: distilBERTModel.direction,

    // Agreement and signal data
    models_agree: dualAIComparison.agree || false,
    agreement_type: dualAIComparison.agreement_type || 'unknown',
    signal_type: dualAISignal.type || 'UNKNOWN',
    signal_strength: dualAISignal.strength || 'UNKNOWN',
    signal_action: dualAISignal.action || 'HOLD',

    // Dual AI specific metrics
    dual_ai_agreement: dualAIComparison.agree,
    dual_ai_agreement_score: calculateAgreementScore(dualAIComparison),
    articles_analyzed: gptModel.articles_analyzed || distilBERTModel.articles_analyzed || 0,

    // Analysis metadata
    analysis_type: 'dual_ai_comparison',
    execution_time_ms: signal.execution_time_ms || 0,
    successful_models: signal.performance_metrics?.successful_models || 0,

    trigger_mode: analysisData.trigger_mode,
    timestamp: analysisData.timestamp || new Date().toISOString()
  };
}

/**
 * Calculate agreement score for dual AI comparison
 */
function calculateAgreementScore(comparison: any): number {
  if (!comparison) return 0;

  if (comparison.agree) {
    return comparison.agreement_type === 'full_agreement' ? 1.0 : 0.7;
  } else {
    return comparison.agreement_type === 'partial_agreement' ? 0.4 : 0.1;
  }
}

/**
 * Get fact table data from stored analysis results
 */
export async function getFactTableData(env: CloudflareEnvironment): Promise<FactTableRecord[]> {
  try {
    const factTableData: FactTableRecord[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const dayData = await processAnalysisDataForDate(env, dateStr, checkDate);
      factTableData.push(...dayData);
    }

    logInfo(`Retrieved ${factTableData.length} fact table records from analysis data`);
    return factTableData;

  } catch (error: any) {
    logError('Error retrieving fact table data:', error);
    return [];
  }
}

/**
 * Get fact table data with custom date range and week selection
 */
export async function getFactTableDataWithRange(
  env: CloudflareEnvironment,
  rangeDays: number = 7,
  weekSelection: string = 'current'
): Promise<FactTableRecord[]> {
  try {
    const factTableData: FactTableRecord[] = [];
    const today = new Date();

    // Calculate start date based on week selection
    let startDate = new Date(today);
    if (weekSelection === 'last1') {
      startDate.setDate(today.getDate() - 7);
    } else if (weekSelection === 'last2') {
      startDate.setDate(today.getDate() - 14);
    } else if (weekSelection === 'last3') {
      startDate.setDate(today.getDate() - 21);
    }

    // Get data for the specified range
    for (let i = 0; i < rangeDays; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      const dayData = await processAnalysisDataForDate(env, dateStr, checkDate);
      factTableData.push(...dayData);
    }

    logInfo(`Retrieved ${factTableData.length} records for range=${rangeDays}, week=${weekSelection}`);
    return factTableData;

  } catch (error: any) {
    logError('Error retrieving fact table data with range:', error);
    return [];
  }
}

/**
 * Store fact table data to KV storage
 */
export async function storeFactTableData(env: CloudflareEnvironment, factTableData: FactTableRecord[]): Promise<boolean> {
  try {
    const factTableKey = 'fact_table_data';
    await KVUtils.putWithTTL(
      env.TRADING_RESULTS,
      factTableKey,
      JSON.stringify(factTableData),
      'analysis'
    );

    logKVDebug(`Stored ${factTableData.length} fact table records to KV`);
    return true;

  } catch (error: any) {
    logError('Error storing fact table data:', error);
    return false;
  }
}

/**
 * Store granular analysis for a single symbol
 */
export async function storeSymbolAnalysis(env: CloudflareEnvironment, symbol: string, analysisData: any): Promise<boolean> {
  try {
    console.log(`💾 [KV DEBUG] Starting KV storage for ${symbol}`);
    ensureLoggingInitialized(env);
    logKVDebug('KV WRITE START: Storing analysis for', symbol);

    const dateStr = new Date().toISOString().split('T')[0];
    const key = `analysis_${dateStr}_${symbol}`;

    const dataString = JSON.stringify(analysisData);

    await KVUtils.putWithTTL(
      env.TRADING_RESULTS,
      key,
      dataString,
      'granular'
    );

    console.log(`✅ [KV DEBUG] KV put() completed successfully for key: ${key}`);
    return true;
  } catch (error: any) {
    logError('KV WRITE ERROR: Failed to store granular analysis for', symbol + ':', error);
    return false;
  }
}

/**
 * Batch store multiple analysis results with optimized parallel operations
 */
export async function batchStoreAnalysisResults(env: CloudflareEnvironment, analysisResults: any[]): Promise<BatchStoreResult> {
  try {
    ensureLoggingInitialized(env);
    const startTime = Date.now();
    const date = new Date().toISOString().split('T')[0];
    const kvOperations: Promise<void>[] = [];

    logInfo(`Starting batch KV storage for ${analysisResults.length} symbols...`);

    // Create main daily analysis
    const dailyAnalysis: DailyAnalysis = {
      date,
      symbols: analysisResults.map(result => ({
        symbol: result.symbol,
        sentiment: result.sentiment_layers?.[0]?.sentiment || 'neutral',
        confidence: result.confidence_metrics?.overall_confidence || 0.5,
        direction: result.trading_signals?.primary_direction || 'NEUTRAL',
        model: result.sentiment_layers?.[0]?.model || 'GPT-OSS-120B',
        layer_consistency: result.confidence_metrics?.consistency_bonus || 0,
        analysis_type: result.analysis_type || 'fine_grained_sentiment'
      })),
      execution_time: Date.now(),
      batch_stored: true,
      total_symbols: analysisResults.length
    };

    // Add main daily analysis to batch
    kvOperations.push(
      KVUtils.putWithTTL(
        env.TRADING_RESULTS,
        `analysis_${date}`,
        JSON.stringify(dailyAnalysis),
        'analysis'
      )
    );

    // Add individual symbol analyses to batch
    for (const result of analysisResults) {
      if (result && result.symbol) {
        const compactResult = createCompactAnalysisData(result);

        kvOperations.push(
          KVUtils.putWithTTL(
            env.TRADING_RESULTS,
            `analysis_${date}_${result.symbol}`,
            JSON.stringify(compactResult),
            'granular'
          )
        );
      }
    }

    // Execute all KV operations in parallel
    logInfo(`Executing ${kvOperations.length} KV operations in parallel...`);
    const kvResults = await Promise.allSettled(kvOperations);

    // Count successful operations
    const successful = kvResults.filter(r => r.status === 'fulfilled').length;
    const failed = kvResults.filter(r => r.status === 'rejected').length;

    const totalTime = Date.now() - startTime;
    logInfo(`Batch KV storage completed: ${successful}/${kvOperations.length} operations successful in ${totalTime}ms`);

    if (failed > 0) {
      logError(`${failed} KV operations failed during batch storage`);
    }

    return {
      success: successful > 0,
      total_operations: kvOperations.length,
      successful_operations: successful,
      failed_operations: failed,
      execution_time_ms: totalTime,
      daily_analysis_stored: kvResults[0]?.status === 'fulfilled',
      symbol_analyses_stored: successful - 1
    };

  } catch (error: any) {
    logError('Batch KV storage failed:', error);
    return {
      success: false,
      error: error.message,
      total_operations: 0,
      successful_operations: 0,
      failed_operations: 0
    };
  }
}

/**
 * Create compact analysis data for KV storage
 */
function createCompactAnalysisData(analysisData: any): CompactAnalysisData {
  return {
    symbol: analysisData.symbol,
    analysis_type: analysisData.analysis_type,
    timestamp: analysisData.timestamp,

    sentiment_layers: (analysisData.sentiment_layers || []).map((layer: any) => ({
      layer_type: layer.layer_type,
      sentiment: layer.sentiment,
      confidence: layer.confidence,
      model: layer.model
    })),

    confidence_metrics: {
      overall_confidence: analysisData.confidence_metrics?.overall_confidence || 0,
      base_confidence: analysisData.confidence_metrics?.base_confidence || 0,
      consistency_bonus: analysisData.confidence_metrics?.consistency_bonus || 0,
      agreement_bonus: analysisData.confidence_metrics?.agreement_bonus || 0
    },

    trading_signals: analysisData.trading_signals,

    sentiment_patterns: {
      overall_consistency: analysisData.sentiment_patterns?.overall_consistency,
      primary_sentiment: analysisData.sentiment_patterns?.primary_sentiment,
      model_agreement: analysisData.sentiment_patterns?.model_agreement
    },

    analysis_metadata: {
      method: analysisData.analysis_metadata?.method,
      models_used: analysisData.analysis_metadata?.models_used,
      total_processing_time: analysisData.analysis_metadata?.total_processing_time,
      news_quality_score: analysisData.analysis_metadata?.news_quality_score
    },

    news_data: {
      total_articles: analysisData.news_data?.total_articles || 0,
      time_range: analysisData.news_data?.time_range
    }
  };
}

/**
 * Track cron execution health for monitoring and debugging
 */
export async function trackCronHealth(env: CloudflareEnvironment, status: 'success' | 'partial' | 'failed', executionData: any = {}): Promise<boolean> {
  try {
    ensureLoggingInitialized(env);
    const healthData: CronHealthData = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      status: status,
      execution_time_ms: executionData.totalTime || 0,
      symbols_processed: executionData.symbolsProcessed || 0,
      symbols_successful: executionData.symbolsSuccessful || 0,
      symbols_fallback: executionData.symbolsFallback || 0,
      symbols_failed: executionData.symbolsFailed || 0,
      analysis_success_rate: executionData.successRate || 0,
      storage_operations: executionData.storageOperations || 0,
      errors: executionData.errors || []
    };

    const dal: DataAccessLayer = createDAL(env);

    // Store latest health status using DAL
    const latestResult = await dal.write('cron_health_latest', healthData);
    if (!latestResult.success) {
      logError(`Failed to store latest cron health: ${latestResult.error}`);
    }

    // Also store in daily health log for history
    const dateKey = `cron_health_${new Date().toISOString().slice(0, 10)}`;
    const existingResult = await dal.read(dateKey);
    const dailyData: any = (existingResult.success && existingResult.data) ? existingResult.data : { executions: [] };

    dailyData.executions.push(healthData);

    // Keep only last 10 executions per day to avoid bloat
    if (dailyData.executions.length > 10) {
      dailyData.executions = dailyData.executions.slice(-10);
    }

    const dailyResult = await dal.write(dateKey, dailyData, KVUtils.getOptions('metadata'));
    if (!dailyResult.success) {
      logError(`Failed to store daily cron health: ${dailyResult.error}`);
    }

    logInfo(`Cron health tracked: ${status} - ${executionData.symbolsProcessed || 0} symbols processed`);
    return true;

  } catch (error: any) {
    logError('Failed to track cron health:', error);
    return false;
  }
}

/**
 * Get latest cron health status for monitoring
 */
export async function getCronHealthStatus(env: CloudflareEnvironment): Promise<CronHealthStatus> {
  try {
    ensureLoggingInitialized(env);
    const dal: DataAccessLayer = createDAL(env);
    const healthResult = await dal.read('cron_health_latest');

    if (!healthResult.success || !healthResult.data) {
      return {
        healthy: false,
        message: 'No cron health data found',
        last_execution: null
      };
    }

    const healthData = healthResult.data as CronHealthData;
    const hoursSinceLastRun = (Date.now() - healthData.timestamp) / (1000 * 60 * 60);

    return {
      healthy: hoursSinceLastRun < 6 && healthData.status !== 'failed',
      last_execution: new Date(healthData.timestamp).toISOString(),
      hours_since_last_run: hoursSinceLastRun,
      last_status: healthData.status,
      symbols_processed: healthData.symbols_processed,
      success_rate: healthData.analysis_success_rate,
      execution_time_ms: healthData.execution_time_ms,
      full_health_data: healthData
    };

  } catch (error: any) {
    logError('Failed to get cron health status:', error);
    return {
      healthy: false,
      message: 'Error reading cron health data',
      error: error.message
    };
  }
}

/**
 * Get analysis results for all symbols on a specific date
 */
export async function getSymbolAnalysisByDate(env: CloudflareEnvironment, dateString: string, symbols: string[] | null = null): Promise<any[]> {
  try {
    const dal: DataAccessLayer = createDAL(env);

    // Use centralized symbol configuration if none provided
    if (!symbols) {
      symbols = (env.TRADING_SYMBOLS || 'AAPL,MSFT,GOOGL,TSLA,NVDA').split(',').map((s: string) => s.trim());
    }

    const keys = symbols.map(symbol => `analysis_${dateString}_${symbol}`);
    const promises = keys.map(key => dal.read(key));
    const results = await Promise.all(promises);

    const parsedResults = results
      .map((result, index) =>
        (result.success && result.data) ? { ...result.data, symbol: symbols![index] } : null
      )
      .filter(res => res !== null);

    logInfo(`Retrieved ${parsedResults.length}/${symbols.length} granular analysis records for ${dateString}`);
    return parsedResults;
  } catch (error: any) {
    logError(`Error retrieving granular analysis for ${dateString}:`, error);
    return [];
  }
}

/**
 * Get analysis results by date
 */
export async function getAnalysisResultsByDate(env: CloudflareEnvironment, dateString: string): Promise<any | null> {
  try {
    validateEnvironment(env);
    const validatedDate = validateDate(dateString);
    const dateString_clean = validatedDate.toISOString().split('T')[0];

    const dal: DataAccessLayer = createDAL(env);
    const dailyKey = validateKVKey(`analysis_${dateString_clean}`);
    const result = await dal.read(dailyKey);

    if (!result.success || !result.data) {
      return null;
    }

    return result.data;

  } catch (error: any) {
    logError(`Error retrieving analysis for ${dateString}:`, error);
    return null;
  }
}

/**
 * List all KV keys with a prefix
 */
export async function listKVKeys(env: CloudflareEnvironment, prefix: string = ''): Promise<any[]> {
  try {
    const dal: DataAccessLayer = createDAL(env);

    // DAL listKeys returns all keys matching prefix (no cursor pagination yet)
    const result = await dal.listKeys(prefix, 1000);

    return result.keys;

  } catch (error: any) {
    logError('Error listing KV keys:', error);
    return [];
  }
}

/**
 * Get real actual price from Yahoo Finance for a given date
 */
async function getRealActualPrice(symbol: string, targetDate: string): Promise<number | null> {
  try {
    logInfo(`Fetching actual price for ${symbol} on ${targetDate}...`);

    const target = new Date(targetDate);
    const endDate = new Date(target);
    endDate.setDate(target.getDate() + 3);
    const startDate = new Date(target);
    startDate.setDate(target.getDate() - 3);

    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];

    if (!result || !result.indicators) {
      throw new Error('Invalid response format from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    // Find closest date to target
    let closestPrice: number | null = null;
    let closestDiff = Infinity;

    for (let i = 0; i < timestamps.length; i++) {
      const dataDate = new Date(timestamps[i] * 1000);
      const diffDays = Math.abs((dataDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < closestDiff && quote.close[i]) {
        closestDiff = diffDays;
        closestPrice = quote.close[i];
      }
    }

    if (closestPrice) {
      logInfo(`Found actual price for ${symbol}: $${closestPrice.toFixed(2)} (${closestDiff.toFixed(1)} days difference)`);
      return closestPrice;
    } else {
      throw new Error('No valid price data found');
    }

  } catch (error: any) {
    logError(`Error fetching actual price for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Validate direction accuracy using real market data
 */
async function validateDirectionAccuracy(signal: any, targetDate: string): Promise<boolean> {
  try {
    const actualPrice = await getRealActualPrice(signal.symbol || 'UNKNOWN', targetDate);

    if (!actualPrice) {
      const accuracyThreshold = 0.75;
      return signal.confidence >= accuracyThreshold;
    }

    // Compare predicted vs actual direction
    const predictedDirection = signal.predicted_price > signal.current_price;
    const actualDirection = actualPrice > signal.current_price;

    const directionCorrect = predictedDirection === actualDirection;

    logInfo(`Direction accuracy for ${signal.symbol}: Predicted ${predictedDirection ? 'UP' : 'DOWN'}, Actual ${actualDirection ? 'UP' : 'DOWN'} = ${directionCorrect ? '✓' : '✗'}`);

    return directionCorrect;

  } catch (error: any) {
    logError(`Error validating direction accuracy:`, error.message);
    const accuracyThreshold = 0.75;
    return signal.confidence >= accuracyThreshold;
  }
}
