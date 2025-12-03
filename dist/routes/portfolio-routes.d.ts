/**
 * Portfolio Optimization API Routes
 * Comprehensive portfolio construction, optimization, and rebalancing endpoints
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */
/**
 * Portfolio Routes Handler
 */
export declare class PortfolioRoutesHandler {
    private env;
    private correlationEngine;
    private rebalancingEngine;
    constructor(env: any);
    /**
     * Handle correlation analysis request
     */
    handleCorrelationAnalysis(request: any): Promise<Response>;
    /**
     * Handle portfolio optimization request
     */
    handlePortfolioOptimization(request: any): Promise<Response>;
    /**
     * Handle efficient frontier calculation
     */
    handleEfficientFrontier(request: any): Promise<Response>;
    /**
     * Handle portfolio risk metrics calculation
     */
    handlePortfolioRiskMetrics(request: any): Promise<Response>;
    /**
     * Handle stress testing request
     */
    handleStressTesting(request: any): Promise<Response>;
    /**
     * Handle portfolio performance attribution
     */
    handlePerformanceAttribution(request: any): Promise<Response>;
    /**
     * Handle rebalancing strategy creation
     */
    handleCreateRebalancingStrategy(request: any): Promise<Response>;
    /**
     * Handle rebalancing analysis
     */
    handleRebalancingAnalysis(request: any): Promise<Response>;
    /**
     * Handle rebalancing execution
     */
    handleRebalancingExecution(request: any): Promise<Response>;
    /**
     * Handle portfolio monitoring
     */
    handlePortfolioMonitoring(request: any): Promise<Response>;
    /**
     * Handle tax-loss harvesting
     */
    handleTaxLossHarvesting(request: any): Promise<Response>;
    /**
     * Handle dynamic asset allocation
     */
    handleDynamicAllocation(request: any): Promise<Response>;
    /**
     * Handle rebalancing stress testing
     */
    handleRebalancingStressTesting(request: any): Promise<Response>;
    /**
     * Handle portfolio analytics overview
     */
    handlePortfolioAnalytics(request: any): Promise<Response>;
}
/**
 * Route handler for portfolio endpoints
 */
export declare function handlePortfolioRequest(request: any, env: any, ctx: any): Promise<Response>;
//# sourceMappingURL=portfolio-routes.d.ts.map