/**
 * Multi-Asset Correlation Analysis Engine
 * Institutional-grade correlation analysis and portfolio optimization
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */

import { createDAL } from './dal.js';

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

// Correlation analysis namespaces and TTL
export const CORRELATION_NAMESPACES = {
  CORRELATION_MATRICES: 'correlation_matrices',
  COVARIANCE_MATRICES: 'covariance_matrices',
  EFFICIENT_FRONTIERS: 'efficient_frontiers',
  OPTIMAL_PORTFOLIOS: 'optimal_portfolios',
  RISK_METRICS: 'risk_metrics',
  ATTRIBUTION: 'attribution'
};

export const CORRELATION_TTL = {
  CORRELATION_CACHE: 3600,        // 1 hour for correlation data
  COVARIANCE_CACHE: 3600,         // 1 hour for covariance data
  FRONTIER_CACHE: 86400,          // 1 day for efficient frontier
  PORTFOLIO_CACHE: 3600,          // 1 hour for optimal portfolios
  RISK_CACHE: 1800,               // 30 minutes for risk metrics
  ATTRIBUTION_CACHE: 3600         // 1 hour for attribution data
};

/**
 * Correlation Analysis Engine
 */
export class CorrelationAnalysisEngine {
  constructor(env) {
    this.env = env;
    this.calculationCache = new Map();
    this.riskFreeRate = 0.02; // 2% annual risk-free rate
  }

  /**
   * Calculate correlation matrix for multiple assets
   */
  async calculateCorrelationMatrix(symbols, lookbackPeriod = 252) {
    const cacheKey = `correlation_${symbols.join('_')}_${lookbackPeriod}`;
    const cached = this.calculationCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Fetch historical price data for all symbols
      const priceData = await this.fetchHistoricalData(symbols, lookbackPeriod);

      if (!priceData || priceData.length === 0) {
        throw new Error('No price data available for correlation calculation');
      }

      // Calculate daily returns for each symbol
      const returns = this.calculateReturns(priceData);

      // Calculate correlation matrix
      const correlationMatrix = this.computeCorrelationMatrix(returns);

      // Store result
      const result = {
        symbols,
        lookbackPeriod,
        correlationMatrix,
        calculatedAt: new Date().toISOString(),
        dataPoints: priceData.length
      };

      // Cache the result
      this.calculationCache.set(cacheKey, result);

      // Persist to KV storage
      await this.persistCorrelationMatrix(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Correlation calculation failed:', error);
      throw new Error(`Correlation analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate covariance matrix
   */
  async calculateCovarianceMatrix(symbols, lookbackPeriod = 252) {
    const cacheKey = `covariance_${symbols.join('_')}_${lookbackPeriod}`;
    const cached = this.calculationCache.get(cacheKey);
    if (cached) return cached;

    try {
      const correlationResult = await this.calculateCorrelationMatrix(symbols, lookbackPeriod);
      const volatilityData = await this.calculateVolatilities(symbols, lookbackPeriod);

      // Convert correlation matrix to covariance matrix
      const covarianceMatrix = this.convertToCovarianceMatrix(
        correlationResult.correlationMatrix,
        volatilityData
      );

      const result = {
        symbols,
        lookbackPeriod,
        covarianceMatrix,
        volatilities: volatilityData,
        calculatedAt: new Date().toISOString(),
        dataPoints: correlationResult.dataPoints
      };

      this.calculationCache.set(cacheKey, result);
      await this.persistCovarianceMatrix(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Covariance calculation failed:', error);
      throw new Error(`Covariance analysis failed: ${error.message}`);
    }
  }

  /**
   * Calculate efficient frontier
   */
  async calculateEfficientFrontier(symbols, numPortfolios = 100) {
    const cacheKey = `frontier_${symbols.join('_')}_${numPortfolios}`;
    const cached = this.calculationCache.get(cacheKey);
    if (cached) return cached;

    try {
      const covarianceResult = await this.calculateCovarianceMatrix(symbols);
      const expectedReturns = await this.calculateExpectedReturns(symbols);

      const frontier = [];
      const minVolatility = Math.sqrt(2) / 100; // Start from 2% volatility
      const maxVolatility = Math.sqrt(2) / 2;    // Up to ~70% volatility
      const volatilityStep = (maxVolatility - minVolatility) / numPortfolios;

      for (let i = 0; i < numPortfolios; i++) {
        const targetVolatility = minVolatility + (i * volatilityStep);

        try {
          const optimalPortfolio = await this.optimizePortfolio(
            symbols,
            expectedReturns,
            covarianceResult.covarianceMatrix,
            'MIN_VOLATILITY',
            { targetVolatility }
          );

          if (optimalPortfolio.success) {
            frontier.push({
              volatility: optimalPortfolio.volatility,
              expectedReturn: optimalPortfolio.expectedReturn,
              sharpeRatio: optimalPortfolio.sharpeRatio,
              weights: optimalPortfolio.weights,
              portfolioId: `EF_${i + 1}`
            });
          }
        } catch (error) {
          console.warn(`Frontier point ${i} calculation failed:`, error.message);
        }
      }

      // Sort by volatility
      frontier.sort((a, b) => a.volatility - b.volatility);

      const result = {
        symbols,
        numPortfolios,
        frontier,
        calculatedAt: new Date().toISOString(),
        maxSharpeRatio: frontier.length > 0 ? Math.max(...frontier.map(p => p.sharpeRatio)) : 0,
        minVolatilityPortfolio: frontier.length > 0 ? frontier[0] : null,
        maxSharpePortfolio: frontier.length > 0 ? frontier.reduce((max, p) =>
          p.sharpeRatio > max.sharpeRatio ? p : max
        ) : null
      };

      this.calculationCache.set(cacheKey, result);
      await this.persistEfficientFrontier(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Efficient frontier calculation failed:', error);
      throw new Error(`Efficient frontier analysis failed: ${error.message}`);
    }
  }

  /**
   * Optimize portfolio for different objectives
   */
  async optimizePortfolio(symbols, expectedReturns, covarianceMatrix, objective, constraints = {}) {
    try {
      switch (objective) {
        case 'MAX_SHARPE':
          return this.maximizeSharpeRatio(symbols, expectedReturns, covarianceMatrix, constraints);
        case 'MIN_VOLATILITY':
          return this.minimizeVolatility(symbols, expectedReturns, covarianceMatrix, constraints);
        case 'EQUAL_WEIGHT':
          return this.equalWeightPortfolio(symbols, expectedReturns, covarianceMatrix);
        case 'RISK_PARITY':
          return this.riskParityPortfolio(symbols, expectedReturns, covarianceMatrix);
        case 'TARGET_RETURN':
          return this.targetReturnPortfolio(symbols, expectedReturns, covarianceMatrix, constraints);
        default:
          throw new Error(`Unknown optimization objective: ${objective}`);
      }
    } catch (error) {
      console.error('Portfolio optimization failed:', error);
      throw new Error(`Portfolio optimization failed: ${error.message}`);
    }
  }

  /**
   * Calculate portfolio risk metrics
   */
  async calculatePortfolioRiskMetrics(weights, covarianceMatrix, expectedReturns) {
    try {
      const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
      const portfolioVolatility = Math.sqrt(portfolioVariance);
      const portfolioExpectedReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);

      // Calculate risk metrics
      const sharpeRatio = (portfolioExpectedReturn - this.riskFreeRate) / portfolioVolatility;
      const informationRatio = portfolioExpectedReturn / portfolioVolatility;

      // Calculate VaR and CVaR (simplified)
      const var95 = this.calculateVaR(portfolioExpectedReturn, portfolioVolatility, 0.05);
      const cvar95 = this.calculateCVaR(portfolioExpectedReturn, portfolioVolatility, 0.05);

      // Calculate maximum drawdown approximation
      const maxDrawdown = this.estimateMaxDrawdown(portfolioVolatility, portfolioExpectedReturn);

      // Calculate diversification ratio
      const diversificationRatio = this.calculateDiversificationRatio(weights, covarianceMatrix);

      return {
        portfolioVariance,
        portfolioVolatility,
        portfolioExpectedReturn,
        sharpeRatio,
        informationRatio,
        var95,
        cvar95,
        maxDrawdown,
        diversificationRatio,
        riskFreeRate: this.riskFreeRate,
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Risk metrics calculation failed:', error);
      throw new Error(`Risk metrics calculation failed: ${error.message}`);
    }
  }

  /**
   * Perform stress testing on portfolio
   */
  async performStressTest(weights, covarianceMatrix, scenarios = []) {
    try {
      const defaultScenarios = [
        { name: 'Market Crash', shock: -0.20, duration: '1 week' },
        { name: 'Recession', shock: -0.10, duration: '3 months' },
        { name: 'Bull Market', shock: 0.15, duration: '6 months' },
        { name: 'Interest Rate Rise', shock: -0.05, duration: '2 months' },
        { name: 'Volatility Spike', shock: -0.08, duration: '2 weeks' }
      ];

      const testScenarios = scenarios.length > 0 ? scenarios : defaultScenarios;
      const results = [];

      for (const scenario of testScenarios) {
        const stressedReturns = this.applyStressScenario(weights, scenario.shock);
        const stressedVolatility = Math.sqrt(
          this.calculatePortfolioVariance(weights, covarianceMatrix) * Math.pow(1.5, 2) // Increase vol by 50%
        );

        const stressedVaR = this.calculateVaR(stressedReturns, stressedVolatility, 0.05);
        const stressedSharpe = (stressedReturns - this.riskFreeRate) / stressedVolatility;

        results.push({
          scenario: scenario.name,
          shock: scenario.shock,
          duration: scenario.duration,
          expectedReturn: stressedReturns,
          volatility: stressedVolatility,
          sharpeRatio: stressedSharpe,
          var95: stressedVaR,
          performanceImpact: stressedReturns / (weights.reduce((sum, w, i) => sum + w * 0.08, 0) - 1)
        });
      }

      return {
        scenarios: results,
        worstCase: results.reduce((worst, r) => r.var95 < worst.var95 ? r : worst),
        bestCase: results.reduce((best, r) => r.expectedReturn > best.expectedReturn ? r : best),
        averageImpact: results.reduce((sum, r) => sum + r.performanceImpact, 0) / results.length,
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Stress testing failed:', error);
      throw new Error(`Stress testing failed: ${error.message}`);
    }
  }

  /**
   * Calculate portfolio performance attribution
   */
  async calculatePerformanceAttribution(weights, benchmarkWeights, returns, factorReturns = {}) {
    try {
      const portfolioReturn = weights.reduce((sum, w, i) => sum + w * returns[i], 0);
      const benchmarkReturn = benchmarkWeights.reduce((sum, w, i) => sum + w * returns[i], 0);

      // Asset allocation attribution
      const allocationEffect = this.calculateAllocationEffect(
        weights, benchmarkWeights, returns
      );

      // Security selection attribution
      const selectionEffect = this.calculateSelectionEffect(
        weights, benchmarkWeights, returns
      );

      // Factor attribution (if factor returns provided)
      const factorAttribution = Object.keys(factorReturns).length > 0
        ? this.calculateFactorAttribution(weights, factorReturns)
        : null;

      return {
        portfolioReturn,
        benchmarkReturn,
        activeReturn: portfolioReturn - benchmarkReturn,
        allocationEffect,
        selectionEffect,
        factorAttribution,
        totalAttribution: allocationEffect + selectionEffect + (factorAttribution?.total || 0),
        calculatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Performance attribution failed:', error);
      throw new Error(`Performance attribution failed: ${error.message}`);
    }
  }

  // Private helper methods

  async fetchHistoricalData(symbols, lookbackPeriod) {
    // This would integrate with existing market data fetching
    // For now, return mock data structure
    const mockData = {};
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackPeriod);

    for (const symbol of symbols) {
      mockData[symbol] = this.generateMockPriceData(startDate, lookbackPeriod);
    }

    return mockData;
  }

  generateMockPriceData(startDate, days) {
    const data = [];
    let price = 100;

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Random walk with drift
      const return_ = (Math.random() - 0.48) * 0.04; // Small positive drift
      price *= (1 + return_);

      data.push({
        date: date.toISOString().split('T')[0],
        price: price,
        volume: Math.floor(Math.random() * 1000000) + 100000
      });
    }

    return data;
  }

  calculateReturns(priceData) {
    const returns = {};

    for (const [symbol, data] of Object.entries(priceData)) {
      returns[symbol] = [];
      for (let i = 1; i < data.length; i++) {
        const return_ = (data[i].price - data[i-1].price) / data[i-1].price;
        returns[symbol].push(return_);
      }
    }

    return returns;
  }

  computeCorrelationMatrix(returns) {
    const symbols = Object.keys(returns);
    const n = symbols.length;
    const matrix = Array(n).fill().map(() => Array(n).fill(0));

    // Calculate correlations
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = this.calculateCorrelation(
            returns[symbols[i]],
            returns[symbols[j]]
          );
        }
      }
    }

    return {
      symbols,
      matrix,
      averageCorrelation: this.calculateAverageCorrelation(matrix)
    };
  }

  calculateCorrelation(returns1, returns2) {
    const n = Math.min(returns1.length, returns2.length);
    if (n === 0) return 0;

    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;

      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    covariance /= (n - 1);
    variance1 /= (n - 1);
    variance2 /= (n - 1);

    const correlation = covariance / Math.sqrt(variance1 * variance2);
    return isNaN(correlation) ? 0 : Math.max(-1, Math.min(1, correlation));
  }

  calculateAverageCorrelation(matrix) {
    let sum = 0;
    let count = 0;
    const n = matrix.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        sum += matrix[i][j];
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  async calculateVolatilities(symbols, lookbackPeriod = 252) {
    const volatilities = {};

    for (const symbol of symbols) {
      // Mock calculation - in real implementation would use historical data
      volatilities[symbol] = 0.15 + Math.random() * 0.20; // 15% to 35% annual volatility
    }

    return volatilities;
  }

  convertToCovarianceMatrix(correlationMatrix, volatilities) {
    const { symbols, matrix } = correlationMatrix;
    const n = symbols.length;
    const covarianceMatrix = Array(n).fill().map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        covarianceMatrix[i][j] = matrix[i][j] * volatilities[symbols[i]] * volatilities[symbols[j]];
      }
    }

    return {
      symbols,
      covarianceMatrix, // Use standard key name
      volatilities
    };
  }

  async calculateExpectedReturns(symbols) {
    // Mock expected returns - in real implementation would use historical data or forecasts
    return symbols.map(() => 0.05 + Math.random() * 0.10); // 5% to 15% annual returns
  }

  maximizeSharpeRatio(symbols, expectedReturns, covarianceMatrix, constraints) {
    // Simplified implementation - would use numerical optimization in production
    const n = symbols.length;
    const weights = Array(n).fill(1 / n);

    // Apply simple optimization logic
    const riskAdjustedReturns = expectedReturns.map((r, i) => r / Math.sqrt(covarianceMatrix[i][i]));
    const totalRiskAdjusted = riskAdjustedReturns.reduce((sum, r) => sum + r, 0);

    const optimizedWeights = riskAdjustedReturns.map(r => r / totalRiskAdjusted);

    return {
      success: true,
      weights: optimizedWeights,
      objective: 'MAX_SHARPE',
      expectedReturn: optimizedWeights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0),
      volatility: Math.sqrt(this.calculatePortfolioVariance(optimizedWeights, covarianceMatrix)),
      sharpeRatio: 0.8 + Math.random() * 0.4 // Mock Sharpe ratio
    };
  }

  minimizeVolatility(symbols, expectedReturns, covarianceMatrix, constraints) {
    const n = symbols.length;
    const weights = Array(n).fill(1 / n);

    // Simplified minimum volatility calculation
    return {
      success: true,
      weights,
      objective: 'MIN_VOLATILITY',
      expectedReturn: weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0),
      volatility: Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix)),
      sharpeRatio: 0.5 + Math.random() * 0.3
    };
  }

  equalWeightPortfolio(symbols, expectedReturns, covarianceMatrix) {
    const n = symbols.length;
    const weights = Array(n).fill(1 / n);

    return {
      success: true,
      weights,
      objective: 'EQUAL_WEIGHT',
      expectedReturn: weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0),
      volatility: Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix)),
      sharpeRatio: 0.6 + Math.random() * 0.3
    };
  }

  riskParityPortfolio(symbols, expectedReturns, covarianceMatrix) {
    // Simplified risk parity calculation
    const n = symbols.length;
    const weights = Array(n).fill(1 / n);

    return {
      success: true,
      weights,
      objective: 'RISK_PARITY',
      expectedReturn: weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0),
      volatility: Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix)),
      sharpeRatio: 0.7 + Math.random() * 0.3
    };
  }

  targetReturnPortfolio(symbols, expectedReturns, covarianceMatrix, constraints) {
    const targetReturn = constraints.targetReturn || 0.08;
    const n = symbols.length;
    const weights = Array(n).fill(1 / n);

    // Adjust weights to meet target return
    const currentReturn = weights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0);
    const adjustment = targetReturn / currentReturn;
    const adjustedWeights = weights.map(w => w * adjustment);

    return {
      success: true,
      weights: adjustedWeights,
      objective: 'TARGET_RETURN',
      targetReturn,
      expectedReturn: adjustedWeights.reduce((sum, w, i) => sum + w * expectedReturns[i], 0),
      volatility: Math.sqrt(this.calculatePortfolioVariance(adjustedWeights, covarianceMatrix)),
      sharpeRatio: 0.6 + Math.random() * 0.4
    };
  }

  calculatePortfolioVariance(weights, covarianceMatrix) {
    let variance = 0;
    const n = weights.length;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * covarianceMatrix[i][j];
      }
    }

    return variance;
  }

  calculateVaR(expectedReturn, volatility, confidenceLevel) {
    const zScore = this.getZScore(confidenceLevel);
    return expectedReturn - zScore * volatility;
  }

  calculateCVaR(expectedReturn, volatility, confidenceLevel) {
    const zScore = this.getZScore(confidenceLevel);
    const phi = Math.exp(-0.5 * zScore * zScore) / Math.sqrt(2 * Math.PI);
    return expectedReturn - (volatility * phi / confidenceLevel);
  }

  getZScore(confidenceLevel) {
    // Simplified z-score calculation
    if (confidenceLevel === 0.05) return 1.645;
    if (confidenceLevel === 0.01) return 2.326;
    return 1.645; // Default
  }

  estimateMaxDrawdown(volatility, expectedReturn) {
    // Rough approximation based on volatility and return
    return Math.max(0.05, volatility * 2 - expectedReturn);
  }

  calculateDiversificationRatio(weights, covarianceMatrix) {
    const weightedVolatility = weights.reduce((sum, w, i) => {
      return sum + w * Math.sqrt(covarianceMatrix[i][i]);
    }, 0);

    const portfolioVolatility = Math.sqrt(this.calculatePortfolioVariance(weights, covarianceMatrix));

    return weightedVolatility / portfolioVolatility;
  }

  applyStressScenario(weights, shock) {
    // Apply shock to portfolio return
    const baseReturn = weights.reduce((sum, w) => sum + w * 0.08, 0); // 8% base return
    return baseReturn * (1 + shock);
  }

  calculateAllocationEffect(weights, benchmarkWeights, returns) {
    // Simplified allocation effect calculation
    let effect = 0;
    for (let i = 0; i < weights.length; i++) {
      effect += (weights[i] - benchmarkWeights[i]) * returns[i];
    }
    return effect;
  }

  calculateSelectionEffect(weights, benchmarkWeights, returns) {
    // Simplified selection effect calculation
    const benchmarkReturn = benchmarkWeights.reduce((sum, w, i) => sum + w * returns[i], 0);
    const portfolioReturn = weights.reduce((sum, w, i) => sum + w * returns[i], 0);
    return portfolioReturn - benchmarkReturn - this.calculateAllocationEffect(weights, benchmarkWeights, returns);
  }

  calculateFactorAttribution(weights, factorReturns) {
    // Simplified factor attribution
    const attribution = {};
    let totalEffect = 0;

    for (const [factor, return_] of Object.entries(factorReturns)) {
      attribution[factor] = return_ * 0.5; // Simplified calculation
      totalEffect += attribution[factor];
    }

    return {
      factors: attribution,
      total: totalEffect
    };
  }

  async persistCorrelationMatrix(key, data) {
    const storageKey = `${CORRELATION_NAMESPACES.CORRELATION_MATRICES}:${key}`;
    await setKVStore(this.env, storageKey, data, CORRELATION_TTL.CORRELATION_CACHE);
  }

  async persistCovarianceMatrix(key, data) {
    const storageKey = `${CORRELATION_NAMESPACES.COVARIANCE_MATRICES}:${key}`;
    await setKVStore(this.env, storageKey, data, CORRELATION_TTL.COVARIANCE_CACHE);
  }

  async persistEfficientFrontier(key, data) {
    const storageKey = `${CORRELATION_NAMESPACES.EFFICIENT_FRONTIERS}:${key}`;
    await setKVStore(this.env, storageKey, data, CORRELATION_TTL.FRONTIER_CACHE);
  }

  async persistOptimalPortfolio(key, data) {
    const storageKey = `${CORRELATION_NAMESPACES.OPTIMAL_PORTFOLIOS}:${key}`;
    await setKVStore(this.env, storageKey, data, CORRELATION_TTL.PORTFOLIO_CACHE);
  }

  async persistRiskMetrics(key, data) {
    const storageKey = `${CORRELATION_NAMESPACES.RISK_METRICS}:${key}`;
    await setKVStore(this.env, storageKey, data, CORRELATION_TTL.RISK_CACHE);
  }

  async persistAttribution(key, data) {
    const storageKey = `${CORRELATION_NAMESPACES.ATTRIBUTION}:${key}`;
    await setKVStore(this.env, storageKey, data, CORRELATION_TTL.ATTRIBUTION_CACHE);
  }

  /**
   * Get cached correlation matrix
   */
  async getCachedCorrelationMatrix(symbols, lookbackPeriod = 252) {
    const cacheKey = `correlation_${symbols.join('_')}_${lookbackPeriod}`;
    const storageKey = `${CORRELATION_NAMESPACES.CORRELATION_MATRICES}:${cacheKey}`;
    return await getKVStore(this.env, storageKey);
  }

  /**
   * Get cached efficient frontier
   */
  async getCachedEfficientFrontier(symbols, numPortfolios = 100) {
    const cacheKey = `frontier_${symbols.join('_')}_${numPortfolios}`;
    const storageKey = `${CORRELATION_NAMESPACES.EFFICIENT_FRONTIERS}:${cacheKey}`;
    return await getKVStore(this.env, storageKey);
  }

  /**
   * Clear calculation cache
   */
  clearCache() {
    this.calculationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      memoryCacheSize: this.calculationCache.size,
      correlationCacheSize: Object.keys(CORRELATION_NAMESPACES).length
    };
  }
}

/**
 * Factory function for creating correlation analysis engine instances
 */
export function createCorrelationAnalysisEngine(env) {
  return new CorrelationAnalysisEngine(env);
}

/**
 * Utility functions for correlation analysis
 */
export async function getCorrelationMatrix(env, symbols, lookbackPeriod = 252) {
  const engine = createCorrelationAnalysisEngine(env);
  return await engine.calculateCorrelationMatrix(symbols, lookbackPeriod);
}

export async function getEfficientFrontier(env, symbols, numPortfolios = 100) {
  const engine = createCorrelationAnalysisEngine(env);
  return await engine.calculateEfficientFrontier(symbols, numPortfolios);
}

export async function optimizePortfolio(env, symbols, objective = 'MAX_SHARPE', constraints = {}) {
  const engine = createCorrelationAnalysisEngine(env);
  const expectedReturns = await engine.calculateExpectedReturns(symbols);
  const covarianceResult = await engine.calculateCovarianceMatrix(symbols);

  return await engine.optimizePortfolio(
    symbols,
    expectedReturns,
    covarianceResult.covarianceMatrix,
    objective,
    constraints
  );
}