/**
 * Advanced Risk Management Engine
 * Enterprise-grade risk assessment and monitoring system
 * Phase 2D: Advanced Risk Management & Regulatory Compliance
 */
interface CloudflareEnvironment {
    AI: any;
    MARKET_ANALYSIS_CACHE: KVNamespace;
    [key: string]: any;
}
interface PortfolioData {
    portfolioId: string;
    weights?: Record<string, number>;
    betas?: Record<string, number>;
    totalValue?: number;
    volatility?: number;
    correlationMatrix?: {
        matrix: number[][];
    };
}
interface MarketData {
    vix?: number;
    regime?: string;
    [key: string]: any;
}
interface MarketRiskMetrics {
    var95?: number;
    var99?: number;
    cvar95?: number;
    cvar99?: number;
    portfolioBeta?: number;
    systematicRisk?: number;
    rollingVolatility?: number;
    volatilityRegime?: string;
    averageCorrelation?: number;
    correlationRisk?: string;
}
interface CreditRiskMetrics {
    creditSpreadRisk?: number;
    defaultProbability?: number;
    creditVaR?: number;
    counterpartyRisk?: number;
}
interface CreditRiskExposures {
    ratingDistribution?: Record<string, number>;
    sectorExposure?: Record<string, number>;
}
interface ConcentrationRiskMetrics {
    maxSingleAssetWeight?: number;
    top5Concentration?: number;
    top10Concentration?: number;
    maxSectorWeight?: number;
    herfindahlIndex?: number;
    maxGeographicWeight?: number;
}
interface ConcentrationRiskConcentrations {
    sectorWeights?: Record<string, number>;
    geographicWeights?: Record<string, number>;
    currencyWeights?: Record<string, number>;
}
interface LiquidityRiskMetrics {
    averageDailyVolume?: number;
    liquidityRatio?: number;
    bidAskSpread?: number;
    marketImpact?: number;
    liquidationTime?: number;
}
interface LiquidityRiskFactors {
    fundingLiquidity?: number;
    contingentLiquidity?: number;
}
interface ModelRiskMetrics {
    modelAccuracy?: number;
    backtestResults?: any;
    modelStability?: number;
}
interface ModelRiskModels {
    activeModels?: string[];
    modelDependencies?: any;
}
interface RiskCategory {
    category: string;
    metrics: MarketRiskMetrics | CreditRiskMetrics | ConcentrationRiskMetrics | LiquidityRiskMetrics | ModelRiskMetrics;
    score: number;
    level: typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
    factors?: any;
    exposures?: CreditRiskExposures;
    concentrations?: ConcentrationRiskConcentrations;
    models?: ModelRiskModels;
    error?: string;
}
interface CategoryBreakdown {
    marketRisk?: RiskCategory;
    creditRisk?: RiskCategory;
    concentrationRisk?: RiskCategory;
    liquidityRisk?: RiskCategory;
    modelRisk?: RiskCategory;
}
interface RiskLimitCheck {
    breached: any[];
    withinLimits: any[];
}
interface RiskAssessment {
    id: string;
    portfolioId: string;
    assessmentDate: string;
    riskScores: Record<string, number>;
    overallRiskScore: number;
    riskLevel: typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
    categoryBreakdown: CategoryBreakdown;
    recommendations: any[];
    stressTestResults: Record<string, any>;
    complianceStatus: Record<string, any>;
    riskLimits: RiskLimitCheck;
    alerts: any[];
}
interface StressTest {
    id: string;
    portfolioId: string;
    testDate: string;
    scenarios: Record<string, any>;
    aggregateResults: any;
    worstCaseScenario: any;
    recommendations: any[];
}
interface ComplianceCheck {
    id: string;
    portfolioId: string;
    checkDate: string;
    frameworks: Record<string, any>;
    overallCompliance: boolean;
    violations: any[];
    recommendations: any[];
}
export declare const RISK_NAMESPACES: {
    RISK_ASSESSMENTS: string;
    STRESS_TESTS: string;
    COMPLIANCE_CHECKS: string;
    RISK_LIMITS: string;
    ALERTS: string;
    REPORTS: string;
};
export declare const RISK_TTL: {
    ASSESSMENT_CACHE: number;
    STRESS_TEST_CACHE: number;
    COMPLIANCE_CACHE: number;
    LIMITS_CACHE: number;
    ALERTS_CACHE: number;
    REPORTS_CACHE: number;
};
/**
 * Risk Categories and Types
 */
export declare const RISK_CATEGORIES: {
    MARKET_RISK: string;
    CREDIT_RISK: string;
    OPERATIONAL_RISK: string;
    LIQUIDITY_RISK: string;
    CONCENTRATION_RISK: string;
    MODEL_RISK: string;
    REGULATORY_RISK: string;
    REPUTATIONAL_RISK: string;
};
export declare const RISK_LEVELS: {
    LOW: {
        value: number;
        color: string;
        label: string;
    };
    MEDIUM: {
        value: number;
        color: string;
        label: string;
    };
    HIGH: {
        value: number;
        color: string;
        label: string;
    };
    CRITICAL: {
        value: number;
        color: string;
        label: string;
    };
};
/**
 * Advanced Risk Management Engine
 */
export declare class AdvancedRiskManagementEngine {
    private env;
    private riskLimits;
    private complianceFrameworks;
    private alertThresholds;
    constructor(env: CloudflareEnvironment);
    /**
     * Perform comprehensive risk assessment
     */
    performRiskAssessment(portfolioData: PortfolioData, marketData?: MarketData): Promise<RiskAssessment>;
    /**
     * Assess market risk
     */
    assessMarketRisk(portfolioData: PortfolioData, marketData: MarketData): Promise<RiskCategory>;
    /**
     * Assess credit risk
     */
    assessCreditRisk(portfolioData: PortfolioData): Promise<RiskCategory>;
    /**
     * Assess concentration risk
     */
    assessConcentrationRisk(portfolioData: PortfolioData): Promise<RiskCategory>;
    /**
     * Assess liquidity risk
     */
    assessLiquidityRisk(portfolioData: PortfolioData, marketData: MarketData): Promise<RiskCategory>;
    /**
     * Assess model risk
     */
    assessModelRisk(portfolioData: PortfolioData): Promise<RiskCategory>;
    /**
     * Perform advanced stress testing
     */
    performAdvancedStressTest(portfolioData: PortfolioData, scenarios?: any[]): Promise<StressTest>;
    /**
     * Assess regulatory compliance
     */
    checkRegulatoryCompliance(portfolioData: PortfolioData, regulations?: string[]): Promise<ComplianceCheck>;
    generateAssessmentId(): string;
    generateStressTestId(): string;
    generateComplianceId(): string;
    initializeRiskLimits(): {
        maxVaR: number;
        maxConcentration: number;
        maxSectorWeight: number;
        maxLeverage: number;
        minLiquidityRatio: number;
        maxCorrelation: number;
    };
    initializeComplianceFrameworks(): {
        SEC: {
            name: string;
            rules: string[];
            checks: string[];
        };
        FINRA: {
            name: string;
            rules: string[];
            checks: string[];
        };
        MiFID_II: {
            name: string;
            rules: string[];
            checks: string[];
        };
        Basel_III: {
            name: string;
            rules: string[];
            checks: string[];
        };
    };
    initializeAlertThresholds(): {
        riskScore: {
            high: number;
            critical: number;
        };
        varLimit: {
            high: number;
            critical: number;
        };
        concentration: {
            high: number;
            critical: number;
        };
        correlation: {
            high: number;
            critical: number;
        };
        liquidity: {
            high: number;
            critical: number;
        };
    };
    calculateVaR(portfolioData: PortfolioData, confidenceLevel: number): number;
    calculateCVaR(portfolioData: PortfolioData, confidenceLevel: number): number;
    calculatePortfolioBeta(portfolioData: PortfolioData): number;
    calculateSystematicRisk(portfolioData: PortfolioData): number;
    calculateRollingVolatility(portfolioData: PortfolioData): number;
    assessVolatilityRegime(marketData: MarketData): string;
    calculateAverageCorrelation(portfolioData: PortfolioData): number;
    assessCorrelationRisk(portfolioData: PortfolioData): string;
    calculateFactorExposures(portfolioData: PortfolioData, marketData: MarketData): any;
    calculateSizeFactor(weights: Record<string, number>): number;
    calculateValueFactor(weights: Record<string, number>): number;
    calculateMomentumFactor(weights: Record<string, number>): number;
    calculateQualityFactor(weights: Record<string, number>): number;
    calculateVolatilityFactor(weights: Record<string, number>): number;
    calculateMarketRiskScore(metrics: MarketRiskMetrics, factors: any): number;
    calculateCreditRiskScore(metrics: CreditRiskMetrics, exposures: CreditRiskExposures): number;
    calculateConcentrationRiskScore(metrics: ConcentrationRiskMetrics, concentrations: ConcentrationRiskConcentrations): number;
    calculateLiquidityRiskScore(metrics: LiquidityRiskMetrics, factors: LiquidityRiskFactors): number;
    calculateModelRiskScore(metrics: ModelRiskMetrics, models: ModelRiskModels): number;
    calculateOverallRiskScore(categoryBreakdown: CategoryBreakdown): number;
    determineRiskLevel(score: number): typeof RISK_LEVELS[keyof typeof RISK_LEVELS];
    generateRiskRecommendations(categoryBreakdown: CategoryBreakdown, riskLevel: typeof RISK_LEVELS[keyof typeof RISK_LEVELS]): any[];
    getSuggestedActions(category: string, assessment: RiskCategory): string[];
    checkRiskLimits(assessment: RiskAssessment): Promise<RiskLimitCheck>;
    generateRiskAlerts(assessment: RiskAssessment): any[];
    calculateTopNConcentration(weights: Record<string, number>, n: number): number;
    calculateHerfindahlIndex(weights: Record<string, number>): number;
    calculateSectorWeights(portfolioData: PortfolioData): Record<string, number>;
    calculateGeographicWeights(portfolioData: PortfolioData): Record<string, number>;
    calculateCurrencyWeights(portfolioData: PortfolioData): Record<string, number>;
    getDefaultStressScenarios(): any[];
    runStressScenario(portfolioData: PortfolioData, scenario: any): Promise<any>;
    calculateAggregateStressResults(scenarios: Record<string, any>): any;
    identifyWorstCaseScenario(scenarios: Record<string, any>): any;
    generateStressTestRecommendations(stressTest: StressTest): any[];
    checkComplianceFramework(portfolioData: PortfolioData, framework: string): Promise<any>;
    performComplianceCheck(portfolioData: PortfolioData, framework: string, check: string): Promise<any>;
    generateComplianceRecommendations(complianceCheck: ComplianceCheck): any[];
    calculateCreditSpreadRisk(portfolioData: PortfolioData): number;
    calculateDefaultProbability(portfolioData: PortfolioData): number;
    calculateCreditVaR(portfolioData: PortfolioData): number;
    assessCounterpartyRisk(portfolioData: PortfolioData): number;
    getCreditRatingDistribution(portfolioData: PortfolioData): Record<string, number>;
    getCreditSectorExposure(portfolioData: PortfolioData): Record<string, number>;
    calculateAverageDailyVolume(portfolioData: PortfolioData): number;
    calculateLiquidityRatio(portfolioData: PortfolioData): number;
    calculateAverageBidAskSpread(portfolioData: PortfolioData): number;
    estimateMarketImpact(portfolioData: PortfolioData): number;
    estimateLiquidationTime(portfolioData: PortfolioData): number;
    assessFundingLiquidity(portfolioData: PortfolioData): number;
    assessContingentLiquidity(portfolioData: PortfolioData): number;
    assessModelAccuracy(portfolioData: PortfolioData): number;
    performModelBacktest(portfolioData: PortfolioData): any;
    assessModelStability(portfolioData: PortfolioData): number;
    getActiveModelInventory(portfolioData: PortfolioData): string[];
    assessModelDependencies(portfolioData: PortfolioData): any;
    persistRiskAssessment(assessment: RiskAssessment): Promise<void>;
    persistStressTest(stressTest: StressTest): Promise<void>;
    persistComplianceCheck(complianceCheck: ComplianceCheck): Promise<void>;
}
/**
 * Factory function for creating risk management engine instances
 */
export declare function createAdvancedRiskManagementEngine(env: any): AdvancedRiskManagementEngine;
/**
 * Utility functions for risk management
 */
export declare function performRiskAssessment(env: CloudflareEnvironment, portfolioData: PortfolioData, marketData: MarketData): Promise<RiskAssessment>;
export declare function performStressTest(env: CloudflareEnvironment, portfolioData: PortfolioData, scenarios: any[]): Promise<StressTest>;
export declare function checkCompliance(env: CloudflareEnvironment, portfolioData: PortfolioData, regulations: string[]): Promise<ComplianceCheck>;
export {};
//# sourceMappingURL=advanced-risk-management.d.ts.map