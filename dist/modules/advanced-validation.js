/**
 * Advanced Validation Methods
 * Walk-forward optimization, Monte Carlo simulation, and bootstrap analysis
 */
import { createLogger } from './logging.js';
import { createPerformanceCalculator } from './performance-calculator.js';
const logger = createLogger('advanced-validation');
/**
 * Walk-forward Optimization Engine
 */
export class WalkForwardOptimizer {
    constructor(config, env, equityCurve, trades, positions) {
        this.config = config;
        this.env = env;
        this.equityCurve = equityCurve;
        this.trades = trades;
        this.positions = positions;
    }
    /**
     * Perform comprehensive walk-forward optimization
     */
    async performWalkForwardOptimization() {
        logger.info('Starting walk-forward optimization');
        const windows = await this.generateOptimizationWindows();
        const windowResults = [];
        for (let i = 0; i < windows.length; i++) {
            const window = windows[i];
            logger.info(`Processing walk-forward window ${i + 1}/${windows.length}`);
            const result = await this.optimizeWindow(window);
            windowResults.push(result);
        }
        const overallPerformance = this.calculateOverallPerformance(windowResults);
        const stabilityMetrics = this.calculateStabilityMetrics(windowResults);
        const parameterStability = this.analyzeParameterStability(windowResults);
        return {
            windows: windowResults,
            overallPerformance,
            stabilityMetrics,
            parameterStability
        };
    }
    /**
     * Generate optimization windows
     */
    async generateOptimizationWindows() {
        const totalLength = this.equityCurve.length;
        const trainRatio = 0.6; // 60% training, 40% testing
        const stepSize = Math.floor(totalLength * 0.1); // 10% step size
        const trainSize = Math.floor(totalLength * trainRatio);
        const windows = [];
        let startIndex = 0;
        while (startIndex + trainSize + stepSize <= totalLength) {
            const trainStart = this.equityCurve[startIndex].date;
            const trainEnd = this.equityCurve[startIndex + trainSize - 1].date;
            const testStart = this.equityCurve[startIndex + trainSize].date;
            const testEnd = this.equityCurve[Math.min(startIndex + trainSize + stepSize - 1, totalLength - 1)].date;
            windows.push({
                window: windows.length + 1,
                trainStart,
                trainEnd,
                testStart,
                testEnd,
                parameters: {} // Will be populated during optimization
            });
            startIndex += stepSize;
        }
        return windows;
    }
    /**
     * Optimize a single window
     */
    async optimizeWindow(window) {
        // Extract training and testing data
        const trainStartIndex = this.equityCurve.findIndex(point => point.date === window.trainStart);
        const trainEndIndex = this.equityCurve.findIndex(point => point.date === window.trainEnd);
        const testStartIndex = this.equityCurve.findIndex(point => point.date === window.testStart);
        const testEndIndex = this.equityCurve.findIndex(point => point.date === window.testEnd);
        // Optimize parameters on training data
        const optimalParameters = await this.optimizeParameters(trainStartIndex, trainEndIndex);
        // Evaluate performance on test data
        const testPerformance = await this.evaluateParameters(optimalParameters, testStartIndex, testEndIndex);
        // Get training performance for comparison
        const trainPerformance = await this.evaluateParameters(optimalParameters, trainStartIndex, trainEndIndex);
        return {
            ...window,
            parameters: optimalParameters,
            performance: testPerformance,
            trainPerformance
        };
    }
    /**
     * Optimize parameters on training data
     */
    async optimizeParameters(startIndex, endIndex) {
        // Simplified parameter optimization
        // In a real implementation, this would use grid search, random search, or Bayesian optimization
        const parameterRanges = {
            stopLossPercent: [0.02, 0.05, 0.08, 0.10],
            takeProfitPercent: [0.05, 0.10, 0.15, 0.20],
            positionSize: [0.05, 0.10, 0.15, 0.20],
            confidenceThreshold: [0.5, 0.6, 0.7, 0.8]
        };
        let bestParameters = {};
        let bestSharpe = -Infinity;
        // Grid search (simplified)
        for (const stopLoss of parameterRanges.stopLossPercent) {
            for (const takeProfit of parameterRanges.takeProfitPercent) {
                for (const posSize of parameterRanges.positionSize) {
                    for (const confThreshold of parameterRanges.confidenceThreshold) {
                        const parameters = {
                            stopLossPercent: stopLoss,
                            takeProfitPercent: takeProfit,
                            positionSize: posSize,
                            confidenceThreshold: confThreshold
                        };
                        const performance = await this.evaluateParameters(parameters, startIndex, endIndex);
                        if (performance.sharpeRatio > bestSharpe) {
                            bestSharpe = performance.sharpeRatio;
                            bestParameters = { ...parameters };
                        }
                    }
                }
            }
        }
        logger.info('Parameter optimization completed', {
            bestParameters,
            bestSharpe
        });
        return bestParameters;
    }
    /**
     * Evaluate parameters on a data segment
     */
    async evaluateParameters(parameters, startIndex, endIndex) {
        // Simulate strategy with given parameters
        const segmentEquityCurve = this.equityCurve.slice(startIndex, endIndex + 1);
        const segmentTrades = this.trades.filter(t => {
            const tradeDate = new Date(t.timestamp);
            const startDate = new Date(segmentEquityCurve[0].date);
            const endDate = new Date(segmentEquityCurve[segmentEquityCurve.length - 1].date);
            return tradeDate >= startDate && tradeDate <= endDate;
        });
        // Apply parameter filters to trades
        const filteredTrades = this.filterTradesByParameters(segmentTrades, parameters);
        const calculator = createPerformanceCalculator(segmentEquityCurve, filteredTrades, [], this.config.execution.initialCapital);
        return calculator.calculateAllMetrics();
    }
    /**
     * Filter trades based on parameters
     */
    filterTradesByParameters(trades, parameters) {
        return trades.filter(trade => {
            // Simplified filtering based on confidence threshold
            if (trade.signal.confidence < parameters.confidenceThreshold) {
                return false;
            }
            // Additional filtering logic would go here
            return true;
        });
    }
    /**
     * Calculate overall performance across all windows
     */
    calculateOverallPerformance(windows) {
        if (windows.length === 0) {
            return this.getDefaultPerformanceMetrics();
        }
        const performances = windows.map(w => w.performance);
        return this.calculateAveragePerformance(performances);
    }
    /**
     * Calculate stability metrics
     */
    calculateStabilityMetrics(windows) {
        const returns = windows.map(w => w.performance.annualizedReturn);
        const sharpes = windows.map(w => w.performance.sharpeRatio);
        const drawdowns = windows.map(w => w.performance.maxDrawdown);
        const winRates = windows.map(w => w.performance.winRate);
        return {
            returnStability: this.calculateStabilityScore(returns),
            volatilityStability: this.calculateStabilityScore(windows.map(w => w.performance.volatility)),
            sharpeStability: this.calculateStabilityScore(sharpes),
            drawdownStability: this.calculateStabilityScore(drawdowns),
            overallStability: (this.calculateStabilityScore(returns) + this.calculateStabilityScore(sharpes)) / 2
        };
    }
    /**
     * Analyze parameter stability across windows
     */
    analyzeParameterStability(windows) {
        const parameterNames = Object.keys(windows[0]?.parameters || {});
        const stability = [];
        for (const paramName of parameterNames) {
            const values = windows.map(w => w.parameters[paramName]).filter(v => v !== undefined);
            if (values.length > 1) {
                const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
                const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
                const stdDev = Math.sqrt(variance);
                const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
                // Determine trend
                let trend = 'stable';
                if (values.length > 2) {
                    const firstHalf = values.slice(0, Math.floor(values.length / 2));
                    const secondHalf = values.slice(Math.floor(values.length / 2));
                    const firstMean = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
                    const secondMean = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
                    if (secondMean > firstMean * 1.1)
                        trend = 'increasing';
                    else if (secondMean < firstMean * 0.9)
                        trend = 'decreasing';
                    else if (coefficientOfVariation > 0.2)
                        trend = 'volatile';
                }
                stability.push({
                    parameter: paramName,
                    optimalValues: values,
                    stability: Math.max(0, 1 - coefficientOfVariation),
                    trend
                });
            }
        }
        return stability;
    }
    calculateStabilityScore(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const coefficientOfVariation = Math.sqrt(variance) / Math.abs(mean);
        return Math.max(0, 1 - coefficientOfVariation);
    }
    calculateAveragePerformance(performances) {
        if (performances.length === 0) {
            return this.getDefaultPerformanceMetrics();
        }
        return {
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
    }
    getDefaultPerformanceMetrics() {
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
 * Monte Carlo Simulation Engine
 */
export class MonteCarloSimulator {
    constructor(config, env, equityCurve, trades, positions) {
        this.config = config;
        this.env = env;
        this.equityCurve = equityCurve;
        this.trades = trades;
        this.positions = positions;
    }
    /**
     * Perform comprehensive Monte Carlo simulation
     */
    async performMonteCarloSimulation(numSimulations = 1000) {
        logger.info('Starting Monte Carlo simulation', { numSimulations });
        const simulations = [];
        const batchSize = 100; // Process in batches to avoid memory issues
        for (let batch = 0; batch < Math.ceil(numSimulations / batchSize); batch++) {
            const batchStart = batch * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, numSimulations);
            logger.info(`Processing Monte Carlo batch ${batch + 1}/${Math.ceil(numSimulations / batchSize)}`);
            const batchPromises = [];
            for (let i = batchStart; i < batchEnd; i++) {
                batchPromises.push(this.runSingleSimulation(i));
            }
            const batchResults = await Promise.all(batchPromises);
            simulations.push(...batchResults);
        }
        const summary = this.calculateSimulationSummary(simulations);
        const confidenceIntervals = this.calculateConfidenceIntervals(simulations);
        const tailRisk = this.calculateTailRisk(simulations);
        logger.info('Monte Carlo simulation completed', {
            totalSimulations: simulations.length,
            meanReturn: summary.meanReturn,
            successProbability: summary.successProbability
        });
        return {
            simulations,
            summary,
            confidenceIntervals,
            tailRisk
        };
    }
    /**
     * Run a single Monte Carlo simulation
     */
    async runSingleSimulation(simulationId) {
        // Method 1: Bootstrap returns
        if (Math.random() < 0.4) {
            return this.runBootstrapSimulation(simulationId);
        }
        // Method 2: Parametric simulation
        else if (Math.random() < 0.7) {
            return this.runParametricSimulation(simulationId);
        }
        // Method 3: Resample trades
        else {
            return this.runTradeResamplingSimulation(simulationId);
        }
    }
    /**
     * Bootstrap returns simulation
     */
    runBootstrapSimulation(simulationId) {
        const originalReturns = this.extractReturns();
        const resampledReturns = this.resampleWithReplacement(originalReturns);
        const simulatedEquityCurve = this.generateEquityCurveFromReturns(resampledReturns);
        const performance = this.calculatePerformanceFromReturns(resampledReturns);
        return {
            simulation: simulationId,
            finalReturn: performance.totalReturn,
            maxDrawdown: performance.maxDrawdown,
            sharpeRatio: performance.sharpeRatio,
            volatility: performance.volatility,
            equityCurve: simulatedEquityCurve
        };
    }
    /**
     * Parametric simulation
     */
    runParametricSimulation(simulationId) {
        const originalReturns = this.extractReturns();
        const mean = originalReturns.reduce((sum, r) => sum + r, 0) / originalReturns.length;
        const stdDev = Math.sqrt(originalReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / originalReturns.length);
        // Add some randomness to parameters
        const noiseFactor = 0.1;
        const noisyMean = mean * (1 + (Math.random() - 0.5) * noiseFactor);
        const noisyStdDev = stdDev * (1 + (Math.random() - 0.5) * noiseFactor);
        const simulatedReturns = this.generateRandomReturns(originalReturns.length, noisyMean, noisyStdDev);
        const simulatedEquityCurve = this.generateEquityCurveFromReturns(simulatedReturns);
        const performance = this.calculatePerformanceFromReturns(simulatedReturns);
        return {
            simulation: simulationId,
            finalReturn: performance.totalReturn,
            maxDrawdown: performance.maxDrawdown,
            sharpeRatio: performance.sharpeRatio,
            volatility: performance.volatility,
            equityCurve: simulatedEquityCurve
        };
    }
    /**
     * Trade resampling simulation
     */
    runTradeResamplingSimulation(simulationId) {
        // Resample trades and rebuild equity curve
        const resampledTrades = this.resampleTradesWithReplacement(this.trades);
        const simulatedEquityCurve = this.generateEquityCurveFromTrades(resampledTrades);
        const performance = this.calculatePerformanceFromEquityCurve(simulatedEquityCurve);
        return {
            simulation: simulationId,
            finalReturn: performance.totalReturn,
            maxDrawdown: performance.maxDrawdown,
            sharpeRatio: performance.sharpeRatio,
            volatility: performance.volatility,
            equityCurve: simulatedEquityCurve
        };
    }
    /**
     * Extract returns from equity curve
     */
    extractReturns() {
        return this.equityCurve
            .map(point => point.returns)
            .filter(r => !isNaN(r) && isFinite(r));
    }
    /**
     * Resample with replacement
     */
    resampleWithReplacement(data) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const randomIndex = Math.floor(Math.random() * data.length);
            result.push(data[randomIndex]);
        }
        return result;
    }
    /**
     * Resample trades with replacement
     */
    resampleTradesWithReplacement(trades) {
        const result = [];
        for (let i = 0; i < trades.length; i++) {
            const randomIndex = Math.floor(Math.random() * trades.length);
            const originalTrade = trades[randomIndex];
            // Create a new trade with modified ID and timestamp
            result.push({
                ...originalTrade,
                id: `sim_${originalTrade.id}_${i}`,
                timestamp: this.equityCurve[i]?.date || originalTrade.timestamp
            });
        }
        return result;
    }
    /**
     * Generate random returns
     */
    generateRandomReturns(length, mean, stdDev) {
        const returns = [];
        for (let i = 0; i < length; i++) {
            // Box-Muller transform for normal distribution
            const u1 = Math.random();
            const u2 = Math.random();
            const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            returns.push(mean + z0 * stdDev);
        }
        return returns;
    }
    /**
     * Generate equity curve from returns
     */
    generateEquityCurveFromReturns(returns) {
        const equityCurve = [];
        let equity = this.config.execution.initialCapital;
        let cumulativeReturns = 0;
        let peak = equity;
        for (let i = 0; i < returns.length; i++) {
            equity *= (1 + returns[i]);
            cumulativeReturns += returns[i];
            if (equity > peak)
                peak = equity;
            const drawdown = (peak - equity) / peak;
            equityCurve.push({
                date: this.equityCurve[i]?.date || new Date().toISOString().split('T')[0],
                equity,
                returns: returns[i],
                cumulativeReturns,
                drawdown
            });
        }
        return equityCurve;
    }
    /**
     * Generate equity curve from trades
     */
    generateEquityCurveFromTrades(trades) {
        // Simplified equity curve generation from trades
        const equityCurve = [];
        let equity = this.config.execution.initialCapital;
        let peak = equity;
        // Sort trades by date
        const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let currentTradeIndex = 0;
        for (let i = 0; i < this.equityCurve.length; i++) {
            const currentDate = this.equityCurve[i].date;
            // Process any trades on or before this date
            while (currentTradeIndex < sortedTrades.length &&
                new Date(sortedTrades[currentTradeIndex].timestamp) <= new Date(currentDate)) {
                const trade = sortedTrades[currentTradeIndex];
                const pnl = this.calculateTradePnL(trade);
                equity += pnl;
                currentTradeIndex++;
            }
            if (equity > peak)
                peak = equity;
            const drawdown = (peak - equity) / peak;
            const previousEquity = i > 0 ? equityCurve[i - 1].equity : this.config.execution.initialCapital;
            const dailyReturn = (equity - previousEquity) / previousEquity;
            const cumulativeReturns = i > 0 ? equityCurve[i - 1].cumulativeReturns + dailyReturn : dailyReturn;
            equityCurve.push({
                date: currentDate,
                equity,
                returns: dailyReturn,
                cumulativeReturns,
                drawdown
            });
        }
        return equityCurve;
    }
    /**
     * Calculate P&L for a trade
     */
    calculateTradePnL(trade) {
        if (trade.direction === 'buy') {
            return -trade.price * trade.quantity - trade.commission - trade.slippage;
        }
        else {
            return trade.price * trade.quantity - trade.commission - trade.slippage;
        }
    }
    /**
     * Calculate performance from returns
     */
    calculatePerformanceFromReturns(returns) {
        if (returns.length === 0) {
            return this.getDefaultPerformanceMetrics();
        }
        const totalReturn = returns.reduce((sum, r) => sum + r, 0);
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(252);
        const annualizedReturn = totalReturn * (252 / returns.length);
        const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;
        const downsideReturns = returns.filter(r => r < 0);
        const downsideVariance = downsideReturns.length > 0 ?
            downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / downsideReturns.length : 0;
        const sortinoRatio = downsideVariance > 0 ? annualizedReturn / (Math.sqrt(downsideVariance) * Math.sqrt(252)) : 0;
        // Calculate drawdown
        let peak = 1; // Start with 100% of initial capital
        let maxDrawdown = 0;
        let current = 1;
        for (const ret of returns) {
            current *= (1 + ret);
            if (current > peak)
                peak = current;
            const drawdown = (peak - current) / peak;
            if (drawdown > maxDrawdown)
                maxDrawdown = drawdown;
        }
        const calmarRatio = maxDrawdown > 0 ? Math.abs(annualizedReturn / maxDrawdown) : 0;
        return {
            totalReturn,
            annualizedReturn,
            volatility,
            sharpeRatio,
            sortinoRatio,
            maxDrawdown,
            calmarRatio,
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
    /**
     * Calculate performance from equity curve
     */
    calculatePerformanceFromEquityCurve(equityCurve) {
        if (equityCurve.length === 0) {
            return this.getDefaultPerformanceMetrics();
        }
        const returns = equityCurve.map(point => point.returns).filter(r => !isNaN(r));
        return this.calculatePerformanceFromReturns(returns);
    }
    /**
     * Calculate simulation summary
     */
    calculateSimulationSummary(simulations) {
        const finalReturns = simulations.map(s => s.finalReturn).sort((a, b) => a - b);
        const maxDrawdowns = simulations.map(s => s.maxDrawdown);
        const sharpeRatios = simulations.map(s => s.sharpeRatio);
        return {
            meanReturn: finalReturns.reduce((sum, r) => sum + r, 0) / finalReturns.length,
            medianReturn: finalReturns[Math.floor(finalReturns.length / 2)],
            stdDevReturn: Math.sqrt(finalReturns.reduce((sum, r) => sum + Math.pow(r - finalReturns.reduce((s, r) => s + r, 0) / finalReturns.length, 2), 0) / finalReturns.length),
            percentiles: {
                1: finalReturns[Math.floor(0.01 * finalReturns.length)],
                5: finalReturns[Math.floor(0.05 * finalReturns.length)],
                10: finalReturns[Math.floor(0.10 * finalReturns.length)],
                25: finalReturns[Math.floor(0.25 * finalReturns.length)],
                50: finalReturns[Math.floor(0.50 * finalReturns.length)],
                75: finalReturns[Math.floor(0.75 * finalReturns.length)],
                90: finalReturns[Math.floor(0.90 * finalReturns.length)],
                95: finalReturns[Math.floor(0.95 * finalReturns.length)],
                99: finalReturns[Math.floor(0.99 * finalReturns.length)]
            },
            successProbability: finalReturns.filter(r => r > 0).length / finalReturns.length,
            riskOfRuin: finalReturns.filter(r => r < -0.5).length / finalReturns.length,
            probabilityOfLoss: finalReturns.filter(r => r < 0).length / finalReturns.length,
            averageSharpe: sharpeRatios.reduce((sum, s) => sum + s, 0) / sharpeRatios.length,
            averageMaxDrawdown: maxDrawdowns.reduce((sum, d) => sum + d, 0) / maxDrawdowns.length,
            worstCaseScenario: finalReturns[0],
            bestCaseScenario: finalReturns[finalReturns.length - 1]
        };
    }
    /**
     * Calculate confidence intervals
     */
    calculateConfidenceIntervals(simulations) {
        const metrics = ['finalReturn', 'maxDrawdown', 'sharpeRatio', 'volatility'];
        const intervals = [];
        for (const metric of metrics) {
            const values = simulations.map(s => s[metric]).sort((a, b) => a - b);
            const lower95 = values[Math.floor(0.025 * values.length)];
            const upper95 = values[Math.floor(0.975 * values.length)];
            const lower99 = values[Math.floor(0.005 * values.length)];
            const upper99 = values[Math.floor(0.995 * values.length)];
            const estimate = values.reduce((sum, v) => sum + v, 0) / values.length;
            intervals.push({
                metric,
                level95: { lower: lower95, upper: upper95 },
                level99: { lower: lower99, upper: upper99 },
                estimate,
                margin95: estimate - lower95,
                margin99: estimate - lower99
            });
        }
        return intervals;
    }
    /**
     * Calculate tail risk metrics
     */
    calculateTailRisk(simulations) {
        const finalReturns = simulations.map(s => s.finalReturn).sort((a, b) => a - b);
        const maxDrawdowns = simulations.map(s => s.maxDrawdown);
        // Expected Shortfall (ES) at 95% confidence level
        const var95 = finalReturns[Math.floor(0.05 * finalReturns.length)];
        const tailReturns = finalReturns.filter(r => r <= var95);
        const expectedShortfall = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
        // Conditional VaR
        const conditionalVar = var95;
        // Recovery time analysis
        const recoveryTimes = this.calculateRecoveryTimes(simulations);
        const averageRecoveryTime = recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
        return {
            expectedShortfall,
            conditionalVar,
            maximumLoss: finalReturns[0],
            recoveryTime: averageRecoveryTime,
            tailRiskPremium: 0.02, // Simplified
            leftTailProbability: finalReturns.filter(r => r < -0.2).length / finalReturns.length,
            rightTailProbability: finalReturns.filter(r => r > 0.3).length / finalReturns.length,
            skewness: this.calculateSkewness(finalReturns),
            kurtosis: this.calculateKurtosis(finalReturns)
        };
    }
    /**
     * Calculate recovery times for simulations
     */
    calculateRecoveryTimes(simulations) {
        const recoveryTimes = [];
        for (const simulation of simulations) {
            const drawdowns = simulation.equityCurve.map(point => point.drawdown);
            let maxDrawdownIndex = 0;
            let maxDrawdown = 0;
            // Find maximum drawdown and its index
            for (let i = 0; i < drawdowns.length; i++) {
                if (drawdowns[i] > maxDrawdown) {
                    maxDrawdown = drawdowns[i];
                    maxDrawdownIndex = i;
                }
            }
            // Find recovery time (time to get back to previous peak)
            let recoveryTime = 0;
            let recovered = false;
            for (let i = maxDrawdownIndex; i < drawdowns.length; i++) {
                if (drawdowns[i] < 0.01) { // Within 1% of peak
                    recovered = true;
                    recoveryTime = i - maxDrawdownIndex;
                    break;
                }
            }
            if (!recovered) {
                recoveryTime = drawdowns.length - maxDrawdownIndex;
            }
            recoveryTimes.push(recoveryTime);
        }
        return recoveryTimes;
    }
    /**
     * Calculate skewness
     */
    calculateSkewness(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0)
            return 0;
        const skewness = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / values.length;
        return skewness;
    }
    /**
     * Calculate kurtosis
     */
    calculateKurtosis(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0)
            return 0;
        const kurtosis = values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) / values.length;
        return kurtosis - 3; // Excess kurtosis
    }
    getDefaultPerformanceMetrics() {
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
 * Factory functions
 */
export function createWalkForwardOptimizer(config, env, equityCurve, trades, positions) {
    return new WalkForwardOptimizer(config, env, equityCurve, trades, positions);
}
export function createMonteCarloSimulator(config, env, equityCurve, trades, positions) {
    return new MonteCarloSimulator(config, env, equityCurve, trades, positions);
}
//# sourceMappingURL=advanced-validation.js.map