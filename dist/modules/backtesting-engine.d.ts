/**
 * Backtesting Simulation Engine
 * Institutional-grade backtesting with realistic market simulation
 */
import { BacktestConfig, BacktestResult } from '../types/backtesting.js';
import type { CloudflareEnvironment } from '../types.js';
/**
 * Core Backtesting Engine
 */
export declare class BacktestingEngine {
    private config;
    private env;
    private dal;
    private marketData;
    private positions;
    private trades;
    private equityCurve;
    private cash;
    private totalEquity;
    private metadata;
    private executionLog;
    constructor(config: BacktestConfig, env: CloudflareEnvironment);
    /**
     * Run the complete backtest
     */
    runBacktest(): Promise<BacktestResult>;
    /**
     * Load market data for all symbols
     */
    private loadMarketData;
    /**
     * Fetch historical data for a symbol
     */
    private fetchSymbolData;
    /**
     * Validate loaded market data
     */
    private validateMarketData;
    /**
     * Validate data for a specific symbol
     */
    private validateSymbolData;
    /**
     * Calculate number of trading days between two dates
     */
    private calculateTradingDays;
    /**
     * Calculate data consistency across symbols
     */
    private calculateDataConsistency;
    /**
     * Initialize simulation parameters
     */
    private initializeSimulation;
    /**
     * Run the main simulation loop
     */
    private runSimulation;
    /**
     * Process a single trading day
     */
    private processTradingDay;
    /**
     * Update the market value of all positions
     */
    private updatePositionValues;
    /**
     * Check for exit signals
     */
    private checkExitSignals;
    /**
     * Check for entry signals
     */
    private checkEntrySignals;
    /**
     * Generate entry signal for a symbol
     */
    private generateEntrySignal;
    /**
     * Generate exit signal for a position
     */
    private generateExitSignal;
    /**
     * Get model prediction for a symbol
     */
    private getModelPrediction;
    /**
     * Map analysis result to prediction
     */
    private mapToPrediction;
    /**
     * Calculate prediction confidence
     */
    private calculatePredictionConfidence;
    /**
     * Calculate probability distribution
     */
    private calculateProbabilityDistribution;
    /**
     * Calculate signal strength
     */
    private calculateSignalStrength;
    /**
     * Check if should enter position based on signal
     */
    private shouldEnter;
    /**
     * Check if should exit position based on signal
     */
    private shouldExit;
    /**
     * Check if should exit based on prediction
     */
    private shouldExitBasedOnPrediction;
    /**
     * Calculate position size
     */
    private calculatePositionSize;
    /**
     * Execute position entry
     */
    private executePositionEntry;
    /**
     * Execute position exit
     */
    private executePositionExit;
    /**
     * Apply slippage to execution price
     */
    private applySlippage;
    /**
     * Calculate commission
     */
    private calculateCommission;
    /**
     * Apply risk management rules
     */
    private applyRiskManagement;
    /**
     * Execute pending orders
     */
    private executeOrders;
    /**
     * Calculate performance metrics
     */
    private calculatePerformanceMetrics;
    /**
     * Generate advanced analytics
     */
    private generateAdvancedAnalytics;
    /**
     * Perform model validation
     */
    private performModelValidation;
    private getEarliestDate;
    private getTradingDates;
    private getPrice;
    private calculateStopLossPrice;
    private calculateTakeProfitPrice;
    private calculateVolatility;
    private calculateVolatilityFromReturns;
    private calculateDrawdown;
    private getTradePnL;
    private calculateTradeDurations;
    private getDefaultPerformanceMetrics;
    private generateTradeId;
    private logExecution;
}
/**
 * Factory function to create and run backtests
 */
export declare function runBacktest(config: BacktestConfig, env: CloudflareEnvironment): Promise<BacktestResult>;
//# sourceMappingURL=backtesting-engine.d.ts.map