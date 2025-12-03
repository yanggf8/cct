/**
 * Advanced Validation Methods
 * Walk-forward optimization, Monte Carlo simulation, and bootstrap analysis
 */
import { WalkForwardResult, MonteCarloResult, BacktestConfig, EquityPoint, Trade, Position } from '../types/backtesting.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Walk-forward Optimization Engine
 */
export declare class WalkForwardOptimizer {
    private config;
    private env;
    private equityCurve;
    private trades;
    private positions;
    constructor(config: BacktestConfig, env: CloudflareEnvironment, equityCurve: EquityPoint[], trades: Trade[], positions: Position[]);
    /**
     * Perform comprehensive walk-forward optimization
     */
    performWalkForwardOptimization(): Promise<WalkForwardResult>;
    /**
     * Generate optimization windows
     */
    private generateOptimizationWindows;
    /**
     * Optimize a single window
     */
    private optimizeWindow;
    /**
     * Optimize parameters on training data
     */
    private optimizeParameters;
    /**
     * Evaluate parameters on a data segment
     */
    private evaluateParameters;
    /**
     * Filter trades based on parameters
     */
    private filterTradesByParameters;
    /**
     * Calculate overall performance across all windows
     */
    private calculateOverallPerformance;
    /**
     * Calculate stability metrics
     */
    private calculateStabilityMetrics;
    /**
     * Analyze parameter stability across windows
     */
    private analyzeParameterStability;
    private calculateStabilityScore;
    private calculateAveragePerformance;
    private getDefaultPerformanceMetrics;
}
/**
 * Monte Carlo Simulation Engine
 */
export declare class MonteCarloSimulator {
    private config;
    private env;
    private equityCurve;
    private trades;
    private positions;
    constructor(config: BacktestConfig, env: CloudflareEnvironment, equityCurve: EquityPoint[], trades: Trade[], positions: Position[]);
    /**
     * Perform comprehensive Monte Carlo simulation
     */
    performMonteCarloSimulation(numSimulations?: number): Promise<MonteCarloResult>;
    /**
     * Run a single Monte Carlo simulation
     */
    private runSingleSimulation;
    /**
     * Bootstrap returns simulation
     */
    private runBootstrapSimulation;
    /**
     * Parametric simulation
     */
    private runParametricSimulation;
    /**
     * Trade resampling simulation
     */
    private runTradeResamplingSimulation;
    /**
     * Extract returns from equity curve
     */
    private extractReturns;
    /**
     * Resample with replacement
     */
    private resampleWithReplacement;
    /**
     * Resample trades with replacement
     */
    private resampleTradesWithReplacement;
    /**
     * Generate random returns
     */
    private generateRandomReturns;
    /**
     * Generate equity curve from returns
     */
    private generateEquityCurveFromReturns;
    /**
     * Generate equity curve from trades
     */
    private generateEquityCurveFromTrades;
    /**
     * Calculate P&L for a trade
     */
    private calculateTradePnL;
    /**
     * Calculate performance from returns
     */
    private calculatePerformanceFromReturns;
    /**
     * Calculate performance from equity curve
     */
    private calculatePerformanceFromEquityCurve;
    /**
     * Calculate simulation summary
     */
    private calculateSimulationSummary;
    /**
     * Calculate confidence intervals
     */
    private calculateConfidenceIntervals;
    /**
     * Calculate tail risk metrics
     */
    private calculateTailRisk;
    /**
     * Calculate recovery times for simulations
     */
    private calculateRecoveryTimes;
    /**
     * Calculate skewness
     */
    private calculateSkewness;
    /**
     * Calculate kurtosis
     */
    private calculateKurtosis;
    private getDefaultPerformanceMetrics;
}
/**
 * Factory functions
 */
export declare function createWalkForwardOptimizer(config: BacktestConfig, env: CloudflareEnvironment, equityCurve: EquityPoint[], trades: Trade[], positions: Position[]): WalkForwardOptimizer;
export declare function createMonteCarloSimulator(config: BacktestConfig, env: CloudflareEnvironment, equityCurve: EquityPoint[], trades: Trade[], positions: Position[]): MonteCarloSimulator;
//# sourceMappingURL=advanced-validation.d.ts.map