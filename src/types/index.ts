/**
 * Central Type Definitions
 * Core type definitions for the TFT Trading System
 */

export interface CloudflareEnvironment {
  AI: any;
  TRADING_RESULTS: KVNamespace;
  [key: string]: any;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: string[] }>;
}

export interface ApiResponse {
  success: boolean;
  timestamp: string;
  data?: any;
  error?: string;
  error_code?: string;
  error_details?: any;
  cached?: boolean;
  metadata?: {
    version?: string;
    requestId?: string;
    processingTime?: number;
    cacheStatus?: string;
  };
}

export interface TradingSymbol {
  symbol: string;
  name: string;
  sector: string;
  marketCap?: string;
  exchange: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface SentimentData {
  symbol: string;
  score: number;
  confidence: number;
  label: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

export interface AnalysisResult {
  symbol: string;
  date: string;
  sentiment: SentimentData;
  technicalIndicators: {
    rsi?: number;
    macdSignal?: string;
    movingAvg50?: number;
    movingAvg200?: number;
  };
  recommendation?: 'BUY' | 'SELL' | 'HOLD';
}

export interface CacheOptions {
  expirationTtl?: number;
  metadata?: Record<string, any>;
}

export interface DALResult<T = any> {
  success: boolean;
  data?: T;
  cached?: boolean;
  cacheSource?: string;
  responseTime?: number;
  error?: string;
}

export interface PerformanceStats {
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  performance: {
    totalOperations: number;
    averageResponseTime: number;
    cacheSize: number;
  };
}