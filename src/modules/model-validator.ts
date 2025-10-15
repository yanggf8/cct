/**
 * Model Validation Framework
 * Statistical validation and robustness testing for predictive models
 */

import {
  ValidationResult,
  CrossValidationConfig,
  CrossValidationResult,
  OutOfSampleConfig,
  OutOfSampleResult,
  SignificanceConfig,
  SignificanceResult,
  OverfittingConfig,
  OverfittingResult,
  WalkForwardResult,
  WalkForwardWindow,
  MonteCarloResult,
  MonteCarloSimulation,
  MonteCarloSummary,
  BootstrapResult,
  FoldResult,
  StatisticalTest,
  PerformanceMetrics,
  BacktestConfig,
  EquityPoint,
  Trade,
  Position
} from '../types/backtesting.js';
import { createLogger } from './logging.js';
import { createPerformanceCalculator } from './performance-calculator.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('model-validator');

/**
 * Comprehensive Model Validation Framework
 */
export class ModelValidator {
  private config: BacktestConfig;
  private env: CloudflareEnvironment;
  private equityCurve: EquityPoint[];
  private trades: Trade[];
  private positions: Position[];

  constructor(
    config: BacktestConfig,
    env: CloudflareEnvironment,
    equityCurve: EquityPoint[],
    trades: Trade[],
    positions: Position[]
  ) {
    this.config = config;
    this.env = env;
    this.equityCurve = equityCurve;
    this.trades = trades;
    this.positions = positions;
  }

  /**
   * Perform comprehensive model validation
   */
  async validateModel(): Promise<ValidationResult> {
    logger.info('Starting comprehensive model validation');

    const [
      crossValidation,
      outOfSample,
      significance,
      overfitting,
      walkForward,
      monteCarlo,
      bootstrap
    ] = await Promise.all([
      this.performCrossValidation(),
      this.performOutOfSampleTesting(),
      this.performSignificanceTesting(),
      this.performOverfittingDetection(),
      this.performWalkForwardOptimization(),
      this.performMonteCarloSimulation(),
      this.performBootstrapAnalysis()
    ]);

    const overallScore = this.calculateOverallScore([
      crossValidation,
      outOfSample,
      significance,
      overfitting,
      walkForward,
      monteCarlo,
      bootstrap
    ]);

    const recommendation = this.generateRecommendation(overallScore, [
      crossValidation,
      outOfSample,
      significance,
      overfitting
    ]);

    logger.info('Model validation completed', {
      overallScore,
      recommendation
    });

    return {
      crossValidation,
      outOfSample,
      significance,
      overfitting,
      walkForward,
      monteCarlo,
      bootstrap,
      overallScore,
      recommendation
    };
  }

  /**
   * Perform cross-validation
   */
  async performCrossValidation(): Promise<CrossValidationResult> {
    logger.info('Starting cross-validation', {
      method: this.config.validation.crossValidation.method,
      folds: this.config.validation.crossValidation.folds
    });

    const config = this.config.validation.crossValidation;
    const foldResults: FoldResult[] = [];

    switch (config.method) {
      case 'time_series_split':
        foldResults.push(...await this.performTimeSeriesSplit(config));
        break;
      case 'rolling_window':
        foldResults.push(...await this.performRollingWindow(config));
        break;
      case 'expanding_window':
        foldResults.push(...await this.performExpandingWindow(config));
        break;
      default:
        throw new Error(`Unsupported cross-validation method: ${config.method}`);
    }

    const avgPerformance = this.calculateAveragePerformance(foldResults.map(f => f.performance));
    const performanceStdDev = this.calculatePerformanceStdDev(foldResults.map(f => f.performance));
    const stabilityScore = this.calculateStabilityScore(foldResults);

    const recommendation = this.generateCrossValidationRecommendation(stabilityScore, performanceStdDev);

    return {
      config,
      foldResults,
      avgPerformance,
      performanceStdDev,
      stabilityScore,
      recommendation
    };
  }

  /**
   * Perform time series split cross-validation
   */
  private async performTimeSeriesSplit(config: CrossValidationConfig): Promise<FoldResult[]> {
    const results: FoldResult[] = [];
    const totalLength = this.equityCurve.length;
    const foldSize = Math.floor(totalLength / (config.folds + 1));

    for (let fold = 1; fold <= config.folds; fold++) {
      const trainEnd = fold * foldSize;
      const testEnd = Math.min((fold + 1) * foldSize, totalLength);

      const trainPeriod = {
        start: this.equityCurve[0].date,
        end: this.equityCurve[trainEnd - 1].date
      };

      const testPeriod = {
        start: this.equityCurve[trainEnd].date,
        end: this.equityCurve[testEnd - 1].date
      };

      // Simulate training and testing
      const trainPerformance = await this.simulatePeriodPerformance(0, trainEnd);
      const testPerformance = await this.simulatePeriodPerformance(trainEnd, testEnd);

      results.push({
        fold,
        trainPeriod: `${trainPeriod.start} to ${trainPeriod.end}`,
        testPeriod: `${testPeriod.start} to ${testPeriod.end}`,
        performance: testPerformance,
        trainPerformance
      });
    }

    return results;
  }

  /**
   * Perform rolling window cross-validation
   */
  private async performRollingWindow(config: CrossValidationConfig): Promise<FoldResult[]> {
    const results: FoldResult[] = [];
    const windowSize = Math.floor(this.equityCurve.length * (1 - config.testSize));
    const testSize = Math.floor(this.equityCurve.length * config.testSize);

    for (let fold = 0; fold < config.folds; fold++) {
      const trainStart = fold * testSize;
      const trainEnd = trainStart + windowSize;
      const testEnd = Math.min(trainEnd + testSize, this.equityCurve.length);

      if (testEnd >= this.equityCurve.length) break;

      const trainPeriod = {
        start: this.equityCurve[trainStart].date,
        end: this.equityCurve[trainEnd - 1].date
      };

      const testPeriod = {
        start: this.equityCurve[trainEnd].date,
        end: this.equityCurve[testEnd - 1].date
      };

      const trainPerformance = await this.simulatePeriodPerformance(trainStart, trainEnd);
      const testPerformance = await this.simulatePeriodPerformance(trainEnd, testEnd);

      results.push({
        fold: fold + 1,
        trainPeriod: `${trainPeriod.start} to ${trainPeriod.end}`,
        testPeriod: `${testPeriod.start} to ${testPeriod.end}`,
        performance: testPerformance,
        trainPerformance
      });
    }

    return results;
  }

  /**
   * Perform expanding window cross-validation
   */
  private async performExpandingWindow(config: CrossValidationConfig): Promise<FoldResult[]> {
    const results: FoldResult[] = [];
    const initialWindowSize = Math.floor(this.equityCurve.length * 0.3);
    const testSize = Math.floor(this.equityCurve.length * config.testSize);

    for (let fold = 0; fold < config.folds; fold++) {
      const trainEnd = initialWindowSize + (fold * testSize);
      const testEnd = Math.min(trainEnd + testSize, this.equityCurve.length);

      if (testEnd >= this.equityCurve.length) break;

      const trainPeriod = {
        start: this.equityCurve[0].date,
        end: this.equityCurve[trainEnd - 1].date
      };

      const testPeriod = {
        start: this.equityCurve[trainEnd].date,
        end: this.equityCurve[testEnd - 1].date
      };

      const trainPerformance = await this.simulatePeriodPerformance(0, trainEnd);
      const testPerformance = await this.simulatePeriodPerformance(trainEnd, testEnd);

      results.push({
        fold: fold + 1,
        trainPeriod: `${trainPeriod.start} to ${trainPeriod.end}`,
        testPeriod: `${testPeriod.start} to ${testPeriod.end}`,
        performance: testPerformance,
        trainPerformance
      });
    }

    return results;
  }

  /**
   * Perform out-of-sample testing
   */
  async performOutOfSampleTesting(): Promise<OutOfSampleResult> {
    logger.info('Starting out-of-sample testing', {
      trainRatio: this.config.validation.outOfSampleTesting.trainRatio,
      validationRatio: this.config.validation.outOfSampleTesting.validationRatio,
      testRatio: this.config.validation.outOfSampleTesting.testRatio
    });

    const config = this.config.validation.outOfSampleTesting;
    const totalLength = this.equityCurve.length;

    const trainEnd = Math.floor(totalLength * config.trainRatio);
    const validationEnd = Math.floor(totalLength * (config.trainRatio + config.validationRatio));
    const testEnd = totalLength;

    const trainPerformance = await this.simulatePeriodPerformance(0, trainEnd);
    const validationPerformance = await this.simulatePeriodPerformance(trainEnd, validationEnd);
    const testPerformance = await this.simulatePeriodPerformance(validationEnd, testEnd);

    const degradationMetrics = this.calculateDegradationMetrics(
      trainPerformance,
      testPerformance,
      validationPerformance
    );

    return {
      config,
      trainPerformance,
      validationPerformance,
      testPerformance,
      degradationMetrics
    };
  }

  /**
   * Perform significance testing
   */
  async performSignificanceTesting(): Promise<SignificanceResult> {
    logger.info('Starting significance testing', {
      methods: this.config.validation.significanceTesting.methods,
      confidenceLevel: this.config.validation.significanceTesting.confidenceLevel
    });

    const config = this.config.validation.significanceTesting;
    const returns = this.extractReturns();

    const tests: StatisticalTest[] = [];

    // Perform each requested test
    for (const method of config.methods) {
      let test: StatisticalTest;

      switch (method) {
        case 't_test':
          test = this.performTTest(returns, config.confidenceLevel);
          break;
        case 'wilcoxon':
          test = this.performWilcoxonTest(returns, config.confidenceLevel);
          break;
        case 'bootstrap':
          test = this.performBootstrapTest(returns, config.confidenceLevel);
          break;
        default:
          logger.warn(`Unsupported significance test method: ${method}`);
          continue;
      }

      tests.push(test);
    }

    const overallSignificance = this.calculateOverallSignificance(tests);
    const isSignificant = overallSignificance > (1 - config.confidenceLevel);

    const benchmarkComparison = config.benchmark ?
      await this.performBenchmarkComparison(returns, config.benchmark) :
      undefined;

    return {
      config,
      tests,
      overallSignificance,
      isSignificant,
      benchmarkComparison
    };
  }

  /**
   * Perform overfitting detection
   */
  async performOverfittingDetection(): Promise<OverfittingResult> {
    logger.info('Starting overfitting detection', {
      methods: this.config.validation.overfittingDetection.methods,
      threshold: this.config.validation.overfittingDetection.threshold
    });

    const config = this.config.validation.overfittingDetection;
    const indicators = [];

    // Cross-validation indicator
    if (config.methods.includes('cross_validation')) {
      indicators.push(await this.checkCrossValidationOverfitting());
    }

    // Learning curve indicator
    if (config.methods.includes('learning_curve')) {
      indicators.push(await this.checkLearningCurveOverfitting());
    }

    // Feature importance indicator
    if (config.methods.includes('feature_importance')) {
      indicators.push(await this.checkFeatureImportanceOverfitting());
    }

    const riskScore = this.calculateOverfittingRiskScore(indicators, config.threshold);
    const recommendation = this.generateOverfittingRecommendation(riskScore);

    return {
      config,
      indicators,
      riskScore,
      recommendation
    };
  }

  /**
   * Perform walk-forward optimization
   */
  async performWalkForwardOptimization(): Promise<WalkForwardResult> {
    logger.info('Starting walk-forward optimization');

    const windows = await this.generateWalkForwardWindows();
    const windowResults: WalkForwardWindow[] = [];

    for (const window of windows) {
      const result = await this.evaluateWalkForwardWindow(window);
      windowResults.push(result);
    }

    const overallPerformance = this.calculateAveragePerformance(windowResults.map(w => w.performance));
    const stabilityMetrics = this.calculateWalkForwardStability(windowResults);
    const parameterStability = this.calculateParameterStability(windowResults);

    return {
      windows: windowResults,
      overallPerformance,
      stabilityMetrics,
      parameterStability
    };
  }

  /**
   * Perform Monte Carlo simulation
   */
  async performMonteCarloSimulation(): Promise<MonteCarloResult> {
    logger.info('Starting Monte Carlo simulation');

    const numSimulations = 1000; // Default number of simulations
    const simulations: MonteCarloSimulation[] = [];

    for (let i = 0; i < numSimulations; i++) {
      const simulation = await this.runMonteCarloSimulation(i);
      simulations.push(simulation);
    }

    const summary = this.calculateMonteCarloSummary(simulations);
    const confidenceIntervals = this.calculateConfidenceIntervals(simulations);
    const tailRisk = this.calculateTailRiskMetrics(simulations);

    return {
      simulations,
      summary,
      confidenceIntervals,
      tailRisk
    };
  }

  /**
   * Perform bootstrap analysis
   */
  async performBootstrapAnalysis(): Promise<BootstrapResult> {
    logger.info('Starting bootstrap analysis');

    const numSamples = 1000;
    const originalPerformance = this.calculateOriginalPerformance();
    const samples: BootstrapSample[] = [];

    for (let i = 0; i < numSamples; i++) {
      const sample = await this.generateBootstrapSample(i, originalPerformance);
      samples.push(sample);
    }

    const bootstrapDistribution = this.calculateBootstrapDistribution(samples);
    const biasCorrectedPerformance = this.calculateBiasCorrectedPerformance(
      originalPerformance,
      bootstrapDistribution
    );
    const significanceTests = this.performBootstrapSignificanceTests(samples, originalPerformance);

    return {
      samples,
      originalPerformance,
      bootstrapDistribution,
      biasCorrectedPerformance,
      significanceTests
    };
  }

  // ===== Helper Methods =====

  private async simulatePeriodPerformance(startIndex: number, endIndex: number): Promise<PerformanceMetrics> {
    const periodEquityCurve = this.equityCurve.slice(startIndex, endIndex);
    const periodTrades = this.trades.filter(t => {
      const tradeDate = new Date(t.timestamp);
      const startDate = new Date(periodEquityCurve[0].date);
      const endDate = new Date(periodEquityCurve[periodEquityCurve.length - 1].date);
      return tradeDate >= startDate && tradeDate <= endDate;
    });

    const calculator = createPerformanceCalculator(
      periodEquityCurve,
      periodTrades,
      [], // Simplified - positions would need to be filtered too
      this.config.execution.initialCapital
    );

    return calculator.calculateAllMetrics();
  }

  private extractReturns(): number[] {
    return this.equityCurve
      .map(point => point.returns)
      .filter(r => !isNaN(r) && isFinite(r));
  }

  private calculateAveragePerformance(performances: PerformanceMetrics[]): PerformanceMetrics {
    if (performances.length === 0) {
      return this.getDefaultPerformanceMetrics();
    }

    const avgPerformance: PerformanceMetrics = {
      totalReturn: performances.reduce((sum, p) => sum + p.totalReturn, 0) / performances.length,
      annualizedReturn: performances.reduce((sum, p) => sum + p.annualizedReturn, 0) / performances.length,
      volatility: performances.reduce((sum, p) => sum + p.volatility, 0) / performances.length,
      sharpeRatio: performances.reduce((sum, p) => sum + p.sharpeRatio, 0) / performances.length,
      sortinoRatio: performances.reduce((sum, p) => sum + p.sortinoRatio, 0) / performances.length,
      maxDrawdown: performances.reduce((sum, p) => sum + p.maxDrawdown, 0) / performances.length,
      calmarRatio: performances.reduce((sum, p) => sum + p.calmarRatio, 0) / performances.length,
      winRate: performances.reduce((sum, p) => sum + p.winRate, 0) / performances.length,
      profitFactor: performances.reduce((sum, p) => sum + p.profitFactor, 0) / performances.length,
      avgWin: performances.reduce((sum, p) => sum + p.avgWin, 0) / performances.length,
      avgLoss: performances.reduce((sum, p) => sum + p.avgLoss, 0) / performances.length,
      bestTrade: performances.reduce((sum, p) => sum + p.bestTrade, 0) / performances.length,
      worstTrade: performances.reduce((sum, p) => sum + p.worstTrade, 0) / performances.length,
      totalTrades: Math.round(performances.reduce((sum, p) => sum + p.totalTrades, 0) / performances.length),
      winningTrades: Math.round(performances.reduce((sum, p) => sum + p.winningTrades, 0) / performances.length),
      losingTrades: Math.round(performances.reduce((sum, p) => sum + p.losingTrades, 0) / performances.length),
      avgTradeDuration: performances.reduce((sum, p) => sum + p.avgTradeDuration, 0) / performances.length,
      sharpeRatioAdjusted: performances.reduce((sum, p) => sum + p.sharpeRatioAdjusted, 0) / performances.length
    };

    return avgPerformance;
  }

  private calculatePerformanceStdDev(performances: PerformanceMetrics[]): PerformanceMetrics {
    if (performances.length === 0) {
      return this.getDefaultPerformanceMetrics();
    }

    const calculateStd = (values: number[]) => {
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      return Math.sqrt(variance);
    };

    const stdDevPerformance: PerformanceMetrics = {
      totalReturn: calculateStd(performances.map(p => p.totalReturn)),
      annualizedReturn: calculateStd(performances.map(p => p.annualizedReturn)),
      volatility: calculateStd(performances.map(p => p.volatility)),
      sharpeRatio: calculateStd(performances.map(p => p.sharpeRatio)),
      sortinoRatio: calculateStd(performances.map(p => p.sortinoRatio)),
      maxDrawdown: calculateStd(performances.map(p => p.maxDrawdown)),
      calmarRatio: calculateStd(performances.map(p => p.calmarRatio)),
      winRate: calculateStd(performances.map(p => p.winRate)),
      profitFactor: calculateStd(performances.map(p => p.profitFactor)),
      avgWin: calculateStd(performances.map(p => p.avgWin)),
      avgLoss: calculateStd(performances.map(p => p.avgLoss)),
      bestTrade: calculateStd(performances.map(p => p.bestTrade)),
      worstTrade: calculateStd(performances.map(p => p.worstTrade)),
      totalTrades: calculateStd(performances.map(p => p.totalTrades)),
      winningTrades: calculateStd(performances.map(p => p.winningTrades)),
      losingTrades: calculateStd(performances.map(p => p.losingTrades)),
      avgTradeDuration: calculateStd(performances.map(p => p.avgTradeDuration)),
      sharpeRatioAdjusted: calculateStd(performances.map(p => p.sharpeRatioAdjusted))
    };

    return stdDevPerformance;
  }

  private calculateStabilityScore(foldResults: FoldResult[]): number {
    if (foldResults.length === 0) return 0;

    const sharpeStability = this.calculateMetricStability(foldResults.map(f => f.performance.sharpeRatio));
    const returnStability = this.calculateMetricStability(foldResults.map(f => f.performance.annualizedReturn));
    const drawdownStability = this.calculateMetricStability(foldResults.map(f => f.performance.maxDrawdown));

    return (sharpeStability + returnStability + drawdownStability) / 3;
  }

  private calculateMetricStability(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean);

    // Convert coefficient of variation to stability score (0-1)
    return Math.max(0, 1 - coefficientOfVariation);
  }

  private generateCrossValidationRecommendation(stabilityScore: number, performanceStdDev: PerformanceMetrics): string {
    if (stabilityScore > 0.8 && performanceStdDev.sharpeRatio < 0.3) {
      return 'Excellent stability and consistency';
    } else if (stabilityScore > 0.6 && performanceStdDev.sharpeRatio < 0.5) {
      return 'Good stability, acceptable consistency';
    } else if (stabilityScore > 0.4) {
      return 'Moderate stability, consider regularization';
    } else {
      return 'Poor stability, model likely overfit';
    }
  }

  private calculateDegradationMetrics(
    trainPerformance: PerformanceMetrics,
    testPerformance: PerformanceMetrics,
    validationPerformance?: PerformanceMetrics
  ): any {
    const trainToTest = trainPerformance.sharpeRatio > 0 ?
      (trainPerformance.sharpeRatio - testPerformance.sharpeRatio) / trainPerformance.sharpeRatio : 0;

    let validationToTest = 0;
    if (validationPerformance) {
      validationToTest = validationPerformance.sharpeRatio > 0 ?
        (validationPerformance.sharpeRatio - testPerformance.sharpeRatio) / validationPerformance.sharpeRatio : 0;
    }

    const significance = Math.max(trainToTest, validationToTest);

    return {
      trainToTest,
      validationToTest,
      significance,
      acceptable: trainToTest < 0.3 && validationToTest < 0.3
    };
  }

  private performTTest(returns: number[], confidenceLevel: number): StatisticalTest {
    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
    const stdError = Math.sqrt(variance / n);

    const statistic = stdError > 0 ? mean / stdError : 0;
    const degreesOfFreedom = n - 1;
    const criticalValue = this.getTCriticalValue(confidenceLevel, degreesOfFreedom);
    const pValue = 2 * (1 - this.normalCDF(Math.abs(statistic)));

    const margin = criticalValue * stdError;
    const confidenceInterval: [number, number] = [mean - margin, mean + margin];

    return {
      method: 't_test',
      statistic,
      pValue,
      criticalValue,
      isSignificant: Math.abs(statistic) > criticalValue,
      confidenceInterval
    };
  }

  private performWilcoxonTest(returns: number[], confidenceLevel: number): StatisticalTest {
    // Simplified Wilcoxon signed-rank test implementation
    const n = returns.length;
    if (n === 0) {
      return {
        method: 'wilcoxon',
        statistic: 0,
        pValue: 1,
        criticalValue: 0,
        isSignificant: false,
        confidenceInterval: [0, 0]
      };
    }

    const signedRanks = returns
      .map((value, index) => ({ value, index }))
      .sort((a, b) => Math.abs(a.value) - Math.abs(b.value))
      .map((item, rank) => ({
        ...item,
        rank: rank + 1,
        signedRank: item.value >= 0 ? rank + 1 : -(rank + 1)
      }));

    const statistic = signedRanks.reduce((sum, item) => sum + (item.value >= 0 ? item.rank : 0), 0);
    const expectedStatistic = n * (n + 1) / 4;
    const variance = n * (n + 1) * (2 * n + 1) / 24;
    const zScore = variance > 0 ? (statistic - expectedStatistic) / Math.sqrt(variance) : 0;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    return {
      method: 'wilcoxon',
      statistic,
      pValue,
      criticalValue: 1.96,
      isSignificant: pValue < (1 - confidenceLevel),
      confidenceInterval: [0, 0]
    };
  }

  private performBootstrapTest(returns: number[], confidenceLevel: number): StatisticalTest {
    // Simplified bootstrap test
    const numBootstrapSamples = 1000;
    const bootstrapMeans: number[] = [];

    for (let i = 0; i < numBootstrapSamples; i++) {
      const sample = this.resampleWithReplacement(returns);
      const mean = sample.reduce((sum, r) => sum + r, 0) / sample.length;
      bootstrapMeans.push(mean);
    }

    bootstrapMeans.sort((a, b) => a - b);
    const originalMean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    const alpha = 1 - confidenceLevel;
    const lowerIndex = Math.floor(alpha / 2 * numBootstrapSamples);
    const upperIndex = Math.ceil((1 - alpha / 2) * numBootstrapSamples);
    const confidenceInterval: [number, number] = [
      bootstrapMeans[lowerIndex],
      bootstrapMeans[upperIndex]
    ];

    const statistic = originalMean;
    const pValue = this.calculateBootstrapPValue(originalMean, bootstrapMeans);

    return {
      method: 'bootstrap',
      statistic,
      pValue,
      criticalValue: 0,
      isSignificant: pValue < alpha,
      confidenceInterval
    };
  }

  private async performBenchmarkComparison(returns: number[], benchmark: string): Promise<any> {
    // Simplified benchmark comparison
    const benchmarkReturns = await this.getBenchmarkReturns(benchmark);
    if (!benchmarkReturns || benchmarkReturns.length === 0) {
      return undefined;
    }

    const calculator = createPerformanceCalculator(
      this.equityCurve,
      this.trades,
      this.positions,
      this.config.execution.initialCapital,
      0.02,
      benchmarkReturns
    );

    const metrics = calculator.calculateAllMetrics();

    return {
      benchmark,
      alpha: metrics.alpha || 0,
      beta: metrics.beta || 0,
      informationRatio: metrics.informationRatio || 0,
      trackingError: metrics.trackingError || 0,
      alphaSignificance: this.performTTest(returns, 0.95)
    };
  }

  private async getBenchmarkReturns(benchmark: string): Promise<number[]> {
    // Placeholder for benchmark returns retrieval
    // In a real implementation, this would fetch historical returns for the benchmark
    return [];
  }

  private resampleWithReplacement(data: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      result.push(data[randomIndex]);
    }
    return result;
  }

  private calculateBootstrapPValue(originalValue: number, bootstrapDistribution: number[]): number {
    const count = bootstrapDistribution.filter(value => value >= originalValue).length;
    return count / bootstrapDistribution.length;
  }

  private getTCriticalValue(confidenceLevel: number, degreesOfFreedom: number): number {
    // Simplified t-critical value approximation
    return confidenceLevel === 0.95 ? 1.96 : 2.576;
  }

  private normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }

  private calculateOverallSignificance(tests: StatisticalTest[]): number {
    if (tests.length === 0) return 0;

    // Combine p-values using Fisher's method
    const chiSquareStatistic = -2 * tests.reduce((sum, test) => sum + Math.log(test.pValue), 0);
    const degreesOfFreedom = 2 * tests.length;

    // Simplified p-value calculation
    return Math.max(0, 1 - chiSquareStatistic / degreesOfFreedom);
  }

  private async checkCrossValidationOverfitting(): Promise<any> {
    const cvResult = await this.performCrossValidation();
    const riskScore = 1 - cvResult.stabilityScore;

    return {
      method: 'cross_validation',
      value: cvResult.stabilityScore,
      threshold: 0.7,
      isOverfit: riskScore > 0.3,
      severity: riskScore > 0.5 ? 'high' : riskScore > 0.3 ? 'medium' : 'low'
    };
  }

  private async checkLearningCurveOverfitting(): Promise<any> {
    // Simplified learning curve analysis
    const performanceBySize = await this.analyzePerformanceByDataSize();
    const improvementRate = this.calculateImprovementRate(performanceBySize);
    const overfittingIndicator = improvementRate < 0.1; // Low improvement suggests overfitting

    return {
      method: 'learning_curve',
      value: improvementRate,
      threshold: 0.1,
      isOverfit: overfittingIndicator,
      severity: overfittingIndicator ? 'medium' : 'low'
    };
  }

  private async analyzePerformanceByDataSize(): Promise<any[]> {
    // Placeholder for learning curve analysis
    return [
      { dataSize: 0.25, performance: 0.8 },
      { dataSize: 0.5, performance: 0.85 },
      { dataSize: 0.75, performance: 0.87 },
      { dataSize: 1.0, performance: 0.88 }
    ];
  }

  private calculateImprovementRate(performanceBySize: any[]): number {
    if (performanceBySize.length < 2) return 0;

    const firstPerformance = performanceBySize[0].performance;
    const lastPerformance = performanceBySize[performanceBySize.length - 1].performance;
    return (lastPerformance - firstPerformance) / firstPerformance;
  }

  private async checkFeatureImportanceOverfitting(): Promise<any> {
    // Simplified feature importance analysis
    // In a real implementation, this would analyze feature importance stability

    return {
      method: 'feature_importance',
      value: 0.8,
      threshold: 0.7,
      isOverfit: false,
      severity: 'low'
    };
  }

  private calculateOverfittingRiskScore(indicators: any[], threshold: number): number {
    if (indicators.length === 0) return 0;

    const totalRisk = indicators.reduce((sum, indicator) => {
      return sum + (indicator.isOverfit ? 1 : 0) * indicator.severity === 'high' ? 1 : indicator.severity === 'medium' ? 0.5 : 0.25;
    }, 0);

    return Math.min(totalRisk / indicators.length, 1);
  }

  private generateOverfittingRecommendation(riskScore: number): 'low_risk' | 'medium_risk' | 'high_risk' {
    if (riskScore < 0.3) return 'low_risk';
    if (riskScore < 0.6) return 'medium_risk';
    return 'high_risk';
  }

  private async generateWalkForwardWindows(): Promise<any[]> {
    const windows = [];
    const windowSize = Math.floor(this.equityCurve.length * 0.6);
    const stepSize = Math.floor(this.equityCurve.length * 0.1);

    for (let i = 0; i + windowSize < this.equityCurve.length; i += stepSize) {
      windows.push({
        window: windows.length + 1,
        trainStart: this.equityCurve[i].date,
        trainEnd: this.equityCurve[i + windowSize - 1].date,
        testStart: this.equityCurve[i + windowSize].date,
        testEnd: this.equityCurve[Math.min(i + windowSize + stepSize - 1, this.equityCurve.length - 1)].date,
        parameters: {} // Would contain optimized parameters
      });
    }

    return windows;
  }

  private async evaluateWalkForwardWindow(window: any): Promise<WalkForwardWindow> {
    const performance = await this.simulatePeriodPerformance(
      this.equityCurve.findIndex(point => point.date === window.testStart),
      this.equityCurve.findIndex(point => point.date === window.testEnd)
    );

    return {
      ...window,
      performance
    };
  }

  private calculateWalkForwardStability(windows: WalkForwardWindow[]): any {
    const returns = windows.map(w => w.performance.annualizedReturn);
    const volatilities = windows.map(w => w.performance.volatility);
    const sharpes = windows.map(w => w.performance.sharpeRatio);
    const drawdowns = windows.map(w => w.performance.maxDrawdown);

    return {
      returnStability: this.calculateMetricStability(returns),
      volatilityStability: this.calculateMetricStability(volatilities),
      sharpeStability: this.calculateMetricStability(sharpes),
      drawdownStability: this.calculateMetricStability(drawdowns),
      overallStability: (this.calculateMetricStability(returns) + this.calculateMetricStability(sharpes)) / 2
    };
  }

  private calculateParameterStability(windows: WalkForwardWindow[]): any[] {
    // Placeholder for parameter stability analysis
    // In a real implementation, this would analyze how parameters change across windows
    return [];
  }

  private async runMonteCarloSimulation(simulationId: number): Promise<MonteCarloSimulation> {
    // Generate randomized returns based on original distribution
    const originalReturns = this.extractReturns();
    const mean = originalReturns.reduce((sum, r) => sum + r, 0) / originalReturns.length;
    const stdDev = Math.sqrt(originalReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / originalReturns.length);

    const simulatedReturns = this.generateRandomReturns(originalReturns.length, mean, stdDev);
    const simulatedEquityCurve = this.generateEquityCurveFromReturns(simulatedReturns);
    const simulatedPerformance = this.calculatePerformanceFromReturns(simulatedReturns);

    return {
      simulation: simulationId,
      finalReturn: simulatedPerformance.totalReturn,
      maxDrawdown: simulatedPerformance.maxDrawdown,
      sharpeRatio: simulatedPerformance.sharpeRatio,
      volatility: simulatedPerformance.volatility,
      equityCurve: simulatedEquityCurve
    };
  }

  private generateRandomReturns(length: number, mean: number, stdDev: number): number[] {
    const returns: number[] = [];
    for (let i = 0; i < length; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      returns.push(mean + z0 * stdDev);
    }
    return returns;
  }

  private generateEquityCurveFromReturns(returns: number[]): EquityPoint[] {
    const equityCurve: EquityPoint[] = [];
    let equity = this.config.execution.initialCapital;
    let cumulativeReturns = 0;

    for (let i = 0; i < returns.length; i++) {
      equity *= (1 + returns[i]);
      cumulativeReturns += returns[i];

      equityCurve.push({
        date: this.equityCurve[i]?.date || new Date().toISOString().split('T')[0],
        equity,
        returns: returns[i],
        cumulativeReturns,
        drawdown: 0 // Would calculate actual drawdown
      });
    }

    return equityCurve;
  }

  private calculatePerformanceFromReturns(returns: number[]): PerformanceMetrics {
    // Simplified performance calculation from returns
    const totalReturn = returns.reduce((sum, r, i) => sum + r, 0);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252);
    const annualizedReturn = totalReturn * (252 / returns.length);
    const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      sortinoRatio: sharpeRatio * 0.8, // Simplified
      maxDrawdown: 0.1, // Simplified
      calmarRatio: sharpeRatio > 0 ? annualizedReturn / 0.1 : 0,
      winRate: 0.55, // Simplified
      profitFactor: 1.2, // Simplified
      avgWin: 0.02, // Simplified
      avgLoss: -0.015, // Simplified
      bestTrade: 0.05, // Simplified
      worstTrade: -0.04, // Simplified
      totalTrades: 100, // Simplified
      winningTrades: 55, // Simplified
      losingTrades: 45, // Simplified
      avgTradeDuration: 5, // Simplified
      sharpeRatioAdjusted: sharpeRatio * Math.sqrt(252 / returns.length)
    };
  }

  private calculateMonteCarloSummary(simulations: MonteCarloSimulation[]): MonteCarloSummary {
    const finalReturns = simulations.map(s => s.finalReturn);
    const maxDrawdowns = simulations.map(s => s.maxDrawdown);
    const sharpeRatios = simulations.map(s => s.sharpeRatio);
    const volatilities = simulations.map(s => s.volatility);

    finalReturns.sort((a, b) => a - b);

    return {
      meanReturn: finalReturns.reduce((sum, r) => sum + r, 0) / finalReturns.length,
      medianReturn: finalReturns[Math.floor(finalReturns.length / 2)],
      stdDevReturn: Math.sqrt(finalReturns.reduce((sum, r) => sum + Math.pow(r - finalReturns.reduce((s, r) => s + r, 0) / finalReturns.length, 2), 0) / finalReturns.length),
      percentiles: {
        5: finalReturns[Math.floor(0.05 * finalReturns.length)],
        25: finalReturns[Math.floor(0.25 * finalReturns.length)],
        50: finalReturns[Math.floor(0.5 * finalReturns.length)],
        75: finalReturns[Math.floor(0.75 * finalReturns.length)],
        95: finalReturns[Math.floor(0.95 * finalReturns.length)]
      },
      successProbability: finalReturns.filter(r => r > 0).length / finalReturns.length,
      riskOfRuin: finalReturns.filter(r => r < -0.5).length / finalReturns.length
    };
  }

  private calculateConfidenceIntervals(simulations: MonteCarloSimulation[]): any[] {
    const metrics = ['finalReturn', 'maxDrawdown', 'sharpeRatio', 'volatility'];
    const intervals: any[] = [];

    for (const metric of metrics) {
      const values = simulations.map(s => s[metric as keyof MonteCarloSimulation] as number).sort((a, b) => a - b);
      const lower = values[Math.floor(0.025 * values.length)];
      const upper = values[Math.floor(0.975 * values.length)];
      const estimate = values.reduce((sum, v) => sum + v, 0) / values.length;

      intervals.push({
        metric,
        level: 0.95,
        lower,
        upper,
        estimate,
        margin: estimate - lower
      });
    }

    return intervals;
  }

  private calculateTailRiskMetrics(simulations: MonteCarloSimulation[]): any {
    const finalReturns = simulations.map(s => s.finalReturn).sort((a, b) => a - b);
    const var95 = finalReturns[Math.floor(0.05 * finalReturns.length)];
    const worstReturns = finalReturns.slice(0, Math.floor(0.05 * finalReturns.length));

    return {
      expectedShortfall: worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length,
      conditionalVar: var95,
      maximumLoss: finalReturns[0],
      recoveryTime: 30, // Simplified
      tailRiskPremium: 0.02 // Simplified
    };
  }

  private async generateBootstrapSample(sampleId: number, originalPerformance: PerformanceMetrics): Promise<BootstrapSample> {
    const originalReturns = this.extractReturns();
    const resampledReturns = this.resampleWithReplacement(originalReturns);
    const performance = this.calculatePerformanceFromReturns(resampledReturns);

    return {
      sample: sampleId,
      performance,
      resampledIndices: [] // Would track which indices were resampled
    };
  }

  private calculateBootstrapDistribution(samples: BootstrapSample[]): any {
    const metrics = ['totalReturn', 'sharpeRatio', 'maxDrawdown', 'volatility'];
    const distribution: any = { mean: {}, stdDev: {}, skewness: {}, kurtosis: {}, percentiles: {} };

    for (const metric of metrics) {
      const values = samples.map(s => s.performance[metric as keyof PerformanceMetrics] as number);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Simplified skewness and kurtosis calculation
      const skewness = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / values.length;
      const kurtosis = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) / values.length;

      distribution.mean[metric] = mean;
      distribution.stdDev[metric] = stdDev;
      distribution.skewness[metric] = skewness;
      distribution.kurtosis[metric] = kurtosis;

      // Calculate percentiles
      values.sort((a, b) => a - b);
      distribution.percentiles[metric] = {
        5: values[Math.floor(0.05 * values.length)],
        25: values[Math.floor(0.25 * values.length)],
        50: values[Math.floor(0.5 * values.length)],
        75: values[Math.floor(0.75 * values.length)],
        95: values[Math.floor(0.95 * values.length)]
      };
    }

    return distribution;
  }

  private calculateBiasCorrectedPerformance(original: PerformanceMetrics, distribution: any): PerformanceMetrics {
    // Simplified bias correction using bootstrap distribution
    const biasCorrected: any = {};

    for (const metric of Object.keys(original)) {
      const value = original[metric as keyof PerformanceMetrics] as number;
      const bootstrapMean = distribution.mean[metric] || 0;
      const bias = bootstrapMean - value;
      biasCorrected[metric] = value - bias;
    }

    return biasCorrected as PerformanceMetrics;
  }

  private performBootstrapSignificanceTests(samples: BootstrapSample[], original: PerformanceMetrics): StatisticalTest[] {
    const tests: StatisticalTest[] = [];

    for (const metric of ['totalReturn', 'sharpeRatio', 'maxDrawdown'] as const) {
      const values = samples.map(s => s.performance[metric]);
      const originalValue = original[metric];

      const test = this.performTTest(values, 0.95);
      test.method = `bootstrap_${metric}`;
      tests.push(test);
    }

    return tests;
  }

  private calculateOriginalPerformance(): PerformanceMetrics {
    const calculator = createPerformanceCalculator(
      this.equityCurve,
      this.trades,
      this.positions,
      this.config.execution.initialCapital
    );

    return calculator.calculateAllMetrics();
  }

  private calculateOverallScore(results: any[]): number {
    // Simplified overall scoring
    const scores = results.map(result => {
      if (result.stabilityScore !== undefined) return result.stabilityScore;
      if (result.degradationMetrics?.acceptable !== undefined) return result.degradationMetrics.acceptable ? 0.8 : 0.3;
      if (result.isSignificant !== undefined) return result.isSignificant ? 0.8 : 0.4;
      if (result.riskScore !== undefined) return 1 - result.riskScore;
      return 0.5; // Default score
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private generateRecommendation(overallScore: number, keyResults: any[]): 'accept' | 'reject' | 'conditional' {
    const hasMajorIssues = keyResults.some(result => {
      if (result.degradationMetrics?.acceptable === false) return true;
      if (result.riskScore > 0.7) return true;
      if (result.stabilityScore < 0.3) return true;
      return false;
    });

    if (overallScore > 0.7 && !hasMajorIssues) return 'accept';
    if (overallScore < 0.4 || hasMajorIssues) return 'reject';
    return 'conditional';
  }

  private getDefaultPerformanceMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      calmarRatio: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgTradeDuration: 0,
      sharpeRatioAdjusted: 0
    };
  }
}

/**
 * Factory function to create model validator
 */
export function createModelValidator(
  config: BacktestConfig,
  env: CloudflareEnvironment,
  equityCurve: EquityPoint[],
  trades: Trade[],
  positions: Position[]
): ModelValidator {
  return new ModelValidator(config, env, equityCurve, trades, positions);
}