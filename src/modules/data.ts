/**
 * Data Access Module - TypeScript
 * Handles data retrieval from DO Cache and D1 storage
 */

import { initLogging, logKVDebug, logError, logInfo } from './logging.js';
import { validateKVKey, validateEnvironment, validateDate } from './validation.js';
import { KVKeyFactory, KeyHelpers, KeyTypes } from './kv-key-factory.js';
import { createSimplifiedEnhancedDAL, type CacheAwareResult } from './simplified-enhanced-dal.js';
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
  primary_confidence: number;
  mate_confidence: number;
  primary_direction?: string;
  mate_direction?: string;
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

  const dal = createSimplifiedEnhancedDAL(env, {
    enableCache: true,
    environment: env.ENVIRONMENT || 'production'
  });

  // Try to get analysis data for this date using Enhanced DAL
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
    primary_model: 'GPT-OSS 120B',
    secondary_model: 'DeepSeek-R1 32B',
    primary_confidence: gptModel.confidence || 0,
    mate_confidence: distilBERTModel.confidence || 0,
    primary_direction: gptModel.direction,
    mate_direction: distilBERTModel.direction,

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
 * Store fact table data to DO Cache
 */
export async function storeFactTableData(env: CloudflareEnvironment, factTableData: FactTableRecord[]): Promise<boolean> {
  try {
    const dal = createSimplifiedEnhancedDAL(env, { enableCache: true, environment: env.ENVIRONMENT || 'production' });
    const result = await dal.write('fact_table_data', factTableData);
    if (result.success) {
      logInfo(`Stored ${factTableData.length} fact table records to DO Cache`);
    }
    return result.success;
  } catch (error: any) {
    logError('Error storing fact table data:', error);
    return false;
  }
}

/**
 * Extract dual model data from various analysis result formats
 * Returns model-agnostic naming: primary = GPT-OSS, mate = DeepSeek-R1
 */
export function extractDualModelData(analysisData: any): {
  primary_status?: string;
  primary_error?: string;
  primary_confidence?: number;
  primary_response_time_ms?: number;
  mate_status?: string;
  mate_error?: string;
  mate_confidence?: number;
  mate_response_time_ms?: number;
  model_selection_reason?: string;
} {
  // Format 1: DualAIComparisonResult (models.primary, models.mate)
  if (analysisData?.models?.gpt || analysisData?.models?.distilbert) {
    const gpt = analysisData.models?.gpt;
    const distilbert = analysisData.models?.distilbert;
    return {
      primary_status: gpt?.error ? 'failed' : gpt?.direction ? 'success' : undefined,
      primary_error: gpt?.error || undefined,
      primary_confidence: gpt?.confidence,
      primary_response_time_ms: gpt?.response_time_ms,
      mate_status: distilbert?.error ? 'failed' : distilbert?.direction ? 'success' : undefined,
      mate_error: distilbert?.error || undefined,
      mate_confidence: distilbert?.confidence,
      mate_response_time_ms: distilbert?.response_time_ms,
      model_selection_reason: analysisData.agreement?.status || analysisData.final_signal?.source
    };
  }

  // Format 2: Pre-market-data-bridge format (dual_model.gemma, dual_model.distilbert)
  // Note: dual_model object still uses gemma/distilbert internally for backward compat
  if (analysisData?.dual_model?.gemma || analysisData?.dual_model?.distilbert) {
    const gemma = analysisData.dual_model?.gemma;
    const distilbert = analysisData.dual_model?.distilbert;
    return {
      primary_status: gemma?.status,
      primary_error: gemma?.error,
      primary_confidence: gemma?.confidence,
      primary_response_time_ms: gemma?.response_time_ms,
      mate_status: distilbert?.status,
      mate_error: distilbert?.error,
      mate_confidence: distilbert?.confidence,
      mate_response_time_ms: distilbert?.response_time_ms,
      model_selection_reason: analysisData.dual_model?.selection_reason
    };
  }

  // Format 3: trading_signals contains dual model info
  if (analysisData?.trading_signals?.dual_model) {
    return extractDualModelData({ dual_model: analysisData.trading_signals.dual_model });
  }

  // Format 4: sentiment_layers with model info
  const layers = analysisData?.sentiment_layers || [];
  const primaryLayer = layers.find((l: any) => l.model?.toLowerCase().includes('gemma') || l.model?.toLowerCase().includes('gpt'));
  const mateLayer = layers.find((l: any) => l.model?.toLowerCase().includes('distilbert'));

  if (primaryLayer || mateLayer) {
    return {
      primary_status: primaryLayer ? 'success' : undefined,
      primary_confidence: primaryLayer?.confidence,
      mate_status: mateLayer ? 'success' : undefined,
      mate_confidence: mateLayer?.confidence
    };
  }

  return {};
}

/**
 * Store granular analysis for a single symbol - uses D1 only
 */
export async function storeSymbolAnalysis(env: CloudflareEnvironment, symbol: string, analysisData: any): Promise<boolean> {
  try {
    ensureLoggingInitialized(env);
    const dateStr = new Date().toISOString().split('T')[0];

    if (!env.PREDICT_JOBS_DB) {
      logError('PREDICT_JOBS_DB not configured');
      return false;
    }

    const { getPredictJobsDB } = await import('./predict-jobs-db.js');
    const db = getPredictJobsDB(env);
    if (!db) {
      logError('Failed to get PredictJobsDB instance');
      return false;
    }

    const dualModelData = extractDualModelData(analysisData);

    // Determine if this is a failed analysis (confidence is null)
    const confidence = analysisData.confidence_metrics?.overall_confidence ?? null;
    const isFailed = confidence === null;

    await db.savePrediction({
      symbol,
      prediction_date: dateStr,
      sentiment: analysisData.sentiment_layers?.[0]?.sentiment || 'neutral',
      // Use null if confidence is null/undefined - NO FAKE 0.5
      confidence,
      // Use failure-indicating defaults only when confidence is null, preserve legacy defaults otherwise
      direction: analysisData.trading_signals?.primary_direction || (isFailed ? 'neutral' : 'neutral'),
      model: analysisData.sentiment_layers?.[0]?.model || (isFailed ? 'none' : 'GPT-OSS-120B'),
      analysis_type: analysisData.analysis_type || (isFailed ? 'failed' : 'fine_grained_sentiment'),
      trading_signals: analysisData.trading_signals,
      ...dualModelData
    });

    // Ensure a daily summary exists so /results does not return 404 for single-symbol writes
    const existingDaily = await db.getDailyAnalysis(dateStr);
    if (!existingDaily) {
      const predictions = await db.getPredictionsByDate(dateStr);
      await db.saveDailyAnalysis({
        analysis_date: dateStr,
        total_symbols: predictions.length,
        execution_time: 0,
        summary: { symbols: predictions.map(p => p.symbol) }
      });
    }
    logInfo(`Symbol prediction stored in D1: ${symbol}`);
    return true;
  } catch (error: any) {
    logError('Failed to store symbol analysis:', error);
    return false;
  }
}

/**
 * Batch store multiple analysis results - uses D1 only
 */
export async function batchStoreAnalysisResults(env: CloudflareEnvironment, analysisResults: any[]): Promise<BatchStoreResult> {
  try {
    ensureLoggingInitialized(env);
    const startTime = Date.now();
    const date = new Date().toISOString().split('T')[0];

    if (!env.PREDICT_JOBS_DB) {
      logError('PREDICT_JOBS_DB not configured');
      return { success: false, error: 'D1 not configured', total_operations: 0, successful_operations: 0, failed_operations: 0 };
    }

    const { getPredictJobsDB } = await import('./predict-jobs-db.js');
    const db = getPredictJobsDB(env);
    if (!db) {
      logError('Failed to get PredictJobsDB instance');
      return { success: false, error: 'D1 init failed', total_operations: 0, successful_operations: 0, failed_operations: 0 };
    }

    const predictions = analysisResults.filter(r => r?.symbol).map(result => {
      const dualModelData = extractDualModelData(result);
      return {
        symbol: result.symbol,
        prediction_date: date,
        sentiment: result.sentiment_layers?.[0]?.sentiment || 'neutral',
        // Use null if confidence is null/undefined - NO FAKE 0.5
        confidence: result.confidence_metrics?.overall_confidence ?? null,
        direction: result.trading_signals?.primary_direction || 'neutral',
        model: result.sentiment_layers?.[0]?.model || 'none',
        analysis_type: result.analysis_type || 'unknown',
        trading_signals: result.trading_signals,
        ...dualModelData
      };
    });

    await db.savePredictionsBatch(predictions);
    await db.saveDailyAnalysis({
      analysis_date: date,
      total_symbols: predictions.length,
      execution_time: Date.now() - startTime,
      summary: { symbols: predictions.map(p => p.symbol) }
    });

    const totalTime = Date.now() - startTime;
    logInfo(`Batch D1 storage completed: ${predictions.length} predictions in ${totalTime}ms`);

    return {
      success: true,
      total_operations: predictions.length + 1,
      successful_operations: predictions.length + 1,
      failed_operations: 0,
      execution_time_ms: totalTime,
      daily_analysis_stored: true,
      symbol_analyses_stored: predictions.length
    };
  } catch (error: any) {
    logError('Batch storage failed:', error);
    return { success: false, error: error.message, total_operations: 0, successful_operations: 0, failed_operations: 0 };
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
      // Use ?? null to preserve null values (null = analysis failed)
      overall_confidence: analysisData.confidence_metrics?.overall_confidence ?? null,
      base_confidence: analysisData.confidence_metrics?.base_confidence ?? null,
      consistency_bonus: analysisData.confidence_metrics?.consistency_bonus ?? 0,
      agreement_bonus: analysisData.confidence_metrics?.agreement_bonus ?? 0
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
 * Track cron execution health - uses D1 only
 */
export async function trackCronHealth(env: CloudflareEnvironment, status: 'success' | 'partial' | 'failed', executionData: any = {}): Promise<boolean> {
  try {
    ensureLoggingInitialized(env);

    if (!env.PREDICT_JOBS_DB) {
      logError('PREDICT_JOBS_DB not configured');
      return false;
    }

    const { getPredictJobsDB } = await import('./predict-jobs-db.js');
    const db = getPredictJobsDB(env);
    if (!db) {
      logError('Failed to get PredictJobsDB instance');
      return false;
    }

    await db.saveExecution({
      job_type: executionData.jobType || 'analysis',
      status,
      executed_at: new Date().toISOString(),
      execution_time_ms: executionData.totalTime || 0,
      symbols_processed: executionData.symbolsProcessed || 0,
      symbols_successful: executionData.symbolsSuccessful || 0,
      symbols_fallback: executionData.symbolsFallback || 0,
      symbols_failed: executionData.symbolsFailed || 0,
      success_rate: executionData.successRate || 0,
      errors: executionData.errors || []
    });
    logInfo(`Job execution tracked in D1: ${status} - ${executionData.symbolsProcessed || 0} symbols processed`);
    return true;
  } catch (error: any) {
    logError('Failed to track cron health:', error);
    return false;
  }
}

/**
 * Get latest cron health status - reads from D1
 */
export async function getCronHealthStatus(env: CloudflareEnvironment): Promise<CronHealthStatus> {
  try {
    ensureLoggingInitialized(env);

    if (!env.PREDICT_JOBS_DB) {
      return { healthy: false, message: 'D1 not configured', last_execution: null };
    }

    const { getPredictJobsDB } = await import('./predict-jobs-db.js');
    const db = getPredictJobsDB(env);
    if (!db) {
      return { healthy: false, message: 'D1 init failed', last_execution: null };
    }

    const executions = await db.getRecentExecutions(1);
    if (executions.length === 0) {
      return { healthy: false, message: 'No job executions found', last_execution: null };
    }

    const latest = executions[0];
    const hoursSinceLastRun = (Date.now() - new Date(latest.executed_at).getTime()) / (1000 * 60 * 60);

    return {
      healthy: hoursSinceLastRun < 6 && latest.status !== 'failed',
      last_execution: latest.executed_at,
      hours_since_last_run: hoursSinceLastRun,
      last_status: latest.status,
      symbols_processed: latest.symbols_processed,
      success_rate: latest.success_rate,
      execution_time_ms: latest.execution_time_ms,
      full_health_data: latest as any
    };
  } catch (error: any) {
    logError('Failed to get cron health status:', error);
    return { healthy: false, message: 'Error reading D1', error: error.message };
  }
}

/**
 * Get analysis results for all symbols on a specific date - reads from D1
 */
export async function getSymbolAnalysisByDate(env: CloudflareEnvironment, dateString: string, symbols: string[] | null = null): Promise<any[]> {
  try {
    if (!env.PREDICT_JOBS_DB) {
      logError('PREDICT_JOBS_DB not configured');
      return [];
    }

    const { getPredictJobsDB } = await import('./predict-jobs-db.js');
    const db = getPredictJobsDB(env);
    if (!db) return [];

    const predictions = await db.getPredictionsByDate(dateString);
    
    // Filter by symbols if provided
    if (symbols && symbols.length > 0) {
      return predictions.filter(p => symbols.includes(p.symbol));
    }
    
    return predictions;
  } catch (error: any) {
    logError(`Error retrieving analysis for ${dateString}:`, error);
    return [];
  }
}

/**
 * Get analysis results by date - reads from D1
 */
export async function getAnalysisResultsByDate(env: CloudflareEnvironment, dateString: string): Promise<any | null> {
  try {
    if (!env.PREDICT_JOBS_DB) {
      logError('PREDICT_JOBS_DB not configured');
      return null;
    }

    const { getPredictJobsDB } = await import('./predict-jobs-db.js');
    const db = getPredictJobsDB(env);
    if (!db) return null;

    const daily = await db.getDailyAnalysis(dateString);
    const predictions = await db.getPredictionsByDate(dateString);

    if (!daily && predictions.length === 0) {
      return null;
    }

    // Fallback summary when daily row is absent (e.g., single-symbol writes)
    const summaryDate = daily?.analysis_date || dateString;
    const totalSymbols = daily?.total_symbols ?? predictions.length;
    const executionTime = daily?.execution_time ?? 0;

    return {
      date: summaryDate,
      total_symbols: totalSymbols,
      execution_time: executionTime,
      symbols: predictions
    };
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
    const dal = createSimplifiedEnhancedDAL(env, {
      enableCache: true,
      environment: env.ENVIRONMENT || 'production'
    });

    // Enhanced DAL listKeys returns all keys matching prefix (no cursor pagination yet)
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

    const data = await response.json() as any;
    const result = data?.chart?.result?.[0];

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
    logError(`Error fetching actual price for ${symbol}:`, (error instanceof Error ? error.message : String(error)));
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
    logError(`Error validating direction accuracy:`, (error instanceof Error ? error.message : String(error)));
    const accuracyThreshold = 0.75;
    return signal.confidence >= accuracyThreshold;
  }
}
