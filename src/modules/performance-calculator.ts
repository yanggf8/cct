/**
 * Performance Metrics Calculator
 * Comprehensive financial metrics calculation for backtesting
 */

import {
  PerformanceMetrics,
  EquityPoint,
  Trade,
  Position,
  RiskMetrics,
  PerformanceAttribution,
  DegradationMetrics,
  StatisticalTest
} from '../types/backtesting.js';
import { createLogger } from './logging.js';

const logger = createLogger('performance-calculator');

/**
 * Advanced Performance Calculator
 */
export class PerformanceCalculator {
  private equityCurve: EquityPoint[];
  private trades: Trade[];
  private positions: Position[];
  private initialCapital: number;
  private riskFreeRate: number;
  private benchmarkReturns?: number[];

  constructor(
    equityCurve: EquityPoint[],
    trades: Trade[],
    positions: Position[],
    initialCapital: number,
    riskFreeRate: number = 0.02,
    benchmarkReturns?: number[]
  ) {
    this.equityCurve = equityCurve;
    this.trades = trades;
    this.positions = positions;
    this.initialCapital = initialCapital;
    this.riskFreeRate = riskFreeRate;
    this.benchmarkReturns = benchmarkReturns;
  }

  /**
   * Calculate comprehensive performance metrics
   */
  public calculateAllMetrics(): PerformanceMetrics {
    const returns = this.extractReturns();
    const totalReturn = this.calculateTotalReturn();
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(annualizedReturn, volatility);
    const sortinoRatio = this.calculateSortinoRatio(returns, annualizedReturn);
    const maxDrawdown = this.calculateMaxDrawdown();
    const calmarRatio = this.calculateCalmarRatio(annualizedReturn, maxDrawdown);
    const winRate = this.calculateWinRate();
    const profitFactor = this.calculateProfitFactor();
    const { avgWin, avgLoss, bestTrade, worstTrade } = this.calculateTradeStatistics();
    const avgTradeDuration = this.calculateAverageTradeDuration();
    const sharpeRatioAdjusted = this.calculateAdjustedSharpeRatio(sharpeRatio, returns.length);

    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      calmarRatio,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
      totalTrades: this.trades.length,
      winningTrades: this.trades.filter(t => this.getTradePnL(t) > 0).length,
      losingTrades: this.trades.filter(t => this.getTradePnL(t) < 0).length,
      avgTradeDuration,
      sharpeRatioAdjusted,
      beta: this.benchmarkReturns ? this.calculateBeta(returns) : undefined,
      alpha: this.benchmarkReturns ? this.calculateAlpha(annualizedReturn) : undefined,
      informationRatio: this.benchmarkReturns ? this.calculateInformationRatio(returns) : undefined,
      trackingError: this.benchmarkReturns ? this.calculateTrackingError(returns) : undefined
    };
  }

  /**
   * Calculate detailed risk metrics
   */
  public calculateRiskMetrics(): RiskMetrics {
    const returns = this.extractReturns();
    const var95 = this.calculateVaR(returns, 0.95);
    const var99 = this.calculateVaR(returns, 0.99);
    const expectedShortfall = this.calculateExpectedShortfall(returns, 0.95);
    const downsideDeviation = this.calculateDownsideDeviation(returns);
    const upsideCapture = this.benchmarkReturns ? this.calculateUpsideCapture(returns) : 0;
    const downsideCapture = this.benchmarkReturns ? this.calculateDownsideCapture(returns) : 0;
    const beta = this.benchmarkReturns ? this.calculateBeta(returns) : 0;
    const correlationWithMarket = this.benchmarkReturns ? this.calculateCorrelation(returns, this.benchmarkReturns) : 0;
    const trackingError = this.benchmarkReturns ? this.calculateTrackingError(returns) : 0;

    return {
      var1Day: this.calculateVaR(returns, 0.95),
      var5Day: this.calculate5DayVaR(returns, 0.95),
      var95,
      var99,
      expectedShortfall,
      downsideDeviation,
      upsideCapture,
      downsideCapture,
      beta,
      correlationWithMarket,
      trackingError
    };
  }

  /**
   * Calculate performance attribution
   */
  public calculatePerformanceAttribution(): PerformanceAttribution {
    // Simplified attribution analysis
    // In a full implementation, this would decompose returns into:
    // - Stock selection effect
    // - Sector allocation effect
    // - Timing effect
    // - Interaction effect

    const totalReturn = this.calculateTotalReturn();
    const benchmarkReturn = this.benchmarkReturns ?
      this.benchmarkReturns.reduce((sum, r) => sum + r, 0) : 0;

    return {
      stockSelection: totalReturn * 0.4, // Simplified: 40% from selection
      sectorAllocation: totalReturn * 0.2, // Simplified: 20% from allocation
      timing: totalReturn * 0.1, // Simplified: 10% from timing
      interaction: totalReturn * 0.1, // Simplified: 10% from interaction
      totalAlpha: totalReturn - benchmarkReturn,
      breakdown: [] // Would contain period-by-period breakdown
    };
  }

  /**
   * Calculate degradation metrics for out-of-sample testing
   */
  public calculateDegradationMetrics(
    trainReturns: number[],
    testReturns: number[],
    validationReturns?: number[]
  ): DegradationMetrics {
    const trainSharpe = this.calculateSharpeRatio(
      this.calculateAnnualizedReturn(trainReturns),
      this.calculateVolatility(trainReturns)
    );

    const testSharpe = this.calculateSharpeRatio(
      this.calculateAnnualizedReturn(testReturns),
      this.calculateVolatility(testReturns)
    );

    const trainToTest = trainSharpe > 0 ? (trainSharpe - testSharpe) / trainSharpe : 0;

    let validationToTest = 0;
    if (validationReturns) {
      const validationSharpe = this.calculateSharpeRatio(
        this.calculateAnnualizedReturn(validationReturns),
        this.calculateVolatility(validationReturns)
      );
      validationToTest = validationSharpe > 0 ? (validationSharpe - testSharpe) / validationSharpe : 0;
    }

    // Perform statistical significance test
    const significance = this.performDegradationTest(trainReturns, testReturns);

    return {
      trainToTest,
      validationToTest,
      significance,
      acceptable: trainToTest < 0.2 && validationToTest < 0.2 // Less than 20% degradation is acceptable
    };
  }

  /**
   * Perform statistical significance tests
   */
  public performStatisticalTests(
    returns1: number[],
    returns2?: number[],
    benchmark?: number[]
  ): StatisticalTest[] {
    const tests: StatisticalTest[] = [];

    // T-test against zero
    const tTestZero = this.performTTest(returns1, 0);
    tests.push(tTestZero);

    // T-test against benchmark if provided
    if (benchmark) {
      const tTestBenchmark = this.performTTest(returns1, benchmark.reduce((sum, r) => sum + r, 0) / benchmark.length);
      tests.push(tTestBenchmark);
    }

    // Paired t-test if second series provided
    if (returns2) {
      const pairedTTest = this.performPairedTTest(returns1, returns2);
      tests.push(pairedTTest);
    }

    // Wilcoxon signed-rank test
    const wilcoxonTest = this.performWilcoxonTest(returns1);
    tests.push(wilcoxonTest);

    return tests;
  }

  // ===== Basic Return Calculations =====

  private extractReturns(): number[] {
    return this.equityCurve
      .map(point => point.returns)
      .filter(r => !isNaN(r) && isFinite(r));
  }

  private calculateTotalReturn(): number {
    if (this.equityCurve.length === 0) return 0;

    const finalEquity = this.equityCurve[this.equityCurve.length - 1].equity;
    return (finalEquity - this.initialCapital) / this.initialCapital;
  }

  private calculateAnnualizedReturn(returns: number[]): number {
    if (returns.length === 0) return 0;

    const totalReturn = this.calculateTotalReturn();
    const years = this.equityCurve.length / 252; // Assuming 252 trading days per year

    if (years <= 0) return 0;
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyVolatility = Math.sqrt(variance);

    // Annualize volatility
    return dailyVolatility * Math.sqrt(252);
  }

  private calculateSharpeRatio(annualizedReturn: number, volatility: number): number {
    if (volatility === 0) return 0;
    return (annualizedReturn - this.riskFreeRate) / volatility;
  }

  private calculateSortinoRatio(returns: number[], annualizedReturn: number): number {
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return 0;

    const mean = downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length;
    const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downsideReturns.length;
    const downsideVolatility = Math.sqrt(downsideVariance) * Math.sqrt(252);

    if (downsideVolatility === 0) return 0;
    return (annualizedReturn - this.riskFreeRate) / downsideVolatility;
  }

  private calculateMaxDrawdown(): number {
    if (this.equityCurve.length === 0) return 0;

    let peak = this.equityCurve[0].equity;
    let maxDrawdown = 0;

    for (const point of this.equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }
      const drawdown = (peak - point.equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    if (maxDrawdown === 0) return 0;
    return annualizedReturn / Math.abs(maxDrawdown);
  }

  private calculateAdjustedSharpeRatio(sharpeRatio: number, numObservations: number): number {
    // Adjust Sharpe ratio for small sample bias
    if (numObservations <= 1) return sharpeRatio;

    return sharpeRatio * Math.sqrt(252 / numObservations);
  }

  // ===== Trade-based Metrics =====

  private calculateWinRate(): number {
    if (this.trades.length === 0) return 0;

    const winningTrades = this.trades.filter(t => this.getTradePnL(t) > 0);
    return winningTrades.length / this.trades.length;
  }

  private calculateProfitFactor(): number {
    const winningTrades = this.trades.filter(t => this.getTradePnL(t) > 0);
    const losingTrades = this.trades.filter(t => this.getTradePnL(t) < 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + this.getTradePnL(t), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + this.getTradePnL(t), 0));

    return grossLoss > 0 ? grossProfit / grossLoss : 0;
  }

  private calculateTradeStatistics(): {
    avgWin: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
  } {
    const winningTrades = this.trades.filter(t => this.getTradePnL(t) > 0);
    const losingTrades = this.trades.filter(t => this.getTradePnL(t) < 0);

    const avgWin = winningTrades.length > 0 ?
      winningTrades.reduce((sum, t) => sum + this.getTradePnL(t), 0) / winningTrades.length : 0;

    const avgLoss = losingTrades.length > 0 ?
      Math.abs(losingTrades.reduce((sum, t) => sum + this.getTradePnL(t), 0) / losingTrades.length) : 0;

    const tradePnLs = this.trades.map(t => this.getTradePnL(t));
    const bestTrade = tradePnLs.length > 0 ? Math.max(...tradePnLs) : 0;
    const worstTrade = tradePnLs.length > 0 ? Math.min(...tradePnLs) : 0;

    return { avgWin, avgLoss, bestTrade, worstTrade };
  }

  private calculateAverageTradeDuration(): number {
    const durations = this.calculateTradeDurations();
    return durations.length > 0 ?
      durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
  }

  private calculateTradeDurations(): number[] {
    const durations: number[] = [];

    // Group trades by symbol and pair entry/exit trades
    const symbolGroups = this.groupTradesBySymbol();

    for (const [symbol, trades] of symbolGroups.entries()) {
      for (let i = 0; i < trades.length; i += 2) {
        const entryTrade = trades[i];
        const exitTrade = trades[i + 1];

        if (entryTrade && exitTrade) {
          const entryDate = new Date(entryTrade.timestamp);
          const exitDate = new Date(exitTrade.timestamp);
          const duration = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24); // Days
          durations.push(duration);
        }
      }
    }

    return durations;
  }

  private groupTradesBySymbol(): Map<string, Trade[]> {
    const groups = new Map<string, Trade[]>();

    for (const trade of this.trades) {
      if (!groups.has(trade.symbol)) {
        groups.set(trade.symbol, []);
      }
      groups.get(trade.symbol)!.push(trade);
    }

    // Sort trades by timestamp for each symbol
    for (const trades of groups.values()) {
      trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    return groups;
  }

  private getTradePnL(trade: Trade): number {
    if (trade.direction === 'buy') {
      return -trade.price * trade.quantity - trade.commission - trade.slippage;
    } else {
      return trade.price * trade.quantity - trade.commission - trade.slippage;
    }
  }

  // ===== Risk Metrics =====

  private calculateVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  private calculate5DayVaR(returns: number[], confidenceLevel: number): number {
    // Simplified 5-day VaR using square root of time rule
    const dailyVaR = this.calculateVaR(returns, confidenceLevel);
    return dailyVaR * Math.sqrt(5);
  }

  private calculateExpectedShortfall(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;

    const varThreshold = this.calculateVaR(returns, confidenceLevel);
    const tailReturns = returns.filter(r => r <= varThreshold);

    if (tailReturns.length === 0) return varThreshold;

    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  private calculateDownsideDeviation(returns: number[]): number {
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return 0;

    const mean = downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length;
    const variance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downsideReturns.length;

    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  // ===== Benchmark-relative Metrics =====

  private calculateBeta(returns: number[]): number {
    if (!this.benchmarkReturns || returns.length !== this.benchmarkReturns.length) {
      return 0;
    }

    const returnsMean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const benchmarkMean = this.benchmarkReturns.reduce((sum, r) => sum + r, 0) / this.benchmarkReturns.length;

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < returns.length; i++) {
      const returnDiff = returns[i] - returnsMean;
      const benchmarkDiff = this.benchmarkReturns[i] - benchmarkMean;

      covariance += returnDiff * benchmarkDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }

    if (benchmarkVariance === 0) return 0;
    return covariance / benchmarkVariance;
  }

  private calculateAlpha(annualizedReturn: number): number {
    if (!this.benchmarkReturns) return 0;

    const benchmarkAnnualReturn = this.benchmarkReturns.reduce((sum, r) => sum + r, 0) / this.benchmarkReturns.length * 252;
    const beta = this.calculateBeta(this.extractReturns());

    return annualizedReturn - (this.riskFreeRate + beta * (benchmarkAnnualReturn - this.riskFreeRate));
  }

  private calculateInformationRatio(returns: number[]): number {
    if (!this.benchmarkReturns) return 0;

    const excessReturns = returns.map((r, i) => r - (this.benchmarkReturns[i] || 0));
    const excessMean = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const excessStdDev = Math.sqrt(
      excessReturns.reduce((sum, r) => sum + Math.pow(r - excessMean, 2), 0) / excessReturns.length
    );

    return excessStdDev > 0 ? excessMean / excessStdDev * Math.sqrt(252) : 0;
  }

  private calculateTrackingError(returns: number[]): number {
    if (!this.benchmarkReturns) return 0;

    const excessReturns = returns.map((r, i) => r - (this.benchmarkReturns[i] || 0));
    const excessStdDev = Math.sqrt(
      excessReturns.reduce((sum, r) => sum + r * r, 0) / excessReturns.length
    );

    return excessStdDev * Math.sqrt(252); // Annualized
  }

  private calculateUpsideCapture(returns: number[]): number {
    if (!this.benchmarkReturns) return 0;

    let strategyUpReturns = 0;
    let benchmarkUpReturns = 0;
    let upPeriods = 0;

    for (let i = 0; i < returns.length; i++) {
      if ((this.benchmarkReturns[i] || 0) > 0) {
        strategyUpReturns += returns[i];
        benchmarkUpReturns += this.benchmarkReturns[i] || 0;
        upPeriods++;
      }
    }

    if (upPeriods === 0 || benchmarkUpReturns === 0) return 0;
    return (strategyUpReturns / upPeriods) / (benchmarkUpReturns / upPeriods);
  }

  private calculateDownsideCapture(returns: number[]): number {
    if (!this.benchmarkReturns) return 0;

    let strategyDownReturns = 0;
    let benchmarkDownReturns = 0;
    let downPeriods = 0;

    for (let i = 0; i < returns.length; i++) {
      if ((this.benchmarkReturns[i] || 0) < 0) {
        strategyDownReturns += returns[i];
        benchmarkDownReturns += this.benchmarkReturns[i] || 0;
        downPeriods++;
      }
    }

    if (downPeriods === 0 || benchmarkDownReturns === 0) return 0;
    return (strategyDownReturns / downPeriods) / (benchmarkDownReturns / downPeriods);
  }

  private calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) return 0;

    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;

      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    if (variance1 === 0 || variance2 === 0) return 0;
    return covariance / Math.sqrt(variance1 * variance2);
  }

  // ===== Statistical Tests =====

  private performTTest(returns: number[], nullHypothesis: number): StatisticalTest {
    const n = returns.length;
    if (n === 0) {
      return {
        method: 't_test',
        statistic: 0,
        pValue: 1,
        criticalValue: 0,
        isSignificant: false,
        confidenceInterval: [0, 0]
      };
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
    const stdError = Math.sqrt(variance / n);

    const statistic = stdError > 0 ? (mean - nullHypothesis) / stdError : 0;
    const degreesOfFreedom = n - 1;

    // Simplified critical value (two-tailed, 5% significance)
    const criticalValue = 1.96;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(statistic)));

    const margin = criticalValue * stdError;
    const confidenceInterval: [number, number] = [
      mean - margin,
      mean + margin
    ];

    return {
      method: 't_test',
      statistic,
      pValue,
      criticalValue,
      isSignificant: Math.abs(statistic) > criticalValue,
      confidenceInterval
    };
  }

  private performPairedTTest(returns1: number[], returns2: number[]): StatisticalTest {
    if (returns1.length !== returns2.length) {
      return {
        method: 'paired_t_test',
        statistic: 0,
        pValue: 1,
        criticalValue: 0,
        isSignificant: false,
        confidenceInterval: [0, 0]
      };
    }

    const differences = returns1.map((r1, i) => r1 - (returns2[i] || 0));
    return this.performTTest(differences, 0);
  }

  private performWilcoxonTest(returns: number[]): StatisticalTest {
    // Simplified Wilcoxon signed-rank test
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

    // Calculate signed ranks
    const signedRanks = returns
      .map((value, index) => ({ value, index }))
      .sort((a, b) => Math.abs(a.value) - Math.abs(b.value))
      .map((item, rank) => ({
        ...item,
        rank: rank + 1,
        signedRank: item.value >= 0 ? rank + 1 : -(rank + 1)
      }));

    const statistic = signedRanks.reduce((sum, item) => sum + (item.value >= 0 ? item.rank : 0), 0);

    // Simplified p-value calculation
    const expectedStatistic = n * (n + 1) / 4;
    const variance = n * (n + 1) * (2 * n + 1) / 24;
    const zScore = variance > 0 ? (statistic - expectedStatistic) / Math.sqrt(variance) : 0;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    return {
      method: 'wilcoxon',
      statistic,
      pValue,
      criticalValue: 1.96,
      isSignificant: pValue < 0.05,
      confidenceInterval: [0, 0] // Wilcoxon doesn't provide confidence intervals easily
    };
  }

  private performDegradationTest(trainReturns: number[], testReturns: number[]): number {
    // Simplified degradation significance test
    const trainSharpe = this.calculateSharpeRatio(
      this.calculateAnnualizedReturn(trainReturns),
      this.calculateVolatility(trainReturns)
    );

    const testSharpe = this.calculateSharpeRatio(
      this.calculateAnnualizedReturn(testReturns),
      this.calculateVolatility(testReturns)
    );

    const degradation = trainSharpe > 0 ? (trainSharpe - testSharpe) / trainSharpe : 0;

    // Simple heuristic: significance based on magnitude of degradation
    return Math.min(degradation * 2, 1); // Cap at 1.0
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));

    return x > 0 ? 1 - p : p;
  }
}

/**
 * Factory function to create performance calculator
 */
export function createPerformanceCalculator(
  equityCurve: EquityPoint[],
  trades: Trade[],
  positions: Position[],
  initialCapital: number,
  riskFreeRate: number = 0.02,
  benchmarkReturns?: number[]
): PerformanceCalculator {
  return new PerformanceCalculator(
    equityCurve,
    trades,
    positions,
    initialCapital,
    riskFreeRate,
    benchmarkReturns
  );
}