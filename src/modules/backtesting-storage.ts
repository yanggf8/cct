/**
 * Backtesting Results Storage and Retrieval System
 * Institutional-grade persistence layer for backtest results, metadata, and analysis data
 * Following DAC patterns and integrating with existing KV infrastructure
 */

import { createDAL } from './dal.js';
import { ProcessingTimer } from './api-v1-responses';

// Simple KV functions using DAL
async function getKVStore(env, key) {
  const dal = createDAL(env);
  const result = await dal.read(key);
  return result.success ? result.data : null;
}

async function setKVStore(env, key, data, ttl) {
  const dal = createDAL(env);
  const result = await dal.write(key, data, { expirationTtl: ttl });
  return result.success;
}

async function listKVStore(env, prefix) {
  const dal = createDAL(env);
  const result = await dal.listKeys(prefix);
  return result.keys;
}

async function deleteKVStore(env, key) {
  const dal = createDAL(env);
  return await dal.deleteKey(key);
}

// Storage namespaces
export const BACKTESTING_NAMESPACES = {
  RUNS: 'backtest_runs',           // Individual backtest runs
  RESULTS: 'backtest_results',     // Detailed results
  METRICS: 'backtest_metrics',     // Performance metrics
  VALIDATION: 'backtest_validation', // Validation results
  COMPARISONS: 'backtest_comparisons', // Comparison analyses
  HISTORY: 'backtest_history',     // Historical metadata
  CACHE: 'backtest_cache'         // Cached computations
};

// TTL configurations (in seconds)
export const BACKTESTING_TTL = {
  RUN_CACHE: 3600,          // 1 hour for active runs
  RESULTS_CACHE: 86400,     // 1 day for results
  METRICS_CACHE: 604800,    // 1 week for metrics
  VALIDATION_CACHE: 86400,  // 1 day for validation
  HISTORY_CACHE: 2592000,   // 1 month for history
  COMPARISON_CACHE: 3600    // 1 hour for comparisons
};

/**
 * Backtesting Results Storage Manager
 */
export class BacktestingStorageManager {
  constructor(env) {
    this.env = env;
    this.timer = new ProcessingTimer();
  }

  /**
   * Store a new backtest run
   */
  async storeBacktestRun(runId, backtestConfig, initialStatus = 'queued') {
    const runData = {
      runId,
      config: backtestConfig,
      status: initialStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      currentStep: 'initializing',
      metadata: {
        version: '1.0.0',
        engine: 'institutional-backtesting-v1',
        processingTime: 0,
        estimatedDuration: this._estimateDuration(backtestConfig)
      }
    };

    const key = `${BACKTESTING_NAMESPACES.RUNS}:${runId}`;
    await this._store(key, runData, BACKTESTING_TTL.RUN_CACHE);

    // Also store in history tracking
    await this._updateHistoryIndex(runId, 'run_created', backtestConfig);

    return runData;
  }

  /**
   * Update run status and progress
   */
  async updateRunStatus(runId, status, progress = null, currentStep = null, error = null) {
    const key = `${BACKTESTING_NAMESPACES.RUNS}:${runId}`;
    const existingRun = await getKVStore(this.env, key);

    if (!existingRun) {
      throw new Error(`Backtest run not found: ${runId}`);
    }

    const updatedRun = {
      ...existingRun,
      status,
      updatedAt: new Date().toISOString(),
      processingTime: this.timer.getElapsedMs()
    };

    if (progress !== null) {
      updatedRun.progress = Math.min(100, Math.max(0, progress));
    }

    if (currentStep) {
      updatedRun.currentStep = currentStep;
    }

    if (error) {
      updatedRun.error = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }

    await setKVStore(this.env, key, updatedRun, BACKTESTING_TTL.RUN_CACHE);

    // Update history if status changed significantly
    if (['completed', 'failed', 'cancelled'].includes(status)) {
      await this._updateHistoryIndex(runId, 'run_' + status, updatedRun);
    }

    return updatedRun;
  }

  /**
   * Store complete backtest results
   */
  async storeBacktestResults(runId, results) {
    const resultsData = {
      runId,
      ...results,
      storedAt: new Date().toISOString(),
      storageVersion: '1.0.0'
    };

    // Store detailed results
    const resultsKey = `${BACKTESTING_NAMESPACES.RESULTS}:${runId}`;
    await setKVStore(this.env, resultsKey, resultsData, BACKTESTING_TTL.RESULTS_CACHE);

    // Store metrics separately for faster retrieval
    if (results.performanceMetrics) {
      const metricsKey = `${BACKTESTING_NAMESPACES.METRICS}:${runId}`;
      await setKVStore(this.env, metricsKey, results.performanceMetrics, BACKTESTING_TTL.METRICS_CACHE);
    }

    // Update run status to completed
    await this.updateRunStatus(runId, 'completed', 100, 'completed');

    // Update history
    await this._updateHistoryIndex(runId, 'results_stored', {
      totalReturn: results.performanceMetrics?.totalReturn,
      sharpeRatio: results.performanceMetrics?.sharpeRatio,
      maxDrawdown: results.performanceMetrics?.maxDrawdown,
      tradeCount: results.trades?.length || 0
    });

    return resultsData;
  }

  /**
   * Retrieve backtest run information
   */
  async getBacktestRun(runId) {
    const key = `${BACKTESTING_NAMESPACES.RUNS}:${runId}`;
    return await getKVStore(this.env, key);
  }

  /**
   * Retrieve detailed backtest results
   */
  async getBacktestResults(runId) {
    const resultsKey = `${BACKTESTING_NAMESPACES.RESULTS}:${runId}`;
    return await getKVStore(this.env, resultsKey);
  }

  /**
   * Retrieve performance metrics only
   */
  async getPerformanceMetrics(runId) {
    const metricsKey = `${BACKTESTING_NAMESPACES.METRICS}:${runId}`;
    return await getKVStore(this.env, metricsKey);
  }

  /**
   * Store validation results
   */
  async storeValidationResults(runId, validationResults) {
    const validationData = {
      runId,
      ...validationResults,
      storedAt: new Date().toISOString(),
      validationVersion: '1.0.0'
    };

    const key = `${BACKTESTING_NAMESPACES.VALIDATION}:${runId}`;
    await setKVStore(this.env, key, validationData, BACKTESTING_TTL.VALIDATION_CACHE);

    return validationData;
  }

  /**
   * Retrieve validation results
   */
  async getValidationResults(runId) {
    const key = `${BACKTESTING_NAMESPACES.VALIDATION}:${runId}`;
    return await getKVStore(this.env, key);
  }

  /**
   * Store comparison results
   */
  async storeComparisonResults(comparisonId, comparisonResults) {
    const comparisonData = {
      comparisonId,
      ...comparisonResults,
      storedAt: new Date().toISOString(),
      comparisonVersion: '1.0.0'
    };

    const key = `${BACKTESTING_NAMESPACES.COMPARISONS}:${comparisonId}`;
    await setKVStore(this.env, key, comparisonData, BACKTESTING_TTL.COMPARISON_CACHE);

    return comparisonData;
  }

  /**
   * Retrieve comparison results
   */
  async getComparisonResults(comparisonId) {
    const key = `${BACKTESTING_NAMESPACES.COMPARISONS}:${comparisonId}`;
    return await getKVStore(this.env, key);
  }

  /**
   * Get backtest history with filtering and pagination
   */
  async getBacktestHistory(filters = {}, pagination = {}) {
    const historyKey = `${BACKTESTING_NAMESPACES.HISTORY}:index`;
    let history = await getKVStore(this.env, historyKey) || [];

    // Apply filters
    if (filters.status) {
      history = history.filter(item => item.status === filters.status);
    }

    if (filters.strategy) {
      history = history.filter(item =>
        item.config?.strategy?.name === filters.strategy
      );
    }

    if (filters.symbol) {
      history = history.filter(item =>
        item.config?.symbols?.includes(filters.symbol)
      );
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      history = history.filter(item => new Date(item.createdAt) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      history = history.filter(item => new Date(item.createdAt) <= toDate);
    }

    // Sort by creation date (newest first)
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedHistory = history.slice(startIndex, endIndex);

    return {
      runs: paginatedHistory,
      pagination: {
        page,
        limit,
        total: history.length,
        pages: Math.ceil(history.length / limit)
      }
    };
  }

  /**
   * Delete backtest data (for cleanup)
   */
  async deleteBacktestData(runId) {
    const namespaces = [
      BACKTESTING_NAMESPACES.RUNS,
      BACKTESTING_NAMESPACES.RESULTS,
      BACKTESTING_NAMESPACES.METRICS,
      BACKTESTING_NAMESPACES.VALIDATION
    ];

    const deletePromises = namespaces.map(namespace => {
      const key = `${namespace}:${runId}`;
      return deleteKVStore(this.env, key);
    });

    await Promise.all(deletePromises);

    // Update history
    await this._updateHistoryIndex(runId, 'deleted', { deletedAt: new Date().toISOString() });

    return true;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats() {
    const stats = {
      totalRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      activeRuns: 0,
      totalResults: 0,
      totalValidations: 0,
      totalComparisons: 0,
      storageUsage: {
        runs: 0,
        results: 0,
        metrics: 0,
        validation: 0,
        comparisons: 0
      }
    };

    // Count runs by status
    try {
      const runKeys = await listKVStore(this.env, BACKTESTING_NAMESPACES.RUNS + ':');
      stats.totalRuns = runKeys.length;

      for (const key of runKeys.slice(0, 50)) { // Limit for performance
        const run = await getKVStore(this.env, key);
        if (run) {
          if (run.status === 'completed') stats.completedRuns++;
          else if (run.status === 'failed') stats.failedRuns++;
          else if (['queued', 'running'].includes(run.status)) stats.activeRuns++;
        }
      }
    } catch (error) {
      console.warn('Error counting runs:', error);
    }

    // Count other data types
    try {
      stats.totalResults = (await listKVStore(this.env, BACKTESTING_NAMESPACES.RESULTS + ':')).length;
      stats.totalValidations = (await listKVStore(this.env, BACKTESTING_NAMESPACES.VALIDATION + ':')).length;
      stats.totalComparisons = (await listKVStore(this.env, BACKTESTING_NAMESPACES.COMPARISONS + ':')).length;
    } catch (error) {
      console.warn('Error counting storage items:', error);
    }

    return stats;
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const history = await this.getBacktestHistory();
    let cleanedCount = 0;

    for (const run of history.runs) {
      const runDate = new Date(run.createdAt);
      if (runDate < cutoffDate && run.status !== 'active') {
        await this.deleteBacktestData(run.runId);
        cleanedCount++;
      }
    }

    return { cleanedCount, cutoffDate: cutoffDate.toISOString() };
  }

  /**
   * Update history index
   * @private
   */
  async _updateHistoryIndex(runId, eventType, data) {
    const historyKey = `${BACKTESTING_NAMESPACES.HISTORY}:index`;
    let history = await getKVStore(this.env, historyKey) || [];

    const historyEntry = {
      runId,
      eventType,
      timestamp: new Date().toISOString(),
      data
    };

    // Add or update entry
    const existingIndex = history.findIndex(item => item.runId === runId);
    if (existingIndex >= 0) {
      history[existingIndex] = { ...history[existingIndex], ...historyEntry };
    } else {
      history.push(historyEntry);
    }

    // Keep only last 1000 entries
    if (history.length > 1000) {
      history = history.slice(-1000);
    }

    await setKVStore(this.env, historyKey, history, BACKTESTING_TTL.HISTORY_CACHE);
  }

  /**
   * Estimate backtest duration
   * @private
   */
  _estimateDuration(config) {
    const baseDuration = 30; // 30 seconds base
    const symbolMultiplier = (config.symbols?.length || 1) * 10;
    const dateMultiplier = Math.log10(this._calculateDateRange(config) + 1) * 20;

    return Math.ceil(baseDuration + symbolMultiplier + dateMultiplier);
  }

  /**
   * Calculate date range
   * @private
   */
  _calculateDateRange(config) {
    if (!config.startDate || !config.endDate) return 365; // Default 1 year

    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    return Math.max(1, daysDiff);
  }
}

/**
 * Factory function for creating storage manager instances
 */
export function createBacktestingStorage(env) {
  return new BacktestingStorageManager(env);
}

/**
 * Utility functions for backtesting storage
 */
export async function getBacktestRunStatus(env, runId) {
  const storage = createBacktestingStorage(env);
  return await storage.getBacktestRun(runId);
}

export async function getStoredBacktestResults(env, runId) {
  const storage = createBacktestingStorage(env);
  return await storage.getBacktestResults(runId);
}

export async function getStoredPerformanceMetrics(env, runId) {
  const storage = createBacktestingStorage(env);
  return await storage.getPerformanceMetrics(runId);
}

export async function listBacktestHistory(env, filters = {}, pagination = {}) {
  const storage = createBacktestingStorage(env);
  return await storage.getBacktestHistory(filters, pagination);
}

export async function cleanupOldBacktestData(env, retentionDays = 30) {
  const storage = createBacktestingStorage(env);
  return await storage.cleanupOldData(retentionDays);
}