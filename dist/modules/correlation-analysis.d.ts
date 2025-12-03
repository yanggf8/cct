/**
 * Multi-Asset Correlation Analysis Engine
 * Institutional-grade correlation analysis and portfolio optimization
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */
export declare const CORRELATION_NAMESPACES: {
    CORRELATION_MATRICES: string;
    COVARIANCE_MATRICES: string;
    EFFICIENT_FRONTIERS: string;
    OPTIMAL_PORTFOLIOS: string;
    RISK_METRICS: string;
    ATTRIBUTION: string;
};
export declare const CORRELATION_TTL: {
    CORRELATION_CACHE: number;
    COVARIANCE_CACHE: number;
    FRONTIER_CACHE: number;
    PORTFOLIO_CACHE: number;
    RISK_CACHE: number;
    ATTRIBUTION_CACHE: number;
};
/**
 * Correlation Analysis Engine
 */
export declare class CorrelationAnalysisEngine {
    private env;
    private calculationCache;
    private riskFreeRate;
    constructor(env: any);
    /**
     * Calculate correlation matrix for multiple assets
     */
    calculateCorrelationMatrix(symbols: string[], lookbackPeriod?: number): Promise<any>;
    /**
     * Calculate covariance matrix
     */
    calculateCovarianceMatrix(symbols: string[], lookbackPeriod?: number): Promise<any>;
    /**
     * Calculate efficient frontier
     */
    calculateEfficientFrontier(symbols: string[], numPortfolios?: number): Promise<any>;
    /**
     * Optimize portfolio for different objectives
     */
    optimizePortfolio(symbols: string[], expectedReturns: any, covarianceMatrix: any, objective: string, constraints?: any): Promise<{
        success: boolean;
        weights: any[];
        objective: string;
        expectedReturn: any;
        volatility: number;
        sharpeRatio: number;
    }>;
    /**
     * Calculate portfolio risk metrics
     */
    calculatePortfolioRiskMetrics(weights: number[], covarianceMatrix: any, expectedReturns: number[]): Promise<{
        portfolioVariance: number;
        portfolioVolatility: number;
        portfolioExpectedReturn: number;
        sharpeRatio: number;
        informationRatio: number;
        var95: number;
        cvar95: number;
        maxDrawdown: number;
        diversificationRatio: number;
        riskFreeRate: number;
        calculatedAt: string;
    }>;
    /**
     * Perform stress testing on portfolio
     */
    performStressTest(weights: number[], covarianceMatrix: any, scenarios?: any[]): Promise<{
        scenarios: any[];
        worstCase: any;
        bestCase: any;
        averageImpact: number;
        calculatedAt: string;
    }>;
    /**
     * Calculate portfolio performance attribution
     */
    calculatePerformanceAttribution(weights: number[], benchmarkWeights: number[], returns: number[], factorReturns?: any): Promise<{
        portfolioReturn: number;
        benchmarkReturn: number;
        activeReturn: number;
        allocationEffect: number;
        selectionEffect: number;
        factorAttribution: {
            factors: any;
            total: number;
        };
        totalAttribution: number;
        calculatedAt: string;
    }>;
    fetchHistoricalData(symbols: string[], lookbackPeriod: number): Promise<any>;
    /**
     * Generate estimated price data as fallback with transparency
     * Better than mock data as it's based on realistic market patterns
     */
    generateEstimatedPriceData(symbol: string, startDate: Date, days: number): any[];
    calculateReturns(priceData: any): any;
    computeCorrelationMatrix(returns: any): {
        symbols: string[];
        matrix: any[][];
        averageCorrelation: number;
    };
    calculateCorrelation(returns1: number[], returns2: number[]): number;
    calculateAverageCorrelation(matrix: number[][]): number;
    calculateVolatilities(symbols: string[], lookbackPeriod?: number): Promise<any>;
    convertToCovarianceMatrix(correlationMatrix: any, volatilities: any): {
        symbols: any;
        covarianceMatrix: any[][];
        volatilities: any;
    };
    calculateExpectedReturns(symbols: string[]): Promise<number[]>;
    maximizeSharpeRatio(symbols: string[], expectedReturns: number[], covarianceMatrix: any, constraints: any): {
        success: boolean;
        weights: any[];
        objective: string;
        expectedReturn: number;
        volatility: number;
        sharpeRatio: number;
    };
    minimizeVolatility(symbols: string[], expectedReturns: number[], covarianceMatrix: any, constraints: any): {
        success: boolean;
        weights: any[];
        objective: string;
        expectedReturn: any;
        volatility: number;
        sharpeRatio: number;
    };
    equalWeightPortfolio(symbols: string[], expectedReturns: number[], covarianceMatrix: any): {
        success: boolean;
        weights: any[];
        objective: string;
        expectedReturn: any;
        volatility: number;
        sharpeRatio: number;
    };
    riskParityPortfolio(symbols: string[], expectedReturns: number[], covarianceMatrix: any): {
        success: boolean;
        weights: any[];
        objective: string;
        expectedReturn: any;
        volatility: number;
        sharpeRatio: number;
    };
    targetReturnPortfolio(symbols: string[], expectedReturns: number[], covarianceMatrix: any, constraints: any): {
        success: boolean;
        weights: number[];
        objective: string;
        targetReturn: any;
        expectedReturn: number;
        volatility: number;
        sharpeRatio: number;
    };
    calculatePortfolioVariance(weights: number[], covarianceMatrix: any): number;
    calculateVaR(expectedReturn: number, volatility: number, confidenceLevel: number): number;
    calculateCVaR(expectedReturn: number, volatility: number, confidenceLevel: number): number;
    getZScore(confidenceLevel: number): 1.645 | 2.326;
    estimateMaxDrawdown(volatility: number, expectedReturn: number): number;
    calculateDiversificationRatio(weights: number[], covarianceMatrix: any): number;
    applyStressScenario(weights: number[], shock: number): number;
    calculateAllocationEffect(weights: number[], benchmarkWeights: number[], returns: number[]): number;
    calculateSelectionEffect(weights: number[], benchmarkWeights: number[], returns: number[]): number;
    calculateFactorAttribution(weights: number[], factorReturns: any): {
        factors: any;
        total: number;
    };
    persistCorrelationMatrix(key: string, data: any): Promise<void>;
    persistCovarianceMatrix(key: string, data: any): Promise<void>;
    persistEfficientFrontier(key: string, data: any): Promise<void>;
    persistOptimalPortfolio(key: string, data: any): Promise<void>;
    persistRiskMetrics(key: string, data: any): Promise<void>;
    persistAttribution(key: string, data: any): Promise<void>;
    /**
     * Get cached correlation matrix
     */
    getCachedCorrelationMatrix(symbols: string[], lookbackPeriod?: number): Promise<any>;
    /**
     * Get cached efficient frontier
     */
    getCachedEfficientFrontier(symbols: string[], numPortfolios?: number): Promise<any>;
    /**
     * Clear calculation cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        memoryCacheSize: number;
        correlationCacheSize: number;
    };
}
/**
 * Factory function for creating correlation analysis engine instances
 */
export declare function createCorrelationAnalysisEngine(env: any): CorrelationAnalysisEngine;
/**
 * Utility functions for correlation analysis
 */
export declare function getCorrelationMatrix(env: any, symbols: string[], lookbackPeriod?: number): Promise<any>;
export declare function getEfficientFrontier(env: any, symbols: string[], numPortfolios?: number): Promise<any>;
export declare function optimizePortfolio(env: any, symbols: string[], objective?: string, constraints?: any): Promise<{
    success: boolean;
    weights: any[];
    objective: string;
    expectedReturn: any;
    volatility: number;
    sharpeRatio: number;
}>;
//# sourceMappingURL=correlation-analysis.d.ts.map