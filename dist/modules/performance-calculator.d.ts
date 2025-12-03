/**
 * Performance Metrics Calculator
 * Comprehensive financial metrics calculation for backtesting
 */
import { PerformanceMetrics, EquityPoint, Trade, Position, RiskMetrics, PerformanceAttribution, DegradationMetrics, StatisticalTest } from '../types/backtesting.js';
/**
 * Advanced Performance Calculator
 */
export declare class PerformanceCalculator {
    private equityCurve;
    private trades;
    private positions;
    private initialCapital;
    private riskFreeRate;
    private benchmarkReturns?;
    constructor(equityCurve: EquityPoint[], trades: Trade[], positions: Position[], initialCapital: number, riskFreeRate?: number, benchmarkReturns?: number[]);
    /**
     * Calculate comprehensive performance metrics
     */
    calculateAllMetrics(): PerformanceMetrics;
    /**
     * Calculate detailed risk metrics
     */
    calculateRiskMetrics(): RiskMetrics;
    /**
     * Calculate performance attribution
     */
    calculatePerformanceAttribution(): PerformanceAttribution;
    /**
     * Calculate degradation metrics for out-of-sample testing
     */
    calculateDegradationMetrics(trainReturns: number[], testReturns: number[], validationReturns?: number[]): DegradationMetrics;
    /**
     * Perform statistical significance tests
     */
    performStatisticalTests(returns1: number[], returns2?: number[], benchmark?: number[]): StatisticalTest[];
    private extractReturns;
    private calculateTotalReturn;
    private calculateAnnualizedReturn;
    private calculateVolatility;
    private calculateSharpeRatio;
    private calculateSortinoRatio;
    private calculateMaxDrawdown;
    private calculateCalmarRatio;
    private calculateAdjustedSharpeRatio;
    private calculateWinRate;
    private calculateProfitFactor;
    private calculateTradeStatistics;
    private calculateAverageTradeDuration;
    private calculateTradeDurations;
    private groupTradesBySymbol;
    private getTradePnL;
    private calculateVaR;
    private calculate5DayVaR;
    private calculateExpectedShortfall;
    private calculateDownsideDeviation;
    private calculateBeta;
    private calculateAlpha;
    private calculateInformationRatio;
    private calculateTrackingError;
    private calculateUpsideCapture;
    private calculateDownsideCapture;
    private calculateCorrelation;
    private performTTest;
    private performPairedTTest;
    private performWilcoxonTest;
    private performDegradationTest;
    private normalCDF;
}
/**
 * Factory function to create performance calculator
 */
export declare function createPerformanceCalculator(equityCurve: EquityPoint[], trades: Trade[], positions: Position[], initialCapital: number, riskFreeRate?: number, benchmarkReturns?: number[]): PerformanceCalculator;
//# sourceMappingURL=performance-calculator.d.ts.map