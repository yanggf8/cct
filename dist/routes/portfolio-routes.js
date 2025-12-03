/**
 * Portfolio Optimization API Routes
 * Comprehensive portfolio construction, optimization, and rebalancing endpoints
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */
import { createCorrelationAnalysisEngine } from '../modules/correlation-analysis.js';
import { createPortfolioRebalancingEngine } from '../modules/portfolio-rebalancing.js';
import { ApiResponseFactory } from '../modules/api-v1-responses.js';
/**
 * Portfolio Routes Handler
 */
export class PortfolioRoutesHandler {
    constructor(env) {
        this.env = env;
        this.correlationEngine = createCorrelationAnalysisEngine(env);
        this.rebalancingEngine = createPortfolioRebalancingEngine(env);
    }
    /**
     * Handle correlation analysis request
     */
    async handleCorrelationAnalysis(request) {
        try {
            const { symbols, lookbackPeriod = 252, useCache = true } = await request.json();
            if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
                const body = ApiResponseFactory.error('At least 2 symbols required for correlation analysis', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Check cache first
            if (useCache) {
                const cached = await this.correlationEngine.getCachedCorrelationMatrix(symbols, lookbackPeriod);
                if (cached) {
                    const body = ApiResponseFactory.success({
                        ...cached,
                        cached: true,
                        cacheHit: true
                    });
                    return new Response(JSON.stringify(body), { status: 200 });
                }
            }
            // Calculate correlation matrix
            const correlationResult = await this.correlationEngine.calculateCorrelationMatrix(symbols, lookbackPeriod);
            const body = ApiResponseFactory.success(correlationResult);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Correlation analysis failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'CORRELATION_ANALYSIS_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle portfolio optimization request
     */
    async handlePortfolioOptimization(request) {
        try {
            const { symbols, objective = 'MAX_SHARPE', lookbackPeriod = 252, constraints = {}, useCache = true } = await request.json();
            if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
                const body = ApiResponseFactory.error('At least 2 symbols required for portfolio optimization', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Calculate correlation and covariance matrices
            const correlationResult = await this.correlationEngine.calculateCorrelationMatrix(symbols, lookbackPeriod);
            const covarianceResult = await this.correlationEngine.calculateCovarianceMatrix(symbols, lookbackPeriod);
            const expectedReturns = await this.correlationEngine.calculateExpectedReturns(symbols);
            // Optimize portfolio
            const optimizationResult = await this.correlationEngine.optimizePortfolio(symbols, expectedReturns, covarianceResult.covarianceMatrix, objective, constraints);
            // Calculate risk metrics for the optimized portfolio
            const riskMetrics = await this.correlationEngine.calculatePortfolioRiskMetrics(optimizationResult.weights, covarianceResult.covarianceMatrix, expectedReturns);
            const result = {
                symbols,
                objective,
                constraints,
                optimization: optimizationResult,
                riskMetrics,
                correlationMatrix: correlationResult.correlationMatrix,
                covarianceMatrix: covarianceResult.covarianceMatrix,
                expectedReturns,
                calculatedAt: new Date().toISOString()
            };
            // Cache results
            await this.correlationEngine.persistOptimalPortfolio(`${symbols.join('_')}_${objective}`, result);
            const body = ApiResponseFactory.success(result);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Portfolio optimization failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'PORTFOLIO_OPTIMIZATION_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle efficient frontier calculation
     */
    async handleEfficientFrontier(request) {
        try {
            const { symbols, lookbackPeriod = 252, numPortfolios = 100, useCache = true } = await request.json();
            if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
                const body = ApiResponseFactory.error('At least 2 symbols required for efficient frontier', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Check cache first
            if (useCache) {
                const cached = await this.correlationEngine.getCachedEfficientFrontier(symbols, numPortfolios);
                if (cached) {
                    const body = ApiResponseFactory.success({
                        ...cached,
                        cached: true,
                        cacheHit: true
                    });
                    return new Response(JSON.stringify(body), { status: 200 });
                }
            }
            // Calculate efficient frontier
            const frontierResult = await this.correlationEngine.calculateEfficientFrontier(symbols, numPortfolios);
            const body = ApiResponseFactory.success(frontierResult);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Efficient frontier calculation failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'EFFICIENT_FRONTIER_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle portfolio risk metrics calculation
     */
    async handlePortfolioRiskMetrics(request) {
        try {
            const requestData = await request.json();
            // Handle both object and array formats for weights
            let weights, symbols;
            if (requestData.weights && typeof requestData.weights === 'object' && !Array.isArray(requestData.weights)) {
                // Convert object format to array format
                symbols = Object.keys(requestData.weights);
                weights = Object.values(requestData.weights);
            }
            else {
                // Use array format directly
                weights = requestData.weights;
                symbols = requestData.symbols;
            }
            const { lookbackPeriod = 252, includeStressTest = false, scenarios = [] } = requestData;
            if (!weights || !Array.isArray(weights) || weights.length === 0) {
                const body = ApiResponseFactory.error('Portfolio weights are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
                const body = ApiResponseFactory.error('Symbols are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            if (weights.length !== symbols.length) {
                const body = ApiResponseFactory.error('Weights and symbols arrays must have the same length', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Validate weights sum to 1
            const weightSum = weights.reduce((sum, w) => sum + w, 0);
            if (Math.abs(weightSum - 1.0) > 0.01) {
                const body = ApiResponseFactory.error('Portfolio weights must sum to 1.0', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Get covariance matrix and expected returns
            const covarianceResult = await this.correlationEngine.calculateCovarianceMatrix(symbols, lookbackPeriod);
            const expectedReturns = await this.correlationEngine.calculateExpectedReturns(symbols);
            // Calculate risk metrics
            const riskMetrics = await this.correlationEngine.calculatePortfolioRiskMetrics(weights, covarianceResult.covarianceMatrix, expectedReturns);
            const result = {
                symbols,
                weights,
                riskMetrics,
                lookbackPeriod,
                calculatedAt: new Date().toISOString()
            };
            // Include stress test if requested
            if (includeStressTest) {
                const stressTest = await this.correlationEngine.performStressTest(weights, covarianceResult.covarianceMatrix, scenarios);
                result.stressTest = stressTest;
            }
            const body = ApiResponseFactory.success(result);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Risk metrics calculation failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'RISK_METRICS_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle stress testing request
     */
    async handleStressTesting(request) {
        try {
            const requestData = await request.json();
            // Handle both object and array formats for weights
            let weights, symbols;
            if (requestData.weights && typeof requestData.weights === 'object' && !Array.isArray(requestData.weights)) {
                // Convert object format to array format
                symbols = Object.keys(requestData.weights);
                weights = Object.values(requestData.weights);
            }
            else {
                // Use array format directly
                weights = requestData.weights;
                symbols = requestData.symbols;
            }
            const { scenarios = [], lookbackPeriod = 252 } = requestData;
            if (!weights || !symbols || weights.length !== symbols.length) {
                const body = ApiResponseFactory.error('Valid weights and symbols arrays are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Get covariance matrix
            const covarianceResult = await this.correlationEngine.calculateCovarianceMatrix(symbols, lookbackPeriod);
            // Perform stress test
            const stressTest = await this.correlationEngine.performStressTest(weights, covarianceResult.covarianceMatrix, scenarios);
            const body = ApiResponseFactory.success(stressTest);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Stress testing failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'STRESS_TESTING_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle portfolio performance attribution
     */
    async handlePerformanceAttribution(request) {
        try {
            const requestData = await request.json();
            // Handle both object and array formats for weights
            let weights, symbols;
            if (requestData.weights && typeof requestData.weights === 'object' && !Array.isArray(requestData.weights)) {
                // Convert object format to array format
                symbols = Object.keys(requestData.weights);
                weights = Object.values(requestData.weights);
            }
            else {
                // Use array format directly
                weights = requestData.weights;
                symbols = requestData.symbols;
            }
            const { benchmarkWeights, lookbackPeriod = 252, factorReturns = {} } = requestData;
            if (!weights || !benchmarkWeights || !symbols) {
                const body = ApiResponseFactory.error('Weights, benchmark weights, and symbols are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Get returns data
            const returns = await this.correlationEngine.calculateExpectedReturns(symbols);
            // Calculate attribution
            const attribution = await this.correlationEngine.calculatePerformanceAttribution(weights, benchmarkWeights, returns, factorReturns);
            const body = ApiResponseFactory.success(attribution);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Performance attribution failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'PERFORMANCE_ATTRIBUTION_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle rebalancing strategy creation
     */
    async handleCreateRebalancingStrategy(request) {
        try {
            const config = await request.json();
            if (!config.name || !config.portfolioId || !config.targetWeights) {
                const body = ApiResponseFactory.error('Name, portfolio ID, and target weights are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            const strategy = await this.rebalancingEngine.createRebalancingStrategy(config);
            const body = ApiResponseFactory.success(strategy);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Rebalancing strategy creation failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'REBALANCING_STRATEGY_CREATION_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle rebalancing analysis
     */
    async handleRebalancingAnalysis(request) {
        try {
            const { portfolioId, currentWeights, targetWeights, strategyId } = await request.json();
            if (!portfolioId || !currentWeights || !targetWeights || !strategyId) {
                const body = ApiResponseFactory.error('Portfolio ID, current weights, target weights, and strategy ID are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Get strategy (mock implementation)
            const strategy = {
                id: strategyId,
                type: 'THRESHOLD_BASED',
                thresholds: { deviation: 0.05 },
                constraints: {},
                executionConfig: {}
            };
            const analysis = await this.rebalancingEngine.analyzeRebalancingNeeds(portfolioId, currentWeights, targetWeights, strategy);
            const body = ApiResponseFactory.success(analysis);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Rebalancing analysis failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'REBALANCING_ANALYSIS_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle rebalancing execution
     */
    async handleRebalancingExecution(request) {
        try {
            const { analysisId, analysis, executionConfig = {} } = await request.json();
            if (!analysis && !analysisId) {
                const body = ApiResponseFactory.error('Analysis or analysis ID is required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Use provided analysis or fetch by ID (mock implementation)
            const analysisData = analysis || {
                portfolioId: 'mock_portfolio',
                strategyId: 'mock_strategy',
                recommendedTrades: [
                    {
                        asset: 'AAPL',
                        direction: 'sell',
                        targetWeight: 0.20,
                        currentValue: 50000,
                        shares: 285,
                        priority: 85
                    }
                ]
            };
            const execution = await this.rebalancingEngine.executeRebalancing(analysisData, executionConfig);
            const body = ApiResponseFactory.success(execution);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Rebalancing execution failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'REBALANCING_EXECUTION_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle portfolio monitoring
     */
    async handlePortfolioMonitoring(request) {
        try {
            const { portfolioId, targetWeights, strategyId } = await request.json();
            if (!portfolioId || !targetWeights || !strategyId) {
                const body = ApiResponseFactory.error('Portfolio ID, target weights, and strategy ID are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            // Get strategy (mock implementation)
            const strategy = {
                id: strategyId,
                thresholds: { deviation: 0.05 },
                constraints: {}
            };
            const monitoring = await this.rebalancingEngine.monitorPortfolioDrift(portfolioId, targetWeights, strategy);
            const body = ApiResponseFactory.success(monitoring);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Portfolio monitoring failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'PORTFOLIO_MONITORING_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle tax-loss harvesting
     */
    async handleTaxLossHarvesting(request) {
        try {
            const { portfolioId, taxConfig = {} } = await request.json();
            if (!portfolioId) {
                const body = ApiResponseFactory.error('Portfolio ID is required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            const harvesting = await this.rebalancingEngine.performTaxLossHarvesting(portfolioId, taxConfig);
            const body = ApiResponseFactory.success(harvesting);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Tax-loss harvesting failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'TAX_LOSS_HARVESTING_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle dynamic asset allocation
     */
    async handleDynamicAllocation(request) {
        try {
            const { portfolioId, marketConditions, riskTolerance } = await request.json();
            if (!portfolioId || !marketConditions || !riskTolerance) {
                const body = ApiResponseFactory.error('Portfolio ID, market conditions, and risk tolerance are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            const allocation = await this.rebalancingEngine.createDynamicAllocation(portfolioId, marketConditions, riskTolerance);
            const body = ApiResponseFactory.success(allocation);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Dynamic allocation failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'DYNAMIC_ALLOCATION_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle rebalancing stress testing
     */
    async handleRebalancingStressTesting(request) {
        try {
            const { portfolioId, strategies, scenarios = [] } = await request.json();
            if (!portfolioId || !strategies) {
                const body = ApiResponseFactory.error('Portfolio ID and strategies are required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            const stressTest = await this.rebalancingEngine.performRebalancingStressTest(portfolioId, strategies, scenarios);
            const body = ApiResponseFactory.success(stressTest);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Rebalancing stress testing failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'REBALANCING_STRESS_TESTING_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
    /**
     * Handle portfolio analytics overview
     */
    async handlePortfolioAnalytics(request) {
        try {
            const { symbols, lookbackPeriod = 252, includeOptimization = true, includeStressTest = true } = await request.json();
            if (!symbols || !Array.isArray(symbols) || symbols.length < 2) {
                const body = ApiResponseFactory.error('At least 2 symbols required', 'INVALID_REQUEST');
                return new Response(JSON.stringify(body), { status: 400 });
            }
            const analytics = {
                symbols,
                lookbackPeriod,
                timestamp: new Date().toISOString()
            };
            // Correlation analysis
            analytics.correlation = await this.correlationEngine.calculateCorrelationMatrix(symbols, lookbackPeriod);
            // Efficient frontier
            analytics.efficientFrontier = await this.correlationEngine.calculateEfficientFrontier(symbols, 50);
            if (includeOptimization) {
                // Multiple optimization scenarios
                const objectives = ['MAX_SHARPE', 'MIN_VOLATILITY', 'EQUAL_WEIGHT', 'RISK_PARITY'];
                analytics.optimizations = {};
                for (const objective of objectives) {
                    const covarianceResult = await this.correlationEngine.calculateCovarianceMatrix(symbols, lookbackPeriod);
                    const expectedReturns = await this.correlationEngine.calculateExpectedReturns(symbols);
                    const optimization = await this.correlationEngine.optimizePortfolio(symbols, expectedReturns, covarianceResult.covarianceMatrix, objective);
                    const riskMetrics = await this.correlationEngine.calculatePortfolioRiskMetrics(optimization.weights, covarianceResult.covarianceMatrix, expectedReturns);
                    analytics.optimizations[objective] = {
                        optimization,
                        riskMetrics
                    };
                }
            }
            const body = ApiResponseFactory.success(analytics);
            return new Response(JSON.stringify(body), { status: 200 });
        }
        catch (error) {
            console.error('Portfolio analytics failed:', error);
            const body = ApiResponseFactory.error((error instanceof Error ? error.message : String(error)), 'PORTFOLIO_ANALYTICS_FAILED');
            return new Response(JSON.stringify(body), { status: 500 });
        }
    }
}
/**
 * Route handler for portfolio endpoints
 */
export async function handlePortfolioRequest(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/v1', ''); // Remove /api/v1 prefix
    const handler = new PortfolioRoutesHandler(env);
    try {
        switch (path) {
            case '/portfolio/correlation':
                if (request.method === 'POST') {
                    return await handler.handleCorrelationAnalysis(request);
                }
                break;
            case '/portfolio/optimize':
                if (request.method === 'POST') {
                    return await handler.handlePortfolioOptimization(request);
                }
                break;
            case '/portfolio/efficient-frontier':
                if (request.method === 'POST') {
                    return await handler.handleEfficientFrontier(request);
                }
                break;
            case '/portfolio/risk-metrics':
                if (request.method === 'POST') {
                    return await handler.handlePortfolioRiskMetrics(request);
                }
                break;
            case '/portfolio/stress-test':
                if (request.method === 'POST') {
                    return await handler.handleStressTesting(request);
                }
                break;
            case '/portfolio/attribution':
                if (request.method === 'POST') {
                    return await handler.handlePerformanceAttribution(request);
                }
                break;
            case '/portfolio/rebalancing/strategy':
                if (request.method === 'POST') {
                    return await handler.handleCreateRebalancingStrategy(request);
                }
                break;
            case '/portfolio/rebalancing/analyze':
                if (request.method === 'POST') {
                    return await handler.handleRebalancingAnalysis(request);
                }
                break;
            case '/portfolio/rebalancing/execute':
                if (request.method === 'POST') {
                    return await handler.handleRebalancingExecution(request);
                }
                break;
            case '/portfolio/rebalancing/monitor':
                if (request.method === 'POST') {
                    return await handler.handlePortfolioMonitoring(request);
                }
                break;
            case '/portfolio/rebalancing/tax-harvest':
                if (request.method === 'POST') {
                    return await handler.handleTaxLossHarvesting(request);
                }
                break;
            case '/portfolio/rebalancing/dynamic-allocation':
                if (request.method === 'POST') {
                    return await handler.handleDynamicAllocation(request);
                }
                break;
            case '/portfolio/rebalancing/stress-test':
                if (request.method === 'POST') {
                    return await handler.handleRebalancingStressTesting(request);
                }
                break;
            case '/portfolio/analytics':
                if (request.method === 'POST') {
                    return await handler.handlePortfolioAnalytics(request);
                }
                break;
            default:
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Not Found',
                    message: `Portfolio endpoint ${path} not found`,
                    availableEndpoints: [
                        'POST /portfolio/correlation',
                        'POST /portfolio/optimize',
                        'POST /portfolio/efficient-frontier',
                        'POST /portfolio/risk-metrics',
                        'POST /portfolio/stress-test',
                        'POST /portfolio/attribution',
                        'POST /portfolio/rebalancing/strategy',
                        'POST /portfolio/rebalancing/analyze',
                        'POST /portfolio/rebalancing/execute',
                        'POST /portfolio/rebalancing/monitor',
                        'POST /portfolio/rebalancing/tax-harvest',
                        'POST /portfolio/rebalancing/dynamic-allocation',
                        'POST /portfolio/rebalancing/stress-test',
                        'POST /portfolio/analytics'
                    ]
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    }
    catch (error) {
        console.error('Portfolio request error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal Server Error',
            message: (error instanceof Error ? error.message : String(error)),
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    return new Response(JSON.stringify({
        success: false,
        error: 'Method Not Allowed',
        message: `Method ${request.method} not allowed for ${path}`,
        timestamp: new Date().toISOString()
    }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
    });
}
//# sourceMappingURL=portfolio-routes.js.map