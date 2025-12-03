/**
 * Portfolio Rebalancing Strategies Module
 * Institutional-grade portfolio rebalancing and maintenance strategies
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */
interface PortfolioStrategy {
    id: string;
    name: string;
    type: string;
    portfolioId: string;
    targetWeights: Record<string, number>;
    thresholds: Record<string, number>;
    frequency: string;
    constraints: Record<string, any>;
    executionConfig: Record<string, any>;
    monitoringConfig: Record<string, any>;
    taxConfig: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    status: string;
    version: string;
    lastRebalanceDate?: Date;
}
interface RebalancingAnalysis {
    portfolioId: string;
    strategyId: string;
    currentWeights: Record<string, number>;
    targetWeights: Record<string, number>;
    analysisDate: string;
    rebalancingRequired: boolean;
    deviations: Record<string, {
        currentWeight: number;
        targetWeight: number;
        deviation: number;
        deviationPercent: number;
        absoluteDeviation: number;
    }>;
    recommendedTrades: any[];
    estimatedCosts: any;
    taxImplications: any;
    executionPlan: any;
    analysisId?: string;
}
interface Execution {
    id: string;
    analysisId: string;
    portfolioId: string;
    strategyId: string;
    trades: any[];
    status: string;
    startedAt: string;
    completedAt: string | null;
    totalCost: number;
    totalTax: number;
    netPortfolioValue: number;
    executionResults: Record<string, any>;
}
interface Monitoring {
    portfolioId: string;
    strategyId: string;
    monitoringDate: string;
    currentWeights: Record<string, number>;
    driftMetrics: any;
    alerts: any[];
    recommendations: any[];
}
interface TaxHarvesting {
    portfolioId: string;
    harvestingDate: string;
    taxYear: number;
    positions: any[];
    opportunities: any[];
    executedTrades: any[];
    taxBenefits: any;
    washSaleRisks: any[];
}
interface DynamicAllocation {
    portfolioId: string;
    allocationDate: string;
    marketConditions: any;
    riskTolerance: any;
    dynamicWeights: Record<string, number>;
    allocationSignals: any;
    riskAdjustments: any;
    executionPlan: any;
}
interface StressTest {
    portfolioId: string;
    testDate: string;
    strategies: any[];
    scenarios: any[];
    results: Record<string, any>;
    recommendations: any;
}
export declare const REBALANCING_NAMESPACES: {
    STRATEGIES: string;
    SCHEDULES: string;
    EXECUTION: string;
    MONITORING: string;
    ALERTS: string;
    HISTORY: string;
};
export declare const REBALANCING_TTL: {
    STRATEGY_CACHE: number;
    SCHEDULE_CACHE: number;
    EXECUTION_CACHE: number;
    MONITORING_CACHE: number;
    ALERT_CACHE: number;
    HISTORY_CACHE: number;
};
/**
 * Rebalancing Strategy Types
 */
export declare const REBALANCING_STRATEGIES: {
    TIME_BASED: string;
    THRESHOLD_BASED: string;
    VOLATILITY_TARGET: string;
    DRIFT_CONTROL: string;
    OPPORTUNISTIC: string;
    TAX_LOSS_HARVESTING: string;
    RISK_PARITY: string;
    DYNAMIC_ASSET_ALLOCATION: string;
};
/**
 * Portfolio Rebalancing Engine
 */
export declare class PortfolioRebalancingEngine {
    private env;
    private correlationEngine;
    private transactionCosts;
    private minTradeSize;
    private maxDeviation;
    constructor(env: any);
    /**
     * Create rebalancing strategy
     */
    createRebalancingStrategy(config: any): Promise<PortfolioStrategy>;
    /**
     * Analyze portfolio for rebalancing needs
     */
    analyzeRebalancingNeeds(portfolioId: string, currentWeights: Record<string, number>, targetWeights: Record<string, number>, strategy: PortfolioStrategy): Promise<RebalancingAnalysis>;
    /**
     * Execute rebalancing trades
     */
    executeRebalancing(analysis: RebalancingAnalysis, executionConfig?: any): Promise<Execution>;
    /**
     * Monitor portfolio drift
     */
    monitorPortfolioDrift(portfolioId: string, targetWeights: Record<string, number>, strategy: PortfolioStrategy): Promise<Monitoring>;
    /**
     * Perform tax-loss harvesting
     */
    performTaxLossHarvesting(portfolioId: string, taxConfig?: any): Promise<TaxHarvesting>;
    /**
     * Create dynamic asset allocation
     */
    createDynamicAllocation(portfolioId: string, marketConditions: any, riskTolerance: any): Promise<DynamicAllocation>;
    /**
     * Perform portfolio stress test for rebalancing
     */
    performRebalancingStressTest(portfolioId: string, strategies: PortfolioStrategy[], scenarios?: any[]): Promise<StressTest>;
    generateStrategyId(): string;
    generateExecutionId(): string;
    validateStrategy(strategy: PortfolioStrategy): void;
    isRebalancingRequired(deviations: any, strategy: PortfolioStrategy): boolean;
    generateTrades(analysis: RebalancingAnalysis, strategy: PortfolioStrategy): Promise<any[]>;
    calculateTradePriority(deviation: any, strategy: PortfolioStrategy): number;
    calculateTradingCosts(trades: any[]): Promise<any>;
    calculateMarketImpactCost(trades: any[]): number;
    calculateBidAskSpreadCost(trades: any[]): number;
    analyzeTaxImplications(trades: any[], strategy: PortfolioStrategy): Promise<any>;
    createExecutionPlan(analysis: RebalancingAnalysis, strategy: PortfolioStrategy): Promise<any>;
    calculateBatchSizes(trades: any[]): any[][];
    prioritizeTrades(trades: any[], executionConfig: any): any[];
    executeTrade(trade: any, executionConfig: any): Promise<any>;
    calculatePortfolioValue(portfolioId: string, trades: any[]): Promise<number>;
    getCurrentPortfolioWeights(portfolioId: string): Promise<Record<string, number>>;
    calculateDriftMetrics(currentWeights: Record<string, number>, targetWeights: Record<string, number>): any;
    generateDriftAlerts(driftMetrics: any, strategy: PortfolioStrategy): any[];
    generateRecommendations(monitoring: Monitoring, strategy: PortfolioStrategy): any[];
    getPortfolioPositions(portfolioId: string): Promise<any[]>;
    identifyHarvestingOpportunities(positions: any[], taxConfig: any): any[];
    executeHarvestTrade(opportunity: any, taxConfig: any): Promise<any>;
    calculateTaxBenefits(executedTrades: any[]): Promise<any>;
    identifyWashSaleRisks(executedTrades: any[]): any[];
    shouldTimeBasedRebalance(strategy: PortfolioStrategy): boolean;
    shouldVolatilityRebalance(deviations: any, strategy: PortfolioStrategy): boolean;
    shouldControlDrift(deviations: any, strategy: PortfolioStrategy): boolean;
    getDefaultScenarios(): any[];
    testStrategyUnderStress(portfolioId: string, strategy: PortfolioStrategy, scenarios: any[]): Promise<any>;
    applyStressScenario(weights: Record<string, number>, scenario: any): Record<string, number>;
    calculateStressedMetrics(weights: Record<string, number>, scenario: any): Promise<any>;
    generateStressTestRecommendations(results: Record<string, any>): any[];
    persistStrategy(strategy: PortfolioStrategy): Promise<void>;
    persistRebalancingAnalysis(analysis: RebalancingAnalysis): Promise<void>;
    persistExecution(execution: Execution): Promise<void>;
    persistMonitoring(monitoring: Monitoring): Promise<void>;
    persistTaxHarvesting(harvesting: TaxHarvesting): Promise<void>;
    persistDynamicAllocation(allocation: DynamicAllocation): Promise<void>;
    persistStressTest(stressTest: StressTest): Promise<void>;
    updateStrategyMetrics(strategyId: string, execution: Execution): Promise<void>;
    analyzeMarketConditions(marketConditions: any): Promise<any>;
    generateAllocationSignals(marketAnalysis: any, riskTolerance: any): any;
    calculateDynamicWeights(allocationSignals: any, riskTolerance: any): Record<string, number>;
    applyRiskAdjustments(dynamicWeights: Record<string, number>, marketAnalysis: any): Record<string, number>;
    createAllocationExecutionPlan(allocation: DynamicAllocation): Promise<any>;
}
/**
 * Factory function for creating rebalancing engine instances
 */
export declare function createPortfolioRebalancingEngine(env: any): PortfolioRebalancingEngine;
/**
 * Utility functions for portfolio rebalancing
 */
export declare function createRebalancingStrategy(env: any, config: any): Promise<PortfolioStrategy>;
export declare function analyzeRebalancingNeeds(env: any, portfolioId: string, currentWeights: Record<string, number>, targetWeights: Record<string, number>, strategy: PortfolioStrategy): Promise<RebalancingAnalysis>;
export declare function executeRebalancing(env: any, analysis: RebalancingAnalysis, executionConfig: any): Promise<Execution>;
export {};
//# sourceMappingURL=portfolio-rebalancing.d.ts.map