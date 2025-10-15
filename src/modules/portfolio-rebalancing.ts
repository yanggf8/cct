/**
 * Portfolio Rebalancing Strategies Module
 * Institutional-grade portfolio rebalancing and maintenance strategies
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */

import { createDAL } from './dal.js';
import { createCorrelationAnalysisEngine } from './correlation-analysis.js';

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

// Rebalancing namespaces and TTL
export const REBALANCING_NAMESPACES = {
  STRATEGIES: 'rebalancing_strategies',
  SCHEDULES: 'rebalancing_schedules',
  EXECUTION: 'rebalancing_execution',
  MONITORING: 'rebalancing_monitoring',
  ALERTS: 'rebalancing_alerts',
  HISTORY: 'rebalancing_history'
};

export const REBALANCING_TTL = {
  STRATEGY_CACHE: 86400,        // 1 day for strategies
  SCHEDULE_CACHE: 3600,         // 1 hour for schedules
  EXECUTION_CACHE: 1800,        // 30 minutes for execution data
  MONITORING_CACHE: 300,        // 5 minutes for monitoring data
  ALERT_CACHE: 1800,            // 30 minutes for alerts
  HISTORY_CACHE: 2592000        // 1 month for historical data
};

/**
 * Rebalancing Strategy Types
 */
export const REBALANCING_STRATEGIES = {
  TIME_BASED: 'TIME_BASED',           // Calendar-based rebalancing
  THRESHOLD_BASED: 'THRESHOLD_BASED', // Deviation-based rebalancing
  VOLATILITY_TARGET: 'VOLATILITY_TARGET', // Volatility targeting
  DRIFT_CONTROL: 'DRIFT_CONTROL',     // Control portfolio drift
  OPPORTUNISTIC: 'OPPORTUNISTIC',     // Opportunity-based rebalancing
  TAX_LOSS_HARVESTING: 'TAX_LOSS_HARVESTING', // Tax optimization
  RISK_PARITY: 'RISK_PARITY',         // Maintain risk parity
  DYNAMIC_ASSET_ALLOCATION: 'DYNAMIC_ASSET_ALLOCATION' // Dynamic allocation
};

/**
 * Portfolio Rebalancing Engine
 */
export class PortfolioRebalancingEngine {
  constructor(env) {
    this.env = env;
    this.correlationEngine = createCorrelationAnalysisEngine(env);
    this.transactionCosts = {
      equity: 0.001,    // 0.1% for equities
      etf: 0.0005,      // 0.05% for ETFs
      bond: 0.0002,     // 0.02% for bonds
      commodity: 0.0015 // 0.15% for commodities
    };
    this.minTradeSize = 100; // Minimum trade size in USD
    this.maxDeviation = 0.05; // 5% maximum deviation before rebalancing
  }

  /**
   * Create rebalancing strategy
   */
  async createRebalancingStrategy(config) {
    const strategy = {
      id: this.generateStrategyId(),
      name: config.name,
      type: config.type || REBALANCING_STRATEGIES.THRESHOLD_BASED,
      portfolioId: config.portfolioId,
      targetWeights: config.targetWeights || {},
      thresholds: config.thresholds || {},
      frequency: config.frequency || 'monthly',
      constraints: config.constraints || {},
      executionConfig: config.executionConfig || {},
      monitoringConfig: config.monitoringConfig || {},
      taxConfig: config.taxConfig || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      version: '1.0.0'
    };

    // Validate strategy configuration
    this.validateStrategy(strategy);

    // Store strategy
    await this.persistStrategy(strategy);

    return strategy;
  }

  /**
   * Analyze portfolio for rebalancing needs
   */
  async analyzeRebalancingNeeds(portfolioId, currentWeights, targetWeights, strategy) {
    try {
      const analysis = {
        portfolioId,
        strategyId: strategy.id,
        currentWeights,
        targetWeights,
        analysisDate: new Date().toISOString(),
        rebalancingRequired: false,
        deviations: {},
        recommendedTrades: [],
        estimatedCosts: {},
        taxImplications: {},
        executionPlan: {}
      };

      // Calculate weight deviations
      for (const [asset, targetWeight] of Object.entries(targetWeights)) {
        const currentWeight = currentWeights[asset] || 0;
        const deviation = currentWeight - targetWeight;
        const deviationPercent = Math.abs(deviation / targetWeight);

        analysis.deviations[asset] = {
          currentWeight,
          targetWeight,
          deviation,
          deviationPercent,
          absoluteDeviation: Math.abs(deviation)
        };
      }

      // Determine if rebalancing is required
      analysis.rebalancingRequired = this.isRebalancingRequired(analysis.deviations, strategy);

      if (analysis.rebalancingRequired) {
        // Generate recommended trades
        analysis.recommendedTrades = await this.generateTrades(analysis, strategy);

        // Calculate estimated costs
        analysis.estimatedCosts = await this.calculateTradingCosts(analysis.recommendedTrades);

        // Analyze tax implications
        analysis.taxImplications = await this.analyzeTaxImplications(analysis.recommendedTrades, strategy);

        // Create execution plan
        analysis.executionPlan = await this.createExecutionPlan(analysis, strategy);
      }

      // Store analysis
      await this.persistRebalancingAnalysis(analysis);

      return analysis;
    } catch (error) {
      console.error('Rebalancing analysis failed:', error);
      throw new Error(`Rebalancing analysis failed: ${error.message}`);
    }
  }

  /**
   * Execute rebalancing trades
   */
  async executeRebalancing(analysis, executionConfig = {}) {
    try {
      const execution = {
        id: this.generateExecutionId(),
        analysisId: analysis.analysisId || `${Date.now()}`,
        portfolioId: analysis.portfolioId,
        strategyId: analysis.strategyId,
        trades: [],
        status: 'pending',
        startedAt: new Date().toISOString(),
        completedAt: null,
        totalCost: 0,
        totalTax: 0,
        netPortfolioValue: 0,
        executionResults: {}
      };

      // Sort trades by priority and size
      const sortedTrades = this.prioritizeTrades(analysis.recommendedTrades, executionConfig);

      // Execute trades
      for (const trade of sortedTrades) {
        const tradeResult = await this.executeTrade(trade, executionConfig);
        execution.trades.push(tradeResult);
        execution.totalCost += tradeResult.cost;
        execution.totalTax += tradeResult.tax || 0;

        // Check for execution limits and pauses
        if (executionConfig.maxDailyTrades && execution.trades.length >= executionConfig.maxDailyTrades) {
          break;
        }
      }

      // Calculate final portfolio state
      execution.netPortfolioValue = await this.calculatePortfolioValue(analysis.portfolioId, execution.trades);
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();

      // Store execution record
      await this.persistExecution(execution);

      // Update strategy status
      await this.updateStrategyMetrics(analysis.strategyId, execution);

      return execution;
    } catch (error) {
      console.error('Rebalancing execution failed:', error);
      throw new Error(`Rebalancing execution failed: ${error.message}`);
    }
  }

  /**
   * Monitor portfolio drift
   */
  async monitorPortfolioDrift(portfolioId, targetWeights, strategy) {
    try {
      const monitoring = {
        portfolioId,
        strategyId: strategy.id,
        monitoringDate: new Date().toISOString(),
        currentWeights: {},
        driftMetrics: {},
        alerts: [],
        recommendations: []
      };

      // Get current portfolio weights
      monitoring.currentWeights = await this.getCurrentPortfolioWeights(portfolioId);

      // Calculate drift metrics
      monitoring.driftMetrics = this.calculateDriftMetrics(
        monitoring.currentWeights,
        targetWeights
      );

      // Generate alerts if drift exceeds thresholds
      monitoring.alerts = this.generateDriftAlerts(monitoring.driftMetrics, strategy);

      // Generate recommendations
      monitoring.recommendations = this.generateRecommendations(monitoring, strategy);

      // Store monitoring data
      await this.persistMonitoring(monitoring);

      return monitoring;
    } catch (error) {
      console.error('Portfolio monitoring failed:', error);
      throw new Error(`Portfolio monitoring failed: ${error.message}`);
    }
  }

  /**
   * Perform tax-loss harvesting
   */
  async performTaxLossHarvesting(portfolioId, taxConfig = {}) {
    try {
      const harvesting = {
        portfolioId,
        harvestingDate: new Date().toISOString(),
        taxYear: new Date().getFullYear(),
        positions: [],
        opportunities: [],
        executedTrades: [],
        taxBenefits: {},
        washSaleRisks: []
      };

      // Get current portfolio positions
      harvesting.positions = await this.getPortfolioPositions(portfolioId);

      // Identify tax-loss harvesting opportunities
      harvesting.opportunities = this.identifyHarvestingOpportunities(
        harvesting.positions,
        taxConfig
      );

      // Execute harvesting trades
      for (const opportunity of harvesting.opportunities) {
        if (opportunity.recommended) {
          const harvestTrade = await this.executeHarvestTrade(opportunity, taxConfig);
          harvesting.executedTrades.push(harvestTrade);
        }
      }

      // Calculate tax benefits
      harvesting.taxBenefits = await this.calculateTaxBenefits(harvesting.executedTrades);

      // Identify wash sale risks
      harvesting.washSaleRisks = this.identifyWashSaleRisks(harvesting.executedTrades);

      // Store harvesting results
      await this.persistTaxHarvesting(harvesting);

      return harvesting;
    } catch (error) {
      console.error('Tax-loss harvesting failed:', error);
      throw new Error(`Tax-loss harvesting failed: ${error.message}`);
    }
  }

  /**
   * Create dynamic asset allocation
   */
  async createDynamicAllocation(portfolioId, marketConditions, riskTolerance) {
    try {
      const allocation = {
        portfolioId,
        allocationDate: new Date().toISOString(),
        marketConditions,
        riskTolerance,
        dynamicWeights: {},
        allocationSignals: {},
        riskAdjustments: {},
        executionPlan: {}
      };

      // Analyze market conditions
      const marketAnalysis = await this.analyzeMarketConditions(marketConditions);

      // Generate allocation signals
      allocation.allocationSignals = this.generateAllocationSignals(marketAnalysis, riskTolerance);

      // Calculate dynamic weights
      allocation.dynamicWeights = this.calculateDynamicWeights(
        allocation.allocationSignals,
        riskTolerance
      );

      // Apply risk adjustments
      allocation.riskAdjustments = this.applyRiskAdjustments(
        allocation.dynamicWeights,
        marketAnalysis
      );

      // Create execution plan
      allocation.executionPlan = await this.createAllocationExecutionPlan(allocation);

      // Store allocation plan
      await this.persistDynamicAllocation(allocation);

      return allocation;
    } catch (error) {
      console.error('Dynamic allocation creation failed:', error);
      throw new Error(`Dynamic allocation failed: ${error.message}`);
    }
  }

  /**
   * Perform portfolio stress test for rebalancing
   */
  async performRebalancingStressTest(portfolioId, strategies, scenarios = []) {
    try {
      const stressTest = {
        portfolioId,
        testDate: new Date().toISOString(),
        strategies,
        scenarios: scenarios.length > 0 ? scenarios : this.getDefaultScenarios(),
        results: {},
        recommendations: {}
      };

      // Run stress tests for each strategy
      for (const strategy of strategies) {
        const strategyResults = await this.testStrategyUnderStress(portfolioId, strategy, stressTest.scenarios);
        stressTest.results[strategy.id] = strategyResults;
      }

      // Generate recommendations
      stressTest.recommendations = this.generateStressTestRecommendations(stressTest.results);

      // Store stress test results
      await this.persistStressTest(stressTest);

      return stressTest;
    } catch (error) {
      console.error('Rebalancing stress test failed:', error);
      throw new Error(`Stress test failed: ${error.message}`);
    }
  }

  // Private helper methods

  generateStrategyId() {
    return `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateExecutionId() {
    return `execution_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateStrategy(strategy) {
    // Validate required fields
    if (!strategy.name) throw new Error('Strategy name is required');
    if (!strategy.portfolioId) throw new Error('Portfolio ID is required');
    if (!strategy.targetWeights || Object.keys(strategy.targetWeights).length === 0) {
      throw new Error('Target weights are required');
    }

    // Validate weights sum to 1
    const weightSum = Object.values(strategy.targetWeights).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      throw new Error('Target weights must sum to 1.0');
    }

    // Validate strategy type
    if (!Object.values(REBALANCING_STRATEGIES).includes(strategy.type)) {
      throw new Error('Invalid strategy type');
    }
  }

  isRebalancingRequired(deviations, strategy) {
    switch (strategy.type) {
      case REBALANCING_STRATEGIES.THRESHOLD_BASED:
        return Object.values(deviations).some(dev =>
          dev.deviationPercent > (strategy.thresholds.deviation || 0.05)
        );

      case REBALANCING_STRATEGIES.TIME_BASED:
        return this.shouldTimeBasedRebalance(strategy);

      case REBALANCING_STRATEGIES.VOLATILITY_TARGET:
        return this.shouldVolatilityRebalance(deviations, strategy);

      case REBALANCING_STRATEGIES.DRIFT_CONTROL:
        return this.shouldControlDrift(deviations, strategy);

      default:
        return false;
    }
  }

  async generateTrades(analysis, strategy) {
    const trades = [];

    for (const [asset, deviation] of Object.entries(analysis.deviations)) {
      if (Math.abs(deviation.deviationPercent) > (strategy.thresholds.deviation || 0.05)) {
        const tradeValue = Math.abs(deviation.deviation) * 1000000; // Assume $1M portfolio
        const tradeDirection = deviation.deviation > 0 ? 'sell' : 'buy';

        if (tradeValue >= this.minTradeSize) {
          trades.push({
            asset,
            direction: tradeDirection,
            targetWeight: deviation.targetWeight,
            currentValue: tradeValue,
            shares: Math.floor(tradeValue / 100), // Assume $100 per share
            estimatedCost: tradeValue * this.transactionCosts.equity,
            priority: this.calculateTradePriority(deviation, strategy),
            reason: `Weight deviation: ${(deviation.deviationPercent * 100).toFixed(2)}%`
          });
        }
      }
    }

    return trades.sort((a, b) => b.priority - a.priority);
  }

  calculateTradePriority(deviation, strategy) {
    // Higher priority for larger deviations
    let priority = deviation.deviationPercent * 100;

    // Adjust for asset importance
    if (strategy.constraints.priorityAssets?.includes(deviation.asset)) {
      priority *= 1.5;
    }

    return priority;
  }

  async calculateTradingCosts(trades) {
    const totalCost = trades.reduce((sum, trade) => sum + trade.estimatedCost, 0);
    const marketImpactCost = this.calculateMarketImpactCost(trades);
    const bidAskSpreadCost = this.calculateBidAskSpreadCost(trades);

    return {
      commissionCost: totalCost,
      marketImpactCost,
      bidAskSpreadCost,
      totalEstimatedCost: totalCost + marketImpactCost + bidAskSpreadCost
    };
  }

  calculateMarketImpactCost(trades) {
    // Simplified market impact calculation
    return trades.reduce((sum, trade) => {
      const impactRate = Math.min(trade.currentValue / 1000000, 0.01); // Max 1% impact
      return sum + (trade.currentValue * impactRate);
    }, 0);
  }

  calculateBidAskSpreadCost(trades) {
    // Simplified bid-ask spread calculation
    return trades.reduce((sum, trade) => {
      const spreadRate = 0.0005; // 0.05% average spread
      return sum + (trade.currentValue * spreadRate);
    }, 0);
  }

  async analyzeTaxImplications(trades, strategy) {
    const shortTermGains = 0;
    const longTermGains = 0;
    const taxSavings = 0;

    return {
      shortTermCapitalGains: shortTermGains,
      longTermCapitalGains: longTermGains,
      estimatedTaxLiability: (shortTermGains * 0.35) + (longTermGains * 0.15),
      taxLossOpportunities: 0,
      taxSavings,
      recommendations: []
    };
  }

  async createExecutionPlan(analysis, strategy) {
    return {
      executionMethod: strategy.executionConfig.method || 'gradual',
      executionTimeframe: strategy.executionConfig.timeframe || '1_week',
      batchSizes: this.calculateBatchSizes(analysis.recommendedTrades),
      timingConstraints: strategy.executionConfig.timingConstraints || {},
      liquidityConstraints: strategy.executionConfig.liquidityConstraints || {}
    };
  }

  calculateBatchSizes(trades) {
    const batches = [];
    const batchSize = 5; // Max trades per batch

    for (let i = 0; i < trades.length; i += batchSize) {
      batches.push(trades.slice(i, i + batchSize));
    }

    return batches;
  }

  prioritizeTrades(trades, executionConfig) {
    // Sort by priority, then by trade size
    return trades.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.currentValue - a.currentValue;
    });
  }

  async executeTrade(trade, executionConfig) {
    // Mock trade execution
    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...trade,
      status: 'executed',
      executedAt: new Date().toISOString(),
      executedPrice: 100 + (Math.random() - 0.5) * 10, // Mock price
      executedShares: trade.shares,
      actualCost: trade.estimatedCost * (0.9 + Math.random() * 0.2), // +/- 10% variance
      settlementDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // T+2
    };
  }

  async calculatePortfolioValue(portfolioId, trades) {
    // Mock calculation
    return 1000000 + trades.reduce((sum, trade) => {
      return sum + (trade.direction === 'buy' ? -trade.actualCost : trade.actualCost);
    }, 0);
  }

  async getCurrentPortfolioWeights(portfolioId) {
    // Mock current weights
    return {
      'AAPL': 0.25,
      'MSFT': 0.20,
      'GOOGL': 0.15,
      'TSLA': 0.10,
      'NVDA': 0.20,
      'AMZN': 0.10
    };
  }

  calculateDriftMetrics(currentWeights, targetWeights) {
    const metrics = {
      maxDrift: 0,
      averageDrift: 0,
      driftVector: {},
      trackingError: 0,
      rebalancingFrequency: 0
    };

    const drifts = [];

    for (const [asset, targetWeight] of Object.entries(targetWeights)) {
      const currentWeight = currentWeights[asset] || 0;
      const drift = currentWeight - targetWeight;
      const driftPercent = Math.abs(drift / targetWeight);

      metrics.driftVector[asset] = {
        currentWeight,
        targetWeight,
        drift,
        driftPercent
      };

      drifts.push(driftPercent);
      metrics.maxDrift = Math.max(metrics.maxDrift, driftPercent);
    }

    metrics.averageDrift = drifts.reduce((sum, d) => sum + d, 0) / drifts.length;
    metrics.trackingError = Math.sqrt(drifts.reduce((sum, d) => sum + d * d, 0) / drifts.length);

    return metrics;
  }

  generateDriftAlerts(driftMetrics, strategy) {
    const alerts = [];
    const threshold = strategy.thresholds.deviation || 0.05;

    if (driftMetrics.maxDrift > threshold) {
      alerts.push({
        type: 'HIGH_DRIFT',
        severity: 'warning',
        message: `Maximum drift of ${(driftMetrics.maxDrift * 100).toFixed(2)}% exceeds threshold`,
        assets: Object.entries(driftMetrics.driftVector)
          .filter(([_, data]) => data.driftPercent > threshold)
          .map(([asset, _]) => asset)
      });
    }

    if (driftMetrics.averageDrift > threshold * 0.5) {
      alerts.push({
        type: 'AVERAGE_DRIFT',
        severity: 'info',
        message: `Average drift of ${(driftMetrics.averageDrift * 100).toFixed(2)}% requires attention`
      });
    }

    return alerts;
  }

  generateRecommendations(monitoring, strategy) {
    const recommendations = [];

    if (monitoring.driftMetrics.maxDrift > (strategy.thresholds.deviation || 0.05)) {
      recommendations.push({
        type: 'REBALANCE_NOW',
        priority: 'high',
        action: 'Execute rebalancing to bring portfolio back to target weights',
        estimatedCost: 1000 // Mock estimate
      });
    }

    recommendations.push({
      type: 'REVIEW_STRATEGY',
      priority: 'medium',
      action: 'Review rebalancing thresholds based on current market conditions'
    });

    return recommendations;
  }

  async getPortfolioPositions(portfolioId) {
    // Mock positions data
    return [
      { symbol: 'AAPL', shares: 100, costBasis: 150, currentPrice: 175, unrealizedGain: 2500 },
      { symbol: 'MSFT', shares: 80, costBasis: 250, currentPrice: 280, unrealizedGain: 2400 },
      { symbol: 'GOOGL', shares: 50, costBasis: 120, currentPrice: 110, unrealizedGain: -500 }
    ];
  }

  identifyHarvestingOpportunities(positions, taxConfig) {
    return positions
      .filter(position => position.unrealizedGain < 0)
      .map(position => ({
        symbol: position.symbol,
        unrealizedLoss: Math.abs(position.unrealizedGain),
        recommended: Math.abs(position.unrealizedGain) > (taxConfig.minLossThreshold || 1000),
        reason: `Tax loss harvesting opportunity: $${Math.abs(position.unrealizedGain).toFixed(2)}`
      }));
  }

  async executeHarvestTrade(opportunity, taxConfig) {
    return {
      symbol: opportunity.symbol,
      action: 'sell',
      shares: 100, // Mock shares
      realizedLoss: opportunity.unrealizedLoss,
      executedAt: new Date().toISOString(),
      taxBenefit: opportunity.unrealizedLoss * 0.35 // Assuming 35% tax rate
    };
  }

  async calculateTaxBenefits(executedTrades) {
    const totalLoss = executedTrades.reduce((sum, trade) => sum + trade.realizedLoss, 0);
    return {
      totalRealizedLoss: totalLoss,
      estimatedTaxSavings: totalLoss * 0.35,
      tradesCount: executedTrades.length
    };
  }

  identifyWashSaleRisks(executedTrades) {
    return executedTrades.map(trade => ({
      symbol: trade.symbol,
      washSaleRisk: 'medium', // Mock assessment
      recommendation: `Wait 31 days before repurchasing ${trade.symbol} to avoid wash sale rules`
    }));
  }

  shouldTimeBasedRebalance(strategy) {
    const lastRebalance = strategy.lastRebalanceDate || new Date(0);
    const frequency = strategy.frequency || 'monthly';
    const now = new Date();

    switch (frequency) {
      case 'daily':
        return (now - lastRebalance) >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return (now - lastRebalance) >= 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return (now - lastRebalance) >= 30 * 24 * 60 * 60 * 1000;
      case 'quarterly':
        return (now - lastRebalance) >= 90 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  shouldVolatilityRebalance(deviations, strategy) {
    // Simplified volatility-based rebalancing logic
    const targetVolatility = strategy.constraints.targetVolatility || 0.15;
    const currentVolatility = 0.18; // Mock current volatility

    return Math.abs(currentVolatility - targetVolatility) > 0.02; // 2% deviation
  }

  shouldControlDrift(deviations, strategy) {
    const maxAllowedDrift = strategy.thresholds.maxDrift || 0.10;
    return Object.values(deviations).some(dev => dev.absoluteDeviation > maxAllowedDrift);
  }

  getDefaultScenarios() {
    return [
      { name: 'Market Crash', shock: -0.20, probability: 0.05 },
      { name: 'Recession', shock: -0.10, probability: 0.15 },
      { name: 'Bull Market', shock: 0.15, probability: 0.20 },
      { name: 'High Volatility', shock: 0, probability: 0.30 },
      { name: 'Normal Market', shock: 0.05, probability: 0.30 }
    ];
  }

  async testStrategyUnderStress(portfolioId, strategy, scenarios) {
    const results = {};

    for (const scenario of scenarios) {
      const stressedWeights = this.applyStressScenario(strategy.targetWeights, scenario);
      const stressedMetrics = await this.calculateStressedMetrics(stressedWeights, scenario);

      results[scenario.name] = {
        scenario,
        stressedWeights,
        metrics: stressedMetrics,
        performance: stressedMetrics.expectedReturn - 0.08, // Relative to 8% benchmark
        riskAdjustedPerformance: stressedMetrics.sharpeRatio - 1.0 // Relative to 1.0 benchmark
      };
    }

    return {
      worstCase: results[Object.keys(results).reduce((worst, key) =>
        results[key].performance < results[worst].performance ? key : worst
      )],
      bestCase: results[Object.keys(results).reduce((best, key) =>
        results[key].performance > results[best].performance ? key : best
      )],
      averagePerformance: Object.values(results).reduce((sum, r) => sum + r.performance, 0) / Object.keys(results).length,
      scenarioResults: results
    };
  }

  applyStressScenario(weights, scenario) {
    // Apply stress to portfolio weights
    const stressedWeights = { ...weights };

    // Mock stress application - would be more sophisticated in reality
    for (const [asset, weight] of Object.entries(stressedWeights)) {
      stressedWeights[asset] = weight * (1 + scenario.shock * (0.5 + Math.random() * 0.5));
    }

    // Normalize weights
    const totalWeight = Object.values(stressedWeights).reduce((sum, w) => sum + w, 0);
    for (const asset of Object.keys(stressedWeights)) {
      stressedWeights[asset] /= totalWeight;
    }

    return stressedWeights;
  }

  async calculateStressedMetrics(weights, scenario) {
    // Mock stressed metrics calculation
    return {
      expectedReturn: 0.08 * (1 + scenario.shock),
      volatility: 0.15 * (1 + Math.abs(scenario.shock) * 0.5),
      sharpeRatio: (0.08 * (1 + scenario.shock)) / (0.15 * (1 + Math.abs(scenario.shock) * 0.5)),
      maxDrawdown: Math.max(0.05, Math.abs(scenario.shock) * 2),
      var95: 0.05 * (1 + Math.abs(scenario.shock) * 1.5)
    };
  }

  generateStressTestRecommendations(results) {
    const recommendations = [];

    // Find best performing strategy
    const bestStrategy = Object.keys(results).reduce((best, key) =>
      results[key].averagePerformance > results[best].averagePerformance ? key : best
    );

    recommendations.push({
      type: 'STRATEGY_SELECTION',
      recommendation: `Strategy ${bestStrategy} shows best performance under stress scenarios`,
      confidence: 0.8
    });

    // Risk management recommendations
    const worstCasePerformance = Math.min(...Object.values(results).map(r => r.worstCase.performance));
    if (worstCasePerformance < -0.10) {
      recommendations.push({
        type: 'RISK_MANAGEMENT',
        recommendation: 'Consider adding defensive assets to reduce downside risk',
        confidence: 0.9
      });
    }

    return recommendations;
  }

  // Persistence methods

  async persistStrategy(strategy) {
    const key = `${REBALANCING_NAMESPACES.STRATEGIES}:${strategy.id}`;
    await setKVStore(this.env, key, strategy, REBALANCING_TTL.STRATEGY_CACHE);
  }

  async persistRebalancingAnalysis(analysis) {
    const key = `${REBALANCING_NAMESPACES.SCHEDULES}:${analysis.portfolioId}_${Date.now()}`;
    await setKVStore(this.env, key, analysis, REBALANCING_TTL.SCHEDULE_CACHE);
  }

  async persistExecution(execution) {
    const key = `${REBALANCING_NAMESPACES.EXECUTION}:${execution.id}`;
    await setKVStore(this.env, key, execution, REBALANCING_TTL.EXECUTION_CACHE);
  }

  async persistMonitoring(monitoring) {
    const key = `${REBALANCING_NAMESPACES.MONITORING}:${monitoring.portfolioId}_${Date.now()}`;
    await setKVStore(this.env, key, monitoring, REBALANCING_TTL.MONITORING_CACHE);
  }

  async persistTaxHarvesting(harvesting) {
    const key = `${REBALANCING_NAMESPACES.HISTORY}:${harvesting.portfolioId}_${harvesting.harvestingDate}`;
    await setKVStore(this.env, key, harvesting, REBALANCING_TTL.HISTORY_CACHE);
  }

  async persistDynamicAllocation(allocation) {
    const key = `${REBALANCING_NAMESPACES.STRATEGIES}:${allocation.portfolioId}_dynamic_${Date.now()}`;
    await setKVStore(this.env, key, allocation, REBALANCING_TTL.STRATEGY_CACHE);
  }

  async persistStressTest(stressTest) {
    const key = `${REBALANCING_NAMESPACES.ALERTS}:${stressTest.portfolioId}_stress_${Date.now()}`;
    await setKVStore(this.env, key, stressTest, REBALANCING_TTL.ALERT_CACHE);
  }

  async updateStrategyMetrics(strategyId, execution) {
    // Update strategy performance metrics
    // This would involve updating the strategy record with execution results
  }
}

/**
 * Factory function for creating rebalancing engine instances
 */
export function createPortfolioRebalancingEngine(env) {
  return new PortfolioRebalancingEngine(env);
}

/**
 * Utility functions for portfolio rebalancing
 */
export async function createRebalancingStrategy(env, config) {
  const engine = createPortfolioRebalancingEngine(env);
  return await engine.createRebalancingStrategy(config);
}

export async function analyzeRebalancingNeeds(env, portfolioId, currentWeights, targetWeights, strategy) {
  const engine = createPortfolioRebalancingEngine(env);
  return await engine.analyzeRebalancingNeeds(portfolioId, currentWeights, targetWeights, strategy);
}

export async function executeRebalancing(env, analysis, executionConfig) {
  const engine = createPortfolioRebalancingEngine(env);
  return await engine.executeRebalancing(analysis, executionConfig);
}