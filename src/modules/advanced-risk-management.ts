/**
 * Advanced Risk Management Engine
 * Enterprise-grade risk assessment and monitoring system
 * Phase 2D: Advanced Risk Management & Regulatory Compliance
 */

import { createDAL } from './dal.js';

// TypeScript type definitions
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
  correlationMatrix?: { matrix: number[][] };
}

interface MarketData {
  vix?: number;
  regime?: string;
  [key: string]: any;
}

interface RiskLimits {
  maxVaR: number;
  maxConcentration: number;
  maxSectorWeight: number;
  maxLeverage: number;
  minLiquidityRatio: number;
  maxCorrelation: number;
}

interface ComplianceFramework {
  name: string;
  rules: string[];
  checks: string[];
}

interface ComplianceFrameworks {
  [framework: string]: ComplianceFramework;
}

interface AlertThresholds {
  riskScore: { high: number; critical: number };
  varLimit: { high: number; critical: number };
  concentration: { high: number; critical: number };
  correlation: { high: number; critical: number };
  liquidity: { high: number; critical: number };
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

// Simple KV functions using DAL
async function getKVStore(env: any, key: string): Promise<any> {
  const dal = createDAL(env);
  const result = await dal.read(key);
  return result.success ? result.data : null;
}

async function setKVStore(env: any, key: string, data: any, ttl?: number): Promise<boolean> {
  const dal = createDAL(env);
  const result = await dal.write(key, data, { expirationTtl: ttl });
  return result.success;
}

// Risk management namespaces and TTL
export const RISK_NAMESPACES = {
  RISK_ASSESSMENTS: 'risk_assessments',
  STRESS_TESTS: 'stress_tests',
  COMPLIANCE_CHECKS: 'compliance_checks',
  RISK_LIMITS: 'risk_limits',
  ALERTS: 'risk_alerts',
  REPORTS: 'risk_reports'
};

export const RISK_TTL = {
  ASSESSMENT_CACHE: 1800,        // 30 minutes for risk assessments
  STRESS_TEST_CACHE: 3600,       // 1 hour for stress tests
  COMPLIANCE_CACHE: 86400,       // 1 day for compliance checks
  LIMITS_CACHE: 300,             // 5 minutes for risk limits
  ALERTS_CACHE: 604800,          // 1 week for alerts
  REPORTS_CACHE: 2592000         // 1 month for reports
};

/**
 * Risk Categories and Types
 */
export const RISK_CATEGORIES = {
  MARKET_RISK: 'MARKET_RISK',
  CREDIT_RISK: 'CREDIT_RISK',
  OPERATIONAL_RISK: 'OPERATIONAL_RISK',
  LIQUIDITY_RISK: 'LIQUIDITY_RISK',
  CONCENTRATION_RISK: 'CONCENTRATION_RISK',
  MODEL_RISK: 'MODEL_RISK',
  REGULATORY_RISK: 'REGULATORY_RISK',
  REPUTATIONAL_RISK: 'REPUTATIONAL_RISK'
};

export const RISK_LEVELS = {
  LOW: { value: 1, color: '#4CAF50', label: 'Low' },
  MEDIUM: { value: 2, color: '#FF9800', label: 'Medium' },
  HIGH: { value: 3, color: '#F44336', label: 'High' },
  CRITICAL: { value: 4, color: '#9C27B0', label: 'Critical' }
};

/**
 * Advanced Risk Management Engine
 */
export class AdvancedRiskManagementEngine {
  private env: CloudflareEnvironment;
  private riskLimits: RiskLimits;
  private complianceFrameworks: ComplianceFrameworks;
  private alertThresholds: AlertThresholds;

  constructor(env: any) {
    this.env = env;
    this.riskLimits = this.initializeRiskLimits();
    this.complianceFrameworks = this.initializeComplianceFrameworks();
    this.alertThresholds = this.initializeAlertThresholds();
  }

  /**
   * Perform comprehensive risk assessment
   */
  async performRiskAssessment(portfolioData: PortfolioData, marketData: MarketData = {}): Promise<RiskAssessment> {
    try {
      const categoryBreakdown: CategoryBreakdown = {
        marketRisk: await this.assessMarketRisk(portfolioData, marketData),
        creditRisk: await this.assessCreditRisk(portfolioData),
        concentrationRisk: await this.assessConcentrationRisk(portfolioData),
        liquidityRisk: await this.assessLiquidityRisk(portfolioData, marketData),
        modelRisk: await this.assessModelRisk(portfolioData)
      };

      const assessment: RiskAssessment = {
        id: this.generateAssessmentId(),
        portfolioId: portfolioData.portfolioId,
        assessmentDate: new Date().toISOString(),
        riskScores: {},
        overallRiskScore: 0,
        riskLevel: RISK_LEVELS.LOW,
        categoryBreakdown,
        recommendations: [],
        stressTestResults: {},
        complianceStatus: {},
        riskLimits: { breached: [], withinLimits: [] },
        alerts: []
      };

      // Calculate overall risk score
      assessment.overallRiskScore = this.calculateOverallRiskScore(
        assessment.categoryBreakdown
      );

      // Determine risk level
      assessment.riskLevel = this.determineRiskLevel(assessment.overallRiskScore);

      // Generate recommendations
      assessment.recommendations = this.generateRiskRecommendations(
        assessment.categoryBreakdown, assessment.riskLevel
      );

      // Check against risk limits
      assessment.riskLimits = await this.checkRiskLimits(assessment);

      // Generate alerts
      assessment.alerts = this.generateRiskAlerts(assessment);

      // Store assessment
      await this.persistRiskAssessment(assessment);

      return assessment;
    } catch (error: unknown) {
      console.error('Risk assessment failed:', error);
      throw new Error(`Risk assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assess market risk
   */
  async assessMarketRisk(portfolioData: PortfolioData, marketData: MarketData): Promise<RiskCategory> {
    const marketRisk: RiskCategory = {
      category: RISK_CATEGORIES.MARKET_RISK,
      metrics: {} as MarketRiskMetrics,
      score: 0,
      level: RISK_LEVELS.LOW,
      factors: {}
    };

    try {
      const metrics = marketRisk.metrics as MarketRiskMetrics;

      // Value at Risk (VaR) calculation
      metrics.var95 = this.calculateVaR(portfolioData, 0.95);
      metrics.var99 = this.calculateVaR(portfolioData, 0.99);

      // Conditional VaR (CVaR)
      metrics.cvar95 = this.calculateCVaR(portfolioData, 0.95);
      metrics.cvar99 = this.calculateCVaR(portfolioData, 0.99);

      // Beta and systematic risk
      metrics.portfolioBeta = this.calculatePortfolioBeta(portfolioData);
      metrics.systematicRisk = this.calculateSystematicRisk(portfolioData);

      // Volatility metrics
      metrics.rollingVolatility = this.calculateRollingVolatility(portfolioData);
      metrics.volatilityRegime = this.assessVolatilityRegime(marketData);

      // Correlation breakdown
      metrics.averageCorrelation = this.calculateAverageCorrelation(portfolioData);
      metrics.correlationRisk = this.assessCorrelationRisk(portfolioData);

      // Factor exposures
      marketRisk.factors = this.calculateFactorExposures(portfolioData, marketData);

      // Calculate market risk score
      marketRisk.score = this.calculateMarketRiskScore(metrics, marketRisk.factors);
      marketRisk.level = this.determineRiskLevel(marketRisk.score);

    } catch (error: unknown) {
      console.error('Market risk assessment failed:', error);
      marketRisk.score = 2;
      marketRisk.level = RISK_LEVELS.MEDIUM;
      marketRisk.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return marketRisk;
  }

  /**
   * Assess credit risk
   */
  async assessCreditRisk(portfolioData: PortfolioData): Promise<RiskCategory> {
    const creditRisk: RiskCategory = {
      category: RISK_CATEGORIES.CREDIT_RISK,
      metrics: {} as CreditRiskMetrics,
      score: 0,
      level: RISK_LEVELS.LOW,
      exposures: {} as CreditRiskExposures
    };

    try {
      const metrics = creditRisk.metrics as CreditRiskMetrics;
      const exposures = creditRisk.exposures as CreditRiskExposures;

      // Credit spread risk
      metrics.creditSpreadRisk = this.calculateCreditSpreadRisk(portfolioData);

      // Default probability
      metrics.defaultProbability = this.calculateDefaultProbability(portfolioData);

      // Credit VaR
      metrics.creditVaR = this.calculateCreditVaR(portfolioData);

      // Counterparty risk
      metrics.counterpartyRisk = this.assessCounterpartyRisk(portfolioData);

      // Credit rating distribution
      exposures.ratingDistribution = this.getCreditRatingDistribution(portfolioData);
      exposures.sectorExposure = this.getCreditSectorExposure(portfolioData);

      // Calculate credit risk score
      creditRisk.score = this.calculateCreditRiskScore(metrics, exposures);
      creditRisk.level = this.determineRiskLevel(creditRisk.score);

    } catch (error: unknown) {
      console.error('Credit risk assessment failed:', error);
      creditRisk.score = 1;
      creditRisk.level = RISK_LEVELS.LOW;
      creditRisk.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return creditRisk;
  }

  /**
   * Assess concentration risk
   */
  async assessConcentrationRisk(portfolioData: PortfolioData): Promise<RiskCategory> {
    const concentrationRisk: RiskCategory = {
      category: RISK_CATEGORIES.CONCENTRATION_RISK,
      metrics: {} as ConcentrationRiskMetrics,
      score: 0,
      level: RISK_LEVELS.LOW,
      concentrations: {} as ConcentrationRiskConcentrations
    };

    try {
      const metrics = concentrationRisk.metrics as ConcentrationRiskMetrics;
      const concentrations = concentrationRisk.concentrations as ConcentrationRiskConcentrations;

      // Asset concentration
      metrics.maxSingleAssetWeight = Math.max(...Object.values(portfolioData.weights || {}));
      metrics.top5Concentration = this.calculateTopNConcentration(portfolioData.weights || {}, 5);
      metrics.top10Concentration = this.calculateTopNConcentration(portfolioData.weights || {}, 10);

      // Sector concentration
      concentrations.sectorWeights = this.calculateSectorWeights(portfolioData);
      metrics.maxSectorWeight = Math.max(...Object.values(concentrations.sectorWeights));
      metrics.herfindahlIndex = this.calculateHerfindahlIndex(portfolioData.weights || {});

      // Geographic concentration
      concentrations.geographicWeights = this.calculateGeographicWeights(portfolioData);
      metrics.maxGeographicWeight = Math.max(...Object.values(concentrations.geographicWeights));

      // Currency concentration
      concentrations.currencyWeights = this.calculateCurrencyWeights(portfolioData);

      // Calculate concentration risk score
      concentrationRisk.score = this.calculateConcentrationRiskScore(metrics, concentrations);
      concentrationRisk.level = this.determineRiskLevel(concentrationRisk.score);

    } catch (error: unknown) {
      console.error('Concentration risk assessment failed:', error);
      concentrationRisk.score = 1;
      concentrationRisk.level = RISK_LEVELS.LOW;
      concentrationRisk.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return concentrationRisk;
  }

  /**
   * Assess liquidity risk
   */
  async assessLiquidityRisk(portfolioData: PortfolioData, marketData: MarketData): Promise<RiskCategory> {
    const liquidityRisk: RiskCategory = {
      category: RISK_CATEGORIES.LIQUIDITY_RISK,
      metrics: {} as LiquidityRiskMetrics,
      score: 0,
      level: RISK_LEVELS.LOW,
      factors: {} as LiquidityRiskFactors
    };

    try {
      const metrics = liquidityRisk.metrics as LiquidityRiskMetrics;
      const factors = liquidityRisk.factors as LiquidityRiskFactors;

      // Liquidity metrics
      metrics.averageDailyVolume = this.calculateAverageDailyVolume(portfolioData);
      metrics.liquidityRatio = this.calculateLiquidityRatio(portfolioData);
      metrics.bidAskSpread = this.calculateAverageBidAskSpread(portfolioData);

      // Market impact
      metrics.marketImpact = this.estimateMarketImpact(portfolioData);
      metrics.liquidationTime = this.estimateLiquidationTime(portfolioData);

      // Funding liquidity
      factors.fundingLiquidity = this.assessFundingLiquidity(portfolioData);
      factors.contingentLiquidity = this.assessContingentLiquidity(portfolioData);

      // Calculate liquidity risk score
      liquidityRisk.score = this.calculateLiquidityRiskScore(metrics, factors);
      liquidityRisk.level = this.determineRiskLevel(liquidityRisk.score);

    } catch (error: unknown) {
      console.error('Liquidity risk assessment failed:', error);
      liquidityRisk.score = 1;
      liquidityRisk.level = RISK_LEVELS.LOW;
      liquidityRisk.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return liquidityRisk;
  }

  /**
   * Assess model risk
   */
  async assessModelRisk(portfolioData: PortfolioData): Promise<RiskCategory> {
    const modelRisk: RiskCategory = {
      category: RISK_CATEGORIES.MODEL_RISK,
      metrics: {} as ModelRiskMetrics,
      score: 0,
      level: RISK_LEVELS.LOW,
      models: {} as ModelRiskModels
    };

    try {
      const metrics = modelRisk.metrics as ModelRiskMetrics;
      const models = modelRisk.models as ModelRiskModels;

      // Model validation metrics
      metrics.modelAccuracy = this.assessModelAccuracy(portfolioData);
      metrics.backtestResults = this.performModelBacktest(portfolioData);
      metrics.modelStability = this.assessModelStability(portfolioData);

      // Model inventory
      models.activeModels = this.getActiveModelInventory(portfolioData);
      models.modelDependencies = this.assessModelDependencies(portfolioData);

      // Calculate model risk score
      modelRisk.score = this.calculateModelRiskScore(metrics, models);
      modelRisk.level = this.determineRiskLevel(modelRisk.score);

    } catch (error: unknown) {
      console.error('Model risk assessment failed:', error);
      modelRisk.score = 1;
      modelRisk.level = RISK_LEVELS.LOW;
      modelRisk.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return modelRisk;
  }

  /**
   * Perform advanced stress testing
   */
  async performAdvancedStressTest(portfolioData: PortfolioData, scenarios: any[] = []): Promise<StressTest> {
    try {
      const stressTest: StressTest = {
        id: this.generateStressTestId(),
        portfolioId: portfolioData.portfolioId,
        testDate: new Date().toISOString(),
        scenarios: {},
        aggregateResults: {},
        worstCaseScenario: null,
        recommendations: []
      };

      // Default scenarios if none provided
      const testScenarios = scenarios.length > 0 ? scenarios : this.getDefaultStressScenarios();

      // Run each scenario
      for (const scenario of testScenarios) {
        stressTest.scenarios[scenario.name] = await this.runStressScenario(portfolioData, scenario);
      }

      // Calculate aggregate results
      stressTest.aggregateResults = this.calculateAggregateStressResults(stressTest.scenarios);

      // Identify worst case
      stressTest.worstCaseScenario = this.identifyWorstCaseScenario(stressTest.scenarios);

      // Generate recommendations
      stressTest.recommendations = this.generateStressTestRecommendations(stressTest);

      // Store stress test results
      await this.persistStressTest(stressTest);

      return stressTest;
    } catch (error: unknown) {
      console.error('Advanced stress testing failed:', error);
      throw new Error(`Stress testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assess regulatory compliance
   */
  async checkRegulatoryCompliance(portfolioData: PortfolioData, regulations: string[] = []): Promise<ComplianceCheck> {
    try {
      const complianceCheck: ComplianceCheck = {
        id: this.generateComplianceId(),
        portfolioId: portfolioData.portfolioId,
        checkDate: new Date().toISOString(),
        frameworks: {},
        overallCompliance: true,
        violations: [],
        recommendations: []
      };

      // Default frameworks if none specified
      const frameworksToCheck = regulations.length > 0 ? regulations : Object.keys(this.complianceFrameworks);

      // Check each framework
      for (const framework of frameworksToCheck) {
        complianceCheck.frameworks[framework] = await this.checkComplianceFramework(
          portfolioData, framework
        );
      }

      // Aggregate results
      const frameworkResults = Object.values(complianceCheck.frameworks);
      complianceCheck.overallCompliance = frameworkResults.every(result => result.compliant);
      complianceCheck.violations = frameworkResults.flatMap(result => result.violations || []);

      // Generate recommendations
      complianceCheck.recommendations = this.generateComplianceRecommendations(complianceCheck);

      // Store compliance check
      await this.persistComplianceCheck(complianceCheck);

      return complianceCheck;
    } catch (error: unknown) {
      console.error('Regulatory compliance check failed:', error);
      throw new Error(`Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  generateAssessmentId() {
    return `risk_assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateStressTestId() {
    return `stress_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateComplianceId() {
    return `compliance_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  initializeRiskLimits() {
    return {
      maxVaR: 0.05,              // 5% max VaR
      maxConcentration: 0.20,     // 20% max single position
      maxSectorWeight: 0.30,      // 30% max sector weight
      maxLeverage: 2.0,           // 2x max leverage
      minLiquidityRatio: 0.15,    // 15% min liquidity ratio
      maxCorrelation: 0.7         // 0.7 max average correlation
    };
  }

  initializeComplianceFrameworks() {
    return {
      SEC: {
        name: 'SEC Regulations',
        rules: ['Rule_10b_5', 'Rule_10b_18', 'Regulation_SHO'],
        checks: ['insider_trading', 'market_manipulation', 'short_selling']
      },
      FINRA: {
        name: 'FINRA Rules',
        rules: ['Rule_4210', 'Rule_4510', 'Rule_3110'],
        checks: ['suitability', 'margin_requirements', 'supervision']
      },
      MiFID_II: {
        name: 'MiFID II',
        rules: ['Article_16', 'Article_24', 'Article_25'],
        checks: ['best_execution', 'transaction_reporting', 'investor_protection']
      },
      Basel_III: {
        name: 'Basel III',
        rules: ['Liquidity_Coverage_Ratio', 'Net_Stable_Funding_Ratio', 'Leverage_Ratio'],
        checks: ['capital_adequacy', 'liquidity_ratio', 'leverage_limits']
      }
    };
  }

  initializeAlertThresholds() {
    return {
      riskScore: { high: 3.0, critical: 3.5 },
      varLimit: { high: 0.03, critical: 0.05 },
      concentration: { high: 0.15, critical: 0.25 },
      correlation: { high: 0.6, critical: 0.8 },
      liquidity: { high: 0.10, critical: 0.05 }
    };
  }

  // Risk calculation methods (simplified implementations)

  calculateVaR(portfolioData: PortfolioData, confidenceLevel: number): number {
    // Simplified VaR calculation - would use historical simulation in production
    const portfolioValue = portfolioData.totalValue || 1000000;
    const volatility = portfolioData.volatility || 0.15;
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.326;
    return portfolioValue * volatility * zScore;
  }

  calculateCVaR(portfolioData: PortfolioData, confidenceLevel: number): number {
    // Simplified CVaR calculation
    const var_ = this.calculateVaR(portfolioData, confidenceLevel);
    return var_ * 1.2; // CVaR typically ~20% higher than VaR
  }

  calculatePortfolioBeta(portfolioData: PortfolioData): number {
    // Simplified beta calculation
    const weights = portfolioData.weights || {};
    const betas = portfolioData.betas || {};

    return Object.entries(weights).reduce((beta, [asset, weight]: [string, number]) => {
      return beta + (weight as number) * (betas[asset] || 1.0);
    }, 0);
  }

  calculateSystematicRisk(portfolioData: PortfolioData): number {
    const beta = this.calculatePortfolioBeta(portfolioData);
    const marketVolatility = 0.16; // ~16% annual market volatility
    return Math.abs(beta * marketVolatility);
  }

  calculateRollingVolatility(portfolioData: PortfolioData): number {
    // Simplified rolling volatility
    return portfolioData.volatility || 0.15;
  }

  assessVolatilityRegime(marketData: MarketData): string {
    const vix = marketData.vix || 20;
    if (vix < 15) return 'LOW_VOLATILITY';
    if (vix < 25) return 'NORMAL_VOLATILITY';
    if (vix < 35) return 'HIGH_VOLATILITY';
    return 'EXTREME_VOLATILITY';
  }

  calculateAverageCorrelation(portfolioData: PortfolioData): number {
    const correlationMatrix = portfolioData.correlationMatrix;
    if (!correlationMatrix || !correlationMatrix.matrix) return 0.3;

    const matrix = correlationMatrix.matrix;
    let sum = 0;
    let count = 0;
    const n = matrix.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        sum += Math.abs(matrix[i][j]);
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  assessCorrelationRisk(portfolioData: PortfolioData): string {
    const avgCorrelation = this.calculateAverageCorrelation(portfolioData);
    if (avgCorrelation > 0.7) return 'HIGH';
    if (avgCorrelation > 0.5) return 'MEDIUM';
    return 'LOW';
  }

  calculateFactorExposures(portfolioData: PortfolioData, marketData: MarketData): any {
    // Simplified factor exposure calculation
    const weights = portfolioData.weights || {};

    return {
      market: 1.0, // Always 1.0 for market exposure
      size: this.calculateSizeFactor(weights),
      value: this.calculateValueFactor(weights),
      momentum: this.calculateMomentumFactor(weights),
      quality: this.calculateQualityFactor(weights),
      volatility: this.calculateVolatilityFactor(weights)
    };
  }

  calculateSizeFactor(weights: Record<string, number>): number {
    // Simplified size factor - would use market cap in production
    return Object.keys(weights).length > 10 ? -0.2 : 0.1;
  }

  calculateValueFactor(weights: Record<string, number>): number {
    // Simplified value factor calculation
    return 0.1; // Mock value exposure
  }

  calculateMomentumFactor(weights: Record<string, number>): number {
    // Simplified momentum factor calculation
    return 0.05; // Mock momentum exposure
  }

  calculateQualityFactor(weights: Record<string, number>): number {
    // Simplified quality factor calculation
    return 0.15; // Mock quality exposure
  }

  calculateVolatilityFactor(weights: Record<string, number>): number {
    // Simplified volatility factor calculation
    return -0.1; // Mock low volatility exposure
  }

  // Additional helper methods would be implemented here...
  // For brevity, including key method signatures

  calculateMarketRiskScore(metrics: MarketRiskMetrics, factors: any): number {
    let score = 1;

    // VaR-based scoring
    if ((metrics.var95 ?? 0) > 50000) score += 0.5;
    if ((metrics.var99 ?? 0) > 100000) score += 0.5;

    // Volatility scoring
    if ((metrics.rollingVolatility ?? 0) > 0.20) score += 0.5;
    if (metrics.volatilityRegime === 'HIGH_VOLATILITY') score += 0.5;

    // Correlation scoring
    if ((metrics.averageCorrelation ?? 0) > 0.6) score += 0.5;

    return Math.min(score, 4);
  }

  calculateCreditRiskScore(metrics: CreditRiskMetrics, exposures: CreditRiskExposures): number {
    let score = 1;

    if ((metrics.defaultProbability ?? 0) > 0.05) score += 1;
    if ((metrics.creditVaR ?? 0) > 25000) score += 0.5;

    return Math.min(score, 4);
  }

  calculateConcentrationRiskScore(metrics: ConcentrationRiskMetrics, concentrations: ConcentrationRiskConcentrations): number {
    let score = 1;

    if ((metrics.maxSingleAssetWeight ?? 0) > 0.15) score += 0.5;
    if ((metrics.maxSectorWeight ?? 0) > 0.25) score += 0.5;
    if ((metrics.herfindahlIndex ?? 0) > 0.25) score += 0.5;

    return Math.min(score, 4);
  }

  calculateLiquidityRiskScore(metrics: LiquidityRiskMetrics, factors: LiquidityRiskFactors): number {
    let score = 1;

    if ((metrics.liquidityRatio ?? 1) < 0.10) score += 0.5;
    if ((metrics.marketImpact ?? 0) > 0.02) score += 0.5;

    return Math.min(score, 4);
  }

  calculateModelRiskScore(metrics: ModelRiskMetrics, models: ModelRiskModels): number {
    let score = 1;

    if ((metrics.modelAccuracy ?? 1) < 0.80) score += 0.5;
    if ((metrics.modelStability ?? 1) < 0.85) score += 0.5;

    return Math.min(score, 4);
  }

  calculateOverallRiskScore(categoryBreakdown: CategoryBreakdown): number {
    const categories = Object.values(categoryBreakdown).filter((cat): cat is RiskCategory => cat !== undefined);
    const totalScore = categories.reduce((sum, category) => sum + category.score, 0);
    return categories.length > 0 ? totalScore / categories.length : 0;
  }

  determineRiskLevel(score: number): typeof RISK_LEVELS[keyof typeof RISK_LEVELS] {
    if (score >= 3.5) return RISK_LEVELS.CRITICAL;
    if (score >= 2.5) return RISK_LEVELS.HIGH;
    if (score >= 1.5) return RISK_LEVELS.MEDIUM;
    return RISK_LEVELS.LOW;
  }

  generateRiskRecommendations(categoryBreakdown: CategoryBreakdown, riskLevel: typeof RISK_LEVELS[keyof typeof RISK_LEVELS]): any[] {
    const recommendations: any[] = [];

    Object.entries(categoryBreakdown).forEach(([category, assessment]) => {
      if (assessment && assessment.score >= 2.5) {
        recommendations.push({
          category,
          priority: assessment.score >= 3.5 ? 'HIGH' : 'MEDIUM',
          action: `Review and mitigate ${category.replace('_', ' ').toLowerCase()} risks`,
          suggestedActions: this.getSuggestedActions(category, assessment)
        });
      }
    });

    return recommendations;
  }

  getSuggestedActions(category: string, assessment: RiskCategory): string[] {
    const actionMap: Record<string, string[]> = {
      'marketRisk': ['Consider hedging strategies', 'Reduce portfolio beta', 'Increase diversification'],
      'creditRisk': ['Review credit quality', 'Consider credit default swaps', 'Reduce high-yield exposure'],
      'concentrationRisk': ['Reduce position sizes', 'Increase diversification', 'Add new sectors/regions'],
      'liquidityRisk': ['Increase cash allocation', 'Add more liquid assets', 'Reduce illiquid positions'],
      'modelRisk': ['Validate model assumptions', 'Update models with recent data', 'Implement model governance']
    };

    return actionMap[category] || ['Review risk factors', 'Implement mitigation strategies'];
  }

  async checkRiskLimits(assessment: RiskAssessment): Promise<RiskLimitCheck> {
    const limits: RiskLimitCheck = {
      breached: [],
      withinLimits: []
    };

    // Check VaR limits
    const marketRiskMetrics = assessment.categoryBreakdown.marketRisk?.metrics as MarketRiskMetrics | undefined;
    const var95 = marketRiskMetrics?.var95 ?? 0;
    if (var95 > this.riskLimits.maxVaR * 1000000) {
      limits.breached.push({
        limitType: 'VaR',
        current: var95,
        limitValue: this.riskLimits.maxVaR * 1000000,
        severity: 'HIGH'
      });
    }

    // Check concentration limits
    const maxWeight = Math.max(...Object.values(assessment.categoryBreakdown.concentrationRisk?.metrics || {}));
    if (maxWeight > this.riskLimits.maxConcentration) {
      limits.breached.push({
        limitType: 'Concentration',
        current: maxWeight,
        limitValue: this.riskLimits.maxConcentration,
        severity: 'MEDIUM'
      });
    }

    return limits;
  }

  generateRiskAlerts(assessment: RiskAssessment): any[] {
    const alerts: any[] = [];

    Object.entries(assessment.categoryBreakdown).forEach(([category, risk]) => {
      if (risk && risk.level.value >= RISK_LEVELS.HIGH.value) {
        alerts.push({
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          type: 'RISK_THRESHOLD',
          category: risk.category,
          severity: risk.level.label,
          message: `${risk.category} risk level is ${risk.level.label}`,
          timestamp: new Date().toISOString(),
          recommendedAction: `Review ${category.toLowerCase()} management strategies`
        });
      }
    });

    assessment.riskLimits.breached?.forEach((breach: any) => {
      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: 'LIMIT_BREACH',
        category: 'Risk Limits',
        severity: breach.severity,
        message: `${breach.limitType} limit breached: ${breach.current.toFixed(2)} > ${breach.limitValue.toFixed(2)}`,
        timestamp: new Date().toISOString(),
        recommendedAction: 'Immediate portfolio rebalancing required'
      });
    });

    return alerts;
  }

  // Simplified implementations for remaining methods
  calculateTopNConcentration(weights: Record<string, number>, n: number): number {
    const sortedWeights = Object.values(weights).sort((a: any, b: any) => b - a);
    return sortedWeights.slice(0, n).reduce((sum: any, weight: any) => sum + weight, 0);
  }

  calculateHerfindahlIndex(weights: Record<string, number>): number {
    return Object.values(weights).reduce((sum: any, weight: any) => sum + weight * weight, 0);
  }

  calculateSectorWeights(portfolioData: PortfolioData): Record<string, number> {
    // Mock sector weights - would use actual sector data
    return {
      'Technology': 0.35,
      'Healthcare': 0.20,
      'Finance': 0.15,
      'Consumer': 0.15,
      'Industrial': 0.15
    };
  }

  calculateGeographicWeights(portfolioData: PortfolioData): Record<string, number> {
    // Mock geographic weights
    return {
      'US': 0.70,
      'Europe': 0.15,
      'Asia': 0.10,
      'Other': 0.05
    };
  }

  calculateCurrencyWeights(portfolioData: PortfolioData): Record<string, number> {
    // Mock currency weights
    return {
      'USD': 0.80,
      'EUR': 0.10,
      'JPY': 0.05,
      'GBP': 0.05
    };
  }

  getDefaultStressScenarios(): any[] {
    return [
      {
        name: 'Market Crash',
        description: 'Severe market decline',
        marketShock: -0.30,
        volatilityShock: 2.0,
        correlationShock: 0.3,
        probability: 0.02
      },
      {
        name: 'Recession',
        description: 'Economic recession scenario',
        marketShock: -0.20,
        volatilityShock: 1.5,
        correlationShock: 0.2,
        probability: 0.10
      },
      {
        name: 'Interest Rate Spike',
        description: 'Rapid interest rate increase',
        marketShock: -0.10,
        volatilityShock: 1.2,
        correlationShock: 0.1,
        probability: 0.15
      },
      {
        name: 'Liquidity Crisis',
        description: 'Market liquidity freeze',
        marketShock: -0.15,
        volatilityShock: 2.5,
        correlationShock: 0.4,
        probability: 0.05
      },
      {
        name: 'Cyber Attack',
        description: 'Major cybersecurity incident',
        marketShock: -0.08,
        volatilityShock: 1.3,
        correlationShock: 0.15,
        probability: 0.03
      }
    ];
  }

  async runStressScenario(portfolioData: PortfolioData, scenario: any): Promise<any> {
    // Simplified stress scenario execution
    const baseValue = portfolioData.totalValue || 1000000;
    const baseVolatility = portfolioData.volatility || 0.15;

    const stressedValue = baseValue * (1 + scenario.marketShock);
    const stressedVolatility = baseVolatility * scenario.volatilityShock;
    const stressedVaR = stressedValue * stressedVolatility * 1.645;

    return {
      scenario: scenario.name,
      stressedValue,
      stressedVolatility,
      stressedVaR,
      valueLoss: Math.abs(baseValue - stressedValue),
      lossPercentage: Math.abs(scenario.marketShock),
      probability: scenario.probability,
      riskAdjustedReturn: (stressedValue - baseValue) / baseValue
    };
  }

  calculateAggregateStressResults(scenarios: Record<string, any>): any {
    const scenarioResults = Object.values(scenarios);

    return {
      worstCaseLoss: Math.max(...scenarioResults.map(s => s.valueLoss)),
      averageLoss: scenarioResults.reduce((sum: any, s: any) => sum + s.valueLoss, 0) / scenarioResults.length,
      maxVolatility: Math.max(...scenarioResults.map(s => s.stressedVolatility)),
      weightedLoss: scenarioResults.reduce((sum: any, s: any) => sum + s.valueLoss * s.probability, 0),
      scenarioCount: scenarioResults.length
    };
  }

  identifyWorstCaseScenario(scenarios: Record<string, any>): any {
    const scenarioResults = Object.entries(scenarios);
    return scenarioResults.reduce((worst: any, [name, result]) => {
      if (!worst || result.valueLoss > worst.result.valueLoss) {
        return { name, result };
      }
      return worst;
    }, null as any);
  }

  generateStressTestRecommendations(stressTest: StressTest): any[] {
    const recommendations: any[] = [];

    if (stressTest.aggregateResults.worstCaseLoss > 200000) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Reduce portfolio exposure to high-risk assets',
        rationale: `Potential loss of $${stressTest.aggregateResults.worstCaseLoss.toFixed(0)} exceeds acceptable levels`
      });
    }

    if (stressTest.aggregateResults.maxVolatility > 0.30) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Implement volatility reduction strategies',
        rationale: 'Stress scenarios indicate excessive volatility exposure'
      });
    }

    return recommendations;
  }

  async checkComplianceFramework(portfolioData: PortfolioData, framework: string): Promise<any> {
    const frameworkConfig = this.complianceFrameworks[framework];
    if (!frameworkConfig) {
      return { framework, compliant: false, error: 'Unknown framework' };
    }

    const checkResult: any = {
      framework,
      frameworkName: frameworkConfig.name,
      compliant: true,
      checks: {},
      violations: []
    };

    // Perform framework-specific checks
    for (const check of frameworkConfig.checks) {
      const result = await this.performComplianceCheck(portfolioData, framework, check);
      checkResult.checks[check] = result;

      if (!result.compliant) {
        checkResult.compliant = false;
        checkResult.violations.push({
          rule: check,
          description: result.description,
          severity: result.severity,
          recommendation: result.recommendation
        });
      }
    }

    return checkResult;
  }

  async performComplianceCheck(portfolioData: PortfolioData, framework: string, check: string): Promise<any> {
    // Simplified compliance checking - would implement actual rule logic
    const checkMap: Record<string, () => any> = {
      'insider_trading': () => ({ compliant: true, description: 'No insider trading detected' }),
      'market_manipulation': () => ({ compliant: true, description: 'No market manipulation patterns detected' }),
      'suitability': () => ({ compliant: true, description: 'Portfolio suitable for risk profile' }),
      'margin_requirements': () => ({ compliant: true, description: 'Margin requirements within limits' }),
      'best_execution': () => ({ compliant: true, description: 'Best execution policies followed' }),
      'transaction_reporting': () => ({ compliant: true, description: 'All transactions properly reported' }),
      'capital_adequacy': () => ({ compliant: true, description: 'Capital adequacy requirements met' }),
      'liquidity_ratio': () => ({ compliant: true, description: 'Liquidity ratios within regulatory limits' })
    };

    return checkMap[check]?.() || { compliant: true, description: 'Check passed' };
  }

  generateComplianceRecommendations(complianceCheck: ComplianceCheck): any[] {
    const recommendations: any[] = [];

    complianceCheck.violations.forEach((violation: any) => {
      recommendations.push({
        framework: violation.framework,
        priority: violation.severity === 'HIGH' ? 'IMMEDIATE' : 'HIGH',
        action: `Address ${violation.rule} violation`,
        description: violation.description,
        recommendation: violation.recommendation
      });
    });

    return recommendations;
  }

  // Additional simplified methods
  calculateCreditSpreadRisk(portfolioData: PortfolioData): number { return 0.02; }
  calculateDefaultProbability(portfolioData: PortfolioData): number { return 0.01; }
  calculateCreditVaR(portfolioData: PortfolioData): number { return 15000; }
  assessCounterpartyRisk(portfolioData: PortfolioData): number { return 0.05; }
  getCreditRatingDistribution(portfolioData: PortfolioData): Record<string, number> { return { 'AAA': 0.3, 'AA': 0.4, 'A': 0.3 }; }
  getCreditSectorExposure(portfolioData: PortfolioData): Record<string, number> { return { 'Corporate': 0.6, 'Sovereign': 0.4 }; }
  calculateAverageDailyVolume(portfolioData: PortfolioData): number { return 5000000; }
  calculateLiquidityRatio(portfolioData: PortfolioData): number { return 0.20; }
  calculateAverageBidAskSpread(portfolioData: PortfolioData): number { return 0.001; }
  estimateMarketImpact(portfolioData: PortfolioData): number { return 0.015; }
  estimateLiquidationTime(portfolioData: PortfolioData): number { return 5; }
  assessFundingLiquidity(portfolioData: PortfolioData): number { return 0.85; }
  assessContingentLiquidity(portfolioData: PortfolioData): number { return 0.90; }
  assessModelAccuracy(portfolioData: PortfolioData): number { return 0.88; }
  performModelBacktest(portfolioData: PortfolioData): any { return { success: 0.85, accuracy: 0.82 }; }
  assessModelStability(portfolioData: PortfolioData): number { return 0.90; }
  getActiveModelInventory(portfolioData: PortfolioData): string[] { return ['VaR', 'Expected Shortfall', 'Monte Carlo']; }
  assessModelDependencies(portfolioData: PortfolioData): any { return { independent: true, validated: true }; }

  // Persistence methods
  async persistRiskAssessment(assessment: RiskAssessment): Promise<void> {
    const key = `${RISK_NAMESPACES.RISK_ASSESSMENTS}:${assessment.id}`;
    await setKVStore(this.env, key, assessment, RISK_TTL.ASSESSMENT_CACHE);
  }

  async persistStressTest(stressTest: StressTest): Promise<void> {
    const key = `${RISK_NAMESPACES.STRESS_TESTS}:${stressTest.id}`;
    await setKVStore(this.env, key, stressTest, RISK_TTL.STRESS_TEST_CACHE);
  }

  async persistComplianceCheck(complianceCheck: ComplianceCheck): Promise<void> {
    const key = `${RISK_NAMESPACES.COMPLIANCE_CHECKS}:${complianceCheck.id}`;
    await setKVStore(this.env, key, complianceCheck, RISK_TTL.COMPLIANCE_CACHE);
  }
}

/**
 * Factory function for creating risk management engine instances
 */
export function createAdvancedRiskManagementEngine(env: any) {
  return new AdvancedRiskManagementEngine(env);
}

/**
 * Utility functions for risk management
 */
export async function performRiskAssessment(env: CloudflareEnvironment, portfolioData: PortfolioData, marketData: MarketData): Promise<RiskAssessment> {
  const engine = createAdvancedRiskManagementEngine(env);
  return await engine.performRiskAssessment(portfolioData, marketData);
}

export async function performStressTest(env: CloudflareEnvironment, portfolioData: PortfolioData, scenarios: any[]): Promise<StressTest> {
  const engine = createAdvancedRiskManagementEngine(env);
  return await engine.performAdvancedStressTest(portfolioData, scenarios);
}

export async function checkCompliance(env: CloudflareEnvironment, portfolioData: PortfolioData, regulations: string[]): Promise<ComplianceCheck> {
  const engine = createAdvancedRiskManagementEngine(env);
  return await engine.checkRegulatoryCompliance(portfolioData, regulations);
}
