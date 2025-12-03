/**
 * Model Validation Framework
 * Statistical validation and robustness testing for predictive models
 */
import { ValidationResult, CrossValidationResult, OutOfSampleResult, SignificanceResult, OverfittingResult, WalkForwardResult, MonteCarloResult, BootstrapResult, BacktestConfig, EquityPoint, Trade, Position } from '../types/backtesting.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Comprehensive Model Validation Framework
 */
export declare class ModelValidator {
    private config;
    private env;
    private equityCurve;
    private trades;
    private positions;
    constructor(config: BacktestConfig, env: CloudflareEnvironment, equityCurve: EquityPoint[], trades: Trade[], positions: Position[]);
    /**
     * Perform comprehensive model validation
     */
    validateModel(): Promise<ValidationResult>;
    /**
     * Perform cross-validation
     */
    performCrossValidation(): Promise<CrossValidationResult>;
    /**
     * Perform time series split cross-validation
     */
    private performTimeSeriesSplit;
    /**
     * Perform rolling window cross-validation
     */
    private performRollingWindow;
    /**
     * Perform expanding window cross-validation
     */
    private performExpandingWindow;
    /**
     * Perform out-of-sample testing
     */
    performOutOfSampleTesting(): Promise<OutOfSampleResult>;
    /**
     * Perform significance testing
     */
    performSignificanceTesting(): Promise<SignificanceResult>;
    /**
     * Perform overfitting detection
     */
    performOverfittingDetection(): Promise<OverfittingResult>;
    /**
     * Perform walk-forward optimization
     */
    performWalkForwardOptimization(): Promise<WalkForwardResult>;
    /**
     * Perform Monte Carlo simulation
     */
    performMonteCarloSimulation(): Promise<MonteCarloResult>;
    /**
     * Perform bootstrap analysis
     */
    performBootstrapAnalysis(): Promise<BootstrapResult>;
    private simulatePeriodPerformance;
    private extractReturns;
    private calculateAveragePerformance;
    private calculatePerformanceStdDev;
    private calculateStabilityScore;
    private calculateMetricStability;
    private generateCrossValidationRecommendation;
    private calculateDegradationMetrics;
    private performTTest;
    private performWilcoxonTest;
    private performBootstrapTest;
    private performBenchmarkComparison;
    private getBenchmarkReturns;
    private resampleWithReplacement;
    private calculateBootstrapPValue;
    private getTCriticalValue;
    private normalCDF;
    private calculateOverallSignificance;
    private checkCrossValidationOverfitting;
    private checkLearningCurveOverfitting;
    private analyzePerformanceByDataSize;
    private calculateImprovementRate;
    private checkFeatureImportanceOverfitting;
    private calculateOverfittingRiskScore;
    private generateOverfittingRecommendation;
    private generateWalkForwardWindows;
    private evaluateWalkForwardWindow;
    private calculateWalkForwardStability;
    private calculateParameterStability;
    private runMonteCarloSimulation;
    private generateRandomReturns;
    private generateEquityCurveFromReturns;
    private calculatePerformanceFromReturns;
    private calculateMonteCarloSummary;
    private calculateConfidenceIntervals;
    private calculateTailRiskMetrics;
    private generateBootstrapSample;
    private calculateBootstrapDistribution;
    private calculateBiasCorrectedPerformance;
    private performBootstrapSignificanceTests;
    private calculateOriginalPerformance;
    private calculateOverallScore;
    private generateRecommendation;
    private getDefaultPerformanceMetrics;
}
/**
 * Factory function to create model validator
 */
export declare function createModelValidator(config: BacktestConfig, env: CloudflareEnvironment, equityCurve: EquityPoint[], trades: Trade[], positions: Position[]): ModelValidator;
//# sourceMappingURL=model-validator.d.ts.map