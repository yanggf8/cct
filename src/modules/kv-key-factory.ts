/**
 * KV Key Factory Module - TypeScript
 * Type-safe, centralized key management for all KV operations with standardized naming conventions
 */

import { createLogger } from './logging.js';

const logger = createLogger('kv-key-factory');

/**
 * Key Types Enumeration
 */
export const KeyTypes = {
  // Analysis Data
  ANALYSIS: 'analysis',
  DUAL_AI_ANALYSIS: 'dual_ai_analysis',
  LEGACY_ANALYSIS: 'legacy_analysis',
  MANUAL_ANALYSIS: 'manual_analysis',

  // Status & Job Management
  JOB_STATUS: 'job_status',
  PIPELINE_STATUS: 'pipeline_status',
  DEPENDENCY_STATUS: 'dependency_status',

  // Metadata & Configuration
  SYSTEM_METADATA: 'system_metadata',
  JOB_METADATA: 'job_metadata',
  PERFORMANCE_METADATA: 'performance_metadata',

  // Daily & Time-based Data
  DAILY_SUMMARY: 'daily_summary',
  MORNING_PREDICTIONS: 'morning_predictions',
  INTRADAY_PERFORMANCE: 'intraday_performance',
  END_OF_DAY_SUMMARY: 'end_of_day_summary',
  WEEKLY_REVIEW: 'weekly_review',

  // Facebook & Messaging
  FACEBOOK_MANIFEST: 'facebook_manifest',
  FACEBOOK_STATUS: 'facebook_status',
  FACEBOOK_DELIVERY: 'facebook_delivery',

  // Testing & Debug
  TEST_DATA: 'test_data',
  DEBUG_DATA: 'debug_data',
  VERIFICATION: 'verification',

  // Cache & Temporary
  MARKET_DATA_CACHE: 'market_data_cache',
  REPORT_CACHE: 'report_cache',
  TEMPORARY: 'temporary'
} as const;

export type KeyType = typeof KeyTypes[keyof typeof KeyTypes];

/**
 * Key Templates for each type
 */
const KEY_TEMPLATES: Record<KeyType, string> = {
  [KeyTypes.ANALYSIS]: 'analysis_{date}',
  [KeyTypes.DUAL_AI_ANALYSIS]: 'dual_ai_analysis_{date}',
  [KeyTypes.LEGACY_ANALYSIS]: 'legacy_analysis_{date}',
  [KeyTypes.MANUAL_ANALYSIS]: 'manual_analysis_{timestamp}',

  [KeyTypes.JOB_STATUS]: 'job_{jobName}_status_{date}',
  [KeyTypes.PIPELINE_STATUS]: 'pipeline_{pipelineName}_status_{timestamp}',
  [KeyTypes.DEPENDENCY_STATUS]: 'dependency_{dependencyName}_{date}',

  [KeyTypes.SYSTEM_METADATA]: 'system_metadata_{component}',
  [KeyTypes.JOB_METADATA]: 'job_metadata_{jobName}_{date}',
  [KeyTypes.PERFORMANCE_METADATA]: 'performance_metadata_{date}',

  [KeyTypes.DAILY_SUMMARY]: 'daily_summary_{date}',
  [KeyTypes.MORNING_PREDICTIONS]: 'morning_predictions_{date}',
  [KeyTypes.INTRADAY_PERFORMANCE]: 'intraday_performance_{date}',
  [KeyTypes.END_OF_DAY_SUMMARY]: 'end_of_day_summary_{date}',
  [KeyTypes.WEEKLY_REVIEW]: 'weekly_review_{date}_{weekNumber}',

  [KeyTypes.FACEBOOK_MANIFEST]: 'facebook_manifest_{date}',
  [KeyTypes.FACEBOOK_STATUS]: 'facebook_status_{date}_{messageType}',
  [KeyTypes.FACEBOOK_DELIVERY]: 'facebook_delivery_{date}_{messageId}',

  [KeyTypes.TEST_DATA]: 'test_{testName}_{timestamp}',
  [KeyTypes.DEBUG_DATA]: 'debug_{component}_{timestamp}',
  [KeyTypes.VERIFICATION]: 'verification_{type}_{timestamp}',

  [KeyTypes.MARKET_DATA_CACHE]: 'market_cache_{symbol}_{timestamp}',
  [KeyTypes.REPORT_CACHE]: 'report_cache_{reportType}_{date}',
  [KeyTypes.TEMPORARY]: 'temp_{purpose}_{timestamp}'
};

/**
 * TTL Configuration for each key type (in seconds)
 */
const KEY_TTL_CONFIG: Record<KeyType, number> = {
  [KeyTypes.ANALYSIS]: 604800, // 7 days
  [KeyTypes.DUAL_AI_ANALYSIS]: 604800, // 7 days
  [KeyTypes.LEGACY_ANALYSIS]: 604800, // 7 days
  [KeyTypes.MANUAL_ANALYSIS]: 3600, // 1 hour

  [KeyTypes.JOB_STATUS]: 86400, // 24 hours
  [KeyTypes.PIPELINE_STATUS]: 3600, // 1 hour
  [KeyTypes.DEPENDENCY_STATUS]: 86400, // 24 hours

  [KeyTypes.SYSTEM_METADATA]: 2592000, // 30 days
  [KeyTypes.JOB_METADATA]: 604800, // 7 days
  [KeyTypes.PERFORMANCE_METADATA]: 2592000, // 30 days

  [KeyTypes.DAILY_SUMMARY]: 7776000, // 90 days
  [KeyTypes.MORNING_PREDICTIONS]: 604800, // 7 days
  [KeyTypes.INTRADAY_PERFORMANCE]: 604800, // 7 days
  [KeyTypes.END_OF_DAY_SUMMARY]: 7776000, // 90 days
  [KeyTypes.WEEKLY_REVIEW]: 2592000, // 30 days

  [KeyTypes.FACEBOOK_MANIFEST]: 7776000, // 90 days
  [KeyTypes.FACEBOOK_STATUS]: 604800, // 7 days
  [KeyTypes.FACEBOOK_DELIVERY]: 2592000, // 30 days

  [KeyTypes.TEST_DATA]: 3600, // 1 hour
  [KeyTypes.DEBUG_DATA]: 7200, // 2 hours
  [KeyTypes.VERIFICATION]: 3600, // 1 hour

  [KeyTypes.MARKET_DATA_CACHE]: 300, // 5 minutes
  [KeyTypes.REPORT_CACHE]: 1800, // 30 minutes
  [KeyTypes.TEMPORARY]: 600 // 10 minutes
};

/**
 * Parsed key information
 */
export interface ParsedKey {
  type: string;
  matches: string[];
}

/**
 * Key information
 */
export interface KeyInfo {
  key: string;
  type: string;
  inferredType: KeyType;
  length: number;
  ttl: number;
  hasDate: boolean;
  hasTimestamp: boolean;
  isDateBased: boolean;
}

/**
 * KV Options
 */
export interface KVOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: Record<string, any>;
}

/**
 * KV Key Factory Class
 */
export class KVKeyFactory {
  /**
   * Generate a key for a specific type with parameters
   */
  static generateKey(keyType: KeyType, params: Record<string, any> = {}): string {
    if (!KEY_TEMPLATES[keyType]) {
      throw new Error(`Unknown key type: ${keyType}`);
    }

    let template = KEY_TEMPLATES[keyType];

    // Replace template parameters with actual values
    Object.keys(params).forEach(param => {
      const value = this.sanitizeValue(params[param]);
      template = template.replace(new RegExp(`{${param}}`, 'g'), value);
    });

    // Validate the generated key
    this.validateKey(template);

    logger.debug(`Generated key: ${template} for type: ${keyType}`);
    return template;
  }

  /**
   * Generate date-based keys with automatic date handling
   */
  static generateDateKey(
    keyType: KeyType,
    date: Date | string | null = null,
    additionalParams: Record<string, any> = {}
  ): string {
    const dateObj = date ? new Date(date) : new Date();
    const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format

    return this.generateKey(keyType, { date: dateStr, ...additionalParams });
  }

  /**
   * Generate keys for job status tracking
   */
  static generateJobStatusKey(jobName: string, date: Date | string | null = null): string {
    return this.generateDateKey(KeyTypes.JOB_STATUS, date, { jobName: this.sanitizeValue(jobName) });
  }

  /**
   * Generate keys for pipeline status tracking
   */
  static generatePipelineStatusKey(pipelineName: string, timestamp: number | null = null): string {
    const ts = timestamp || Date.now();
    return this.generateKey(KeyTypes.PIPELINE_STATUS, {
      pipelineName: this.sanitizeValue(pipelineName),
      timestamp: ts
    });
  }

  /**
   * Generate keys for Facebook messaging
   */
  static generateFacebookKey(
    messageType: string,
    date: Date | string | null = null,
    messageId: string | null = null
  ): string {
    const baseParams = { date, messageType: this.sanitizeValue(messageType) };

    if (messageId) {
      return this.generateKey(KeyTypes.FACEBOOK_DELIVERY, {
        ...baseParams,
        messageId: this.sanitizeValue(messageId)
      });
    }

    return this.generateKey(KeyTypes.FACEBOOK_STATUS, baseParams);
  }

  /**
   * Get TTL for a specific key type
   */
  static getTTL(keyType: KeyType): number {
    const ttl = KEY_TTL_CONFIG[keyType];
    if (ttl === undefined) {
      logger.warn(`No TTL configured for key type: ${keyType}, using default 24h`);
      return 86400; // Default to 24 hours
    }
    return ttl;
  }

  /**
   * Parse a key to extract its components
   */
  static parseKey(key: string): ParsedKey {
    const patterns: Record<string, RegExp> = {
      analysis: /^analysis_(\d{4}-\d{2}-\d{2})$/,
      dual_ai_analysis: /^dual_ai_analysis_(\d{4}-\d{2}-\d{2})$/,
      legacy_analysis: /^legacy_analysis_(\d{4}-\d{2}-\d{2})$/,
      job_status: /^job_(.+)_status_(\d{4}-\d{2}-\d{2})$/,
      daily_summary: /^daily_summary_(\d{4}-\d{2}-\d{2})$/,
      facebook_manifest: /^facebook_manifest_(\d{4}-\d{2}-\d{2})$/,
      facebook_status: /^facebook_status_(\d{4}-\d{2}-\d{2})_(.+)$/,
      market_cache: /^market_cache_(.+)_(\d+)$/,
      report_cache: /^report_cache_(.+)_(\d{4}-\d{2}-\d{2})$/,
      test: /^test_(.+)_\d+$/,
      debug: /^debug_(.+)_\d+$/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const match = key.match(pattern);
      if (match) {
        return { type, matches: match.slice(1) };
      }
    }

    return { type: 'unknown', matches: [] };
  }

  /**
   * Get all keys for a specific date range
   */
  static generateDateRangeKeys(
    keyType: KeyType,
    startDate: Date | string,
    endDate: Date | string
  ): string[] {
    const keys: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      keys.push(this.generateDateKey(keyType, d));
    }

    return keys;
  }

  /**
   * Sanitize values for use in keys
   */
  static sanitizeValue(value: any): string {
    if (typeof value !== 'string') {
      value = String(value);
    }

    // Replace spaces and special characters with underscores
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Validate key format
   */
  static validateKey(key: string): void {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }

    if (key.length === 0) {
      throw new Error('Key cannot be empty');
    }

    if (key.length > 512) {
      throw new Error('Key too long (max 512 characters)');
    }

    // Check for valid characters (Cloudflare KV allows most UTF-8 characters)
    if (!/^[\w\-./:#@=,+;!?()[\]{} &$]+$/.test(key)) {
      throw new Error(`Key contains invalid characters: ${key}`);
    }
  }

  /**
   * Get key statistics and information
   */
  static getKeyInfo(key: string): KeyInfo {
    const parsed = this.parseKey(key);
    const keyType = this.inferKeyType(key);

    return {
      key,
      type: parsed.type,
      inferredType: keyType,
      length: key.length,
      ttl: this.getTTL(keyType),
      hasDate: /\d{4}-\d{2}-\d{2}/.test(key),
      hasTimestamp: /\d{10,13}/.test(key),
      isDateBased: parsed.type !== 'unknown' && parsed.matches.some(m => /^\d{4}-\d{2}-\d{2}$/.test(m))
    };
  }

  /**
   * Infer key type from key pattern
   */
  static inferKeyType(key: string): KeyType {
    if (key.startsWith('analysis_')) return KeyTypes.ANALYSIS;
    if (key.startsWith('dual_ai_analysis_')) return KeyTypes.DUAL_AI_ANALYSIS;
    if (key.startsWith('legacy_analysis_')) return KeyTypes.LEGACY_ANALYSIS;
    if (key.includes('_status_')) return KeyTypes.JOB_STATUS;
    if (key.startsWith('daily_summary_')) return KeyTypes.DAILY_SUMMARY;
    if (key.startsWith('facebook_')) return KeyTypes.FACEBOOK_STATUS;
    if (key.startsWith('market_cache_')) return KeyTypes.MARKET_DATA_CACHE;
    if (key.startsWith('report_cache_')) return KeyTypes.REPORT_CACHE;
    if (key.startsWith('test_')) return KeyTypes.TEST_DATA;
    if (key.startsWith('debug_')) return KeyTypes.DEBUG_DATA;

    return KeyTypes.TEMPORARY;
  }
}

/**
 * Helper functions for common key operations
 */
export const KeyHelpers = {
  /**
   * Get today's analysis key
   */
  getTodayAnalysisKey: (): string => KVKeyFactory.generateDateKey(KeyTypes.ANALYSIS),

  /**
   * Get today's dual AI analysis key
   */
  getTodayDualAIKey: (): string => KVKeyFactory.generateDateKey(KeyTypes.DUAL_AI_ANALYSIS),

  /**
   * Get today's Facebook manifest key
   */
  getTodayFacebookManifestKey: (): string => KVKeyFactory.generateDateKey(KeyTypes.FACEBOOK_MANIFEST),

  /**
   * Get job status key for today
   */
  getJobStatusKey: (jobName: string): string => KVKeyFactory.generateJobStatusKey(jobName),

  /**
   * Get Facebook message key for today
   */
  getFacebookKey: (messageType: string): string => KVKeyFactory.generateFacebookKey(messageType),

  /**
   * Get TTL options for KV operations
   */
  getKVOptions: (keyType: KeyType, additionalOptions: KVOptions = {}): KVOptions => ({
    expirationTtl: KVKeyFactory.getTTL(keyType),
    ...additionalOptions
  })
};

export default KVKeyFactory;
