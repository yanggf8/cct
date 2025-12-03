/**
 * Risk Management API Routes
 * API endpoints for advanced risk assessment and monitoring
 * Phase 2D: Advanced Risk Management & Regulatory Compliance
 */
/**
 * Risk Management Routes Handler
 */
export declare class RiskManagementRoutesHandler {
    private env;
    private riskEngine;
    private complianceEngine;
    constructor(env: any);
    /**
     * Handle risk assessment request
     * POST /api/v1/risk/assessment
     */
    handleRiskAssessment(request: any): Promise<Response>;
    /**
     * Handle market risk assessment
     * POST /api/v1/risk/market
     */
    handleMarketRiskAssessment(request: any): Promise<Response>;
    /**
     * Handle concentration risk assessment
     * POST /api/v1/risk/concentration
     */
    handleConcentrationRiskAssessment(request: any): Promise<Response>;
    /**
     * Handle liquidity risk assessment
     * POST /api/v1/risk/liquidity
     */
    handleLiquidityRiskAssessment(request: any): Promise<Response>;
    /**
     * Handle stress testing
     * POST /api/v1/risk/stress-test
     */
    handleStressTest(request: any): Promise<Response>;
    /**
     * Handle compliance assessment
     * POST /api/v1/risk/compliance
     */
    handleComplianceAssessment(request: any): Promise<Response>;
    /**
     * Handle regulatory report generation
     * POST /api/v1/risk/regulatory-report
     */
    handleRegulatoryReport(request: any): Promise<Response>;
    /**
     * Handle risk limits check
     * POST /api/v1/risk/limits
     */
    handleRiskLimitsCheck(request: any): Promise<Response>;
    /**
     * Handle risk analytics
     * POST /api/v1/risk/analytics
     */
    handleRiskAnalytics(request: any): Promise<Response>;
    /**
     * Handle risk health check
     * GET /api/v1/risk/health
     */
    handleRiskHealthCheck(request: any): Promise<Response>;
}
/**
 * Main risk management request router
 */
export declare function handleRiskManagementRequest(request: any, env: any, ctx: any): Promise<Response>;
//# sourceMappingURL=risk-management-routes.d.ts.map