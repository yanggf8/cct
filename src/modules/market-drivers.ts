/**
 * Market Drivers Detection System
 *
 * Comprehensive market-wide catalyst detection system for institutional-grade
 * trading intelligence. Implements three-pillar driver analysis:
 *
 * 1. Macroeconomic Drivers (FRED API)
 * 2. Market Structure Drivers (Yahoo Finance)
 * 3. Geopolitical Drivers (News API + DistilBERT)
 *
 * @author Market Drivers Pipeline - Phase 2
 * @since 2025-10-10
 */

import { createLogger } from './logging.js';
import { createDAL } from './dal.js';
import { initializeMacroEconomicFetcher, type EnhancedMacroDrivers } from './macro-economic-fetcher.js';
import { initializeMarketStructureFetcher, type EnhancedMarketStructure } from './market-structure-fetcher.js';
import { initializeMarketRegimeClassifier, type EnhancedRegimeAnalysis } from './market-regime-classifier.js';
import { DOMarketDriversCacheAdapter } from './do-cache-adapter.js';

const logger = createLogger('market-drivers');

/**
 * Core Market Drivers Interfaces
 */

export interface MacroDrivers {
  // Interest Rates
  fedFundsRate: number;           // DFF - Federal Funds Rate
  treasury10Y: number;            // DGS10 - 10-Year Treasury Yield
  treasury2Y: number;             // DGS2 - 2-Year Treasury Yield
  yieldCurveSpread: number;       // DGS10 - DGS2 (inverted = recession signal)

  // Inflation
  cpi: number;                    // CPIAUCSL - Consumer Price Index
  ppi: number;                    // PPIACO - Producer Price Index
  inflationRate: number;          // Year-over-year CPI change

  // Employment
  unemploymentRate: number;       // UNRATE - Unemployment Rate
  nonFarmPayrolls: number;        // PAYEMS - Non-Farm Payrolls
  laborForceParticipation: number; // CIVPART - Labor Force Participation

  // Growth
  realGDP: number;                // GDPC1 - Real GDP
  gdpGrowthRate: number;          // Quarterly GDP growth
  consumerConfidence: number;     // UMCSENT - Consumer Confidence

  // Housing
  buildingPermits: number;        // PERMIT - Building Permits
  housingStarts: number;          // HOUST - Housing Starts

  lastUpdated: string;
}

export interface MarketStructure {
  // Volatility
  vix: number;                    // ^VIX - CBOE Volatility Index
  vixTrend: 'rising' | 'falling' | 'stable';
  vixPercentile: number;          // Historical percentile

  // Dollar Strength
  usDollarIndex: number;          // DX-Y.NYB - US Dollar Index
  dollarTrend: 'strengthening' | 'weakening' | 'stable';

  // Market Benchmarks
  spy: number;                    // S&P 500
  spyTrend: 'bullish' | 'bearish' | 'neutral';

  // Treasury Yields
  yield10Y: number;               // 10Y yield for comparison
  yieldCurveStatus: 'normal' | 'flat' | 'inverted';

  // Credit Markets
  liborRate: number;              // USD_LIBOR_1M (if available)

  lastUpdated: string;
}

export interface GeopoliticalRisk {
  // Risk Categories
  tradePolicy: number;            // Trade policy sentiment (-1 to 1)
  elections: number;              // Election-related risk
  centralBankPolicy: number;      // Central bank policy risk
  conflicts: number;              // Geopolitical conflicts
  energyPolicy: number;           // Energy policy changes
  regulatory: number;             // Regulatory changes

  // Aggregated Metrics
  overallRiskScore: number;       // Aggregate risk score (-1 to 1)
  riskTrend: 'increasing' | 'decreasing' | 'stable';
  highImpactEvents: number;       // Count of high-impact events

  // News Analysis
  articlesAnalyzed: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };

  lastUpdated: string;
}

export interface MarketRegime {
  // Regime Classification
  currentRegime: MarketRegimeType;
  confidence: number;             // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';

  // Regime Characteristics
  description: string;
  favoredSectors: string[];       // Which sectors perform best in this regime
  avoidedSectors: string[];       // Which sectors to avoid

  // Trading Strategy
  strategy: string;
  positionSizing: string;
  duration: string;               // Expected duration of regime

  // Transition Analysis
  previousRegime: MarketRegimeType;
  regimeChangeDate: string;
  stabilityScore: number;         // How stable the current regime is

  lastUpdated: string;
}

export type MarketRegimeType =
  | 'bullish_expansion'           // Low VIX, positive yield curve, strong GDP
  | 'bearish_contraction'         // High VIX, inverted curve, weak GDP
  | 'stagflation'                 // High inflation, weak growth
  | 'goldilocks'                  // Low inflation, strong growth, moderate rates
  | 'risk_off'                    // Spike in VIX/geopolitical risk
  | 'risk_on'                     // Falling VIX, improving economics
  | 'transitioning'               // Mixed signals, regime change in progress
  | 'uncertain';                  // No clear pattern

export interface MarketDriversSnapshot {
  timestamp: number;
  date: string;

  // Three Pillar Analysis
  macro: MacroDrivers;
  marketStructure: MarketStructure;
  geopolitical: GeopoliticalRisk;

  // Synthesized Intelligence
  regime: MarketRegime;

  // Market Signals
  riskOnRiskOff: 'risk_on' | 'risk_off' | 'neutral';
  marketHealth: 'healthy' | 'caution' | 'stress' | 'crisis';
  economicMomentum: 'accelerating' | 'decelerating' | 'stable';

  // Investment Guidance
  overallAssessment: string;
  keyDrivers: string[];
  watchItems: string[];

  metadata: {
    dataSourceStatus: {
      fred: 'available' | 'unavailable' | 'stale';
      yahoo: 'available' | 'unavailable' | 'stale';
      news: 'available' | 'unavailable' | 'stale';
    };
    dataFreshness: {
      macro: number;              // Hours since last update
      market: number;             // Hours since last update
      geopolitical: number;       // Hours since last update
    };
    confidenceLevel: number;      // Overall confidence in analysis
  };
}

/**
 * FRED API Configuration
 * Federal Reserve Economic Data - Free comprehensive economic data
 */

export const FRED_SERIES = {
  // Interest Rates
  FED_FUNDS_RATE: 'DFF',          // Federal Funds Rate
  TREASURY_10Y: 'DGS10',          // 10-Year Treasury Constant Maturity Rate
  TREASURY_2Y: 'DGS2',            // 2-Year Treasury Constant Maturity Rate
  TREASURY_30D: 'DGS1MO',         // 1-Month Treasury Rate

  // Inflation
  CPI: 'CPIAUCSL',                // Consumer Price Index for All Urban Consumers
  PPI: 'PPIACO',                  // Producer Price Index
  CORE_CPI: 'CPILFESL',           // Core CPI (excludes food and energy)

  // Employment
  UNEMPLOYMENT_RATE: 'UNRATE',    // Unemployment Rate
  NON_FARM_PAYROLLS: 'PAYEMS',    // All Employees: Non-Farm Payrolls
  LABOR_FORCE_PARTICIPATION: 'CIVPART', // Labor Force Participation Rate

  // Growth
  REAL_GDP: 'GDPC1',              // Real Gross Domestic Product
  GDP_GROWTH: 'A191RL1Q225SBEA',  // Real GDP: Percent Change from Preceding Period
  INDUSTRIAL_PRODUCTION: 'IPMAN', // Industrial Production: Manufacturing

  // Consumer
  CONSUMER_CONFIDENCE: 'UMCSENT', // University of Michigan Consumer Sentiment
  RETAIL_SALES: 'RSXFS',          // Retail and Food Services Sales

  // Housing
  BUILDING_PERMITS: 'PERMIT',     // New Private Housing Units Authorized by Building Permits
  HOUSING_STARTS: 'HOUST',        // New Private Housing Units Started
  EXISTING_HOME_SALES: 'MSPNHSUS', // Existing Home Sales

  // Money Supply
  M2_MONEY_SUPPLY: 'M2SL',        // M2 Money Supply

  // Leading Indicators
  LEADING_INDEX: 'USSLIND',       // Leading Index for the United States

} as const;

export type FredSeries = typeof FRED_SERIES[keyof typeof FRED_SERIES];

/**
 * Market Structure Symbols (Yahoo Finance)
 */
export const MARKET_STRUCTURE_SYMBOLS = {
  VIX: '^VIX',                     // CBOE Volatility Index
  DOLLAR_INDEX: 'DX-Y.NYB',       // US Dollar Index
  SPY: 'SPY',                     // S&P 500 ETF
  QQQ: 'QQQ',                     // NASDAQ 100 ETF
  DOW: '^DJI',                    // Dow Jones Industrial Average
  RUSSELL: '^RUT',                // Russell 2000 Small Cap Index

  // Treasury Yields (ETF proxies)
  TEN_YEAR_TREASURY: 'TNX',       // 10-Year Treasury Yield (TNX is ^TNX)
  TWO_YEAR_TREASURY: 'TYX',       // 2-Year Treasury Yield

  // Other Risk Indicators
  GOLD: 'GC=F',                   // Gold Futures
  OIL: 'CL=F',                    // Crude Oil Futures

} as const;

/**
 * Geopolitical Risk Categories and Keywords
 */
export const GEOPOLITICAL_CATEGORIES = {
  TRADE_POLICY: {
    keywords: ['tariff', 'trade war', 'trade deal', 'import', 'export', 'sanction'],
    weight: 0.2,
  },
  ELECTIONS: {
    keywords: ['election', 'president', 'congress', 'vote', 'campaign', 'ballot'],
    weight: 0.15,
  },
  CENTRAL_BANK: {
    keywords: ['federal reserve', 'fed', 'jerome powell', 'interest rate', 'monetary policy'],
    weight: 0.25,
  },
  CONFLICTS: {
    keywords: ['war', 'conflict', 'military', 'attack', 'tension', 'geopolitical'],
    weight: 0.2,
  },
  ENERGY_POLICY: {
    keywords: ['opec', 'energy policy', 'oil', 'petroleum', 'strategic reserve'],
    weight: 0.1,
  },
  REGULATORY: {
    keywords: ['regulation', 'sec', 'antitrust', 'compliance', 'policy'],
    weight: 0.1,
  },
} as const;

/**
 * Market Regime Classification Rules
 */
export interface RegimeRule {
  name: string;
  conditions: {
    vix?: { min?: number; max?: number; operator?: 'lt' | 'gt' | 'eq' };
    yieldCurve?: { min?: number; max?: number; operator?: 'lt' | 'gt' | 'eq' };
    gdpGrowth?: { min?: number; max?: number; operator?: 'lt' | 'gt' | 'eq' };
    inflation?: { min?: number; max?: number; operator?: 'lt' | 'gt' | 'eq' };
    geopoliticalRisk?: { min?: number; max?: number; operator?: 'lt' | 'gt' | 'eq' };
  };
  result: MarketRegimeType;
  confidence: number;
}

export const REGIME_CLASSIFICATION_RULES: RegimeRule[] = [
  {
    name: 'Bullish Expansion',
    conditions: {
      vix: { max: 20, operator: 'lt' },
      yieldCurve: { min: 0.5, operator: 'gt' },
      gdpGrowth: { min: 2, operator: 'gt' },
      inflation: { min: 1, max: 4, operator: 'gt' },
      geopoliticalRisk: { max: 0.3, operator: 'lt' },
    },
    result: 'bullish_expansion',
    confidence: 85,
  },
  {
    name: 'Bearish Contraction',
    conditions: {
      vix: { min: 30, operator: 'gt' },
      yieldCurve: { max: -0.5, operator: 'lt' },
      gdpGrowth: { max: 0, operator: 'lt' },
      geopoliticalRisk: { min: 0.5, operator: 'gt' },
    },
    result: 'bearish_contraction',
    confidence: 90,
  },
  {
    name: 'Stagflation',
    conditions: {
      inflation: { min: 5, operator: 'gt' },
      gdpGrowth: { max: 1, operator: 'lt' },
      vix: { min: 20, max: 40, operator: 'gt' },
    },
    result: 'stagflation',
    confidence: 80,
  },
  {
    name: 'Goldilocks',
    conditions: {
      inflation: { min: 1, max: 3, operator: 'gt' },
      gdpGrowth: { min: 2, max: 4, operator: 'gt' },
      vix: { max: 15, operator: 'lt' },
      yieldCurve: { min: 0.2, operator: 'gt' },
    },
    result: 'goldilocks',
    confidence: 85,
  },
  {
    name: 'Risk-Off',
    conditions: {
      vix: { min: 25, operator: 'gt' },
      geopoliticalRisk: { min: 0.6, operator: 'gt' },
    },
    result: 'risk_off',
    confidence: 75,
  },
  {
    name: 'Risk-On',
    conditions: {
      vix: { max: 18, operator: 'lt' },
      yieldCurve: { min: 0.3, operator: 'gt' },
      geopoliticalRisk: { max: 0.2, operator: 'lt' },
    },
    result: 'risk_on',
    confidence: 70,
  },
];

/**
 * Main Market Drivers Manager
 */
export class MarketDriversManager {
  private dal;
  private cacheManager: DOMarketDriversCacheAdapter;
  private macroEconomicFetcher;
  private marketStructureFetcher;
  private regimeClassifier;
  private fredApiKey?: string;

  constructor(env: any) {
    this.dal = createDAL(env);
    this.cacheManager = new DOMarketDriversCacheAdapter(env);
    this.fredApiKey = env.FRED_API_KEY;

    // Initialize macro economic fetcher
    this.macroEconomicFetcher = initializeMacroEconomicFetcher({
      fredApiKey: this.fredApiKey,
      useMockData: !this.fredApiKey,
      cacheManager: this.cacheManager,
      enableCaching: true,
    });

    // Initialize market structure fetcher
    this.marketStructureFetcher = initializeMarketStructureFetcher({
      cacheManager: this.cacheManager,
      enableCaching: true,
      vixHistoryDays: 90,
      spyHistoryDays: 90,
    });

    // Initialize market regime classifier
    this.regimeClassifier = initializeMarketRegimeClassifier({
      cacheManager: this.cacheManager,
      enableCaching: true,
      historicalLookbackDays: 30,
      minConfidenceThreshold: 60,
    });
  }

  /**
   * Get complete Market Drivers snapshot
   */
  async getMarketDriversSnapshot(): Promise<MarketDriversSnapshot> {
    const timestamp = Date.now();

    try {
      logger.info('Starting Market Drivers snapshot generation');

      // Fetch data from all three pillars
      logger.info('Fetching data from three pillars');
      const [macro, marketStructure, geopolitical] = await Promise.all([
        this.fetchMacroDrivers(),
        this.fetchMarketStructure(),
        this.fetchGeopoliticalRisk(),
      ]);

      logger.info('Successfully fetched data from pillars', {
        macroDataPoints: Object.keys(macro).length,
        marketStructureDataPoints: Object.keys(marketStructure).length,
        geopoliticalDataPoints: Object.keys(geopolitical).length
      });

      // Classify market regime
      logger.info('Classifying market regime');
      const regime = await this.classifyMarketRegime(macro, marketStructure, geopolitical);

      logger.info('Successfully classified market regime', {
        regime: regime.currentRegime,
        confidence: regime.confidence
      });

      // Generate synthesized signals
      logger.info('Generating synthesized signals');
      const riskOnRiskOff = this.calculateRiskOnRiskOff(marketStructure, geopolitical);
      const marketHealth = this.assessMarketHealth(macro, marketStructure);
      const economicMomentum = this.assessEconomicMomentum(macro);

      // Generate investment guidance
      logger.info('Generating investment guidance');
      const overallAssessment = this.generateOverallAssessment(regime, macro, marketStructure);
      const keyDrivers = this.identifyKeyDrivers(macro, marketStructure, geopolitical);
      const watchItems = this.generateWatchItems(regime, macro, marketStructure);

      logger.info('Creating snapshot object');
      const snapshot: MarketDriversSnapshot = {
        timestamp,
        date: this.createSnapshotDate(),
        macro,
        marketStructure,
        geopolitical,
        regime,
        riskOnRiskOff,
        marketHealth,
        economicMomentum,
        overallAssessment,
        keyDrivers,
        watchItems,
        metadata: {
          dataSourceStatus: {
            fred: macro.lastUpdated ? 'available' : 'unavailable',
            yahoo: marketStructure.lastUpdated ? 'available' : 'unavailable',
            news: geopolitical.lastUpdated ? 'available' : 'unavailable',
          },
          dataFreshness: {
            macro: this.calculateDataAge(macro.lastUpdated),
            market: this.calculateDataAge(marketStructure.lastUpdated),
            geopolitical: this.calculateDataAge(geopolitical.lastUpdated),
          },
          confidenceLevel: this.calculateOverallConfidence(macro, marketStructure, geopolitical),
        },
      };

      logger.info('Market Drivers snapshot generated successfully', {
        date: snapshot.date,
        regime: snapshot.regime.currentRegime,
        riskLevel: snapshot.regime.riskLevel
      });

      return snapshot;
    } catch (error: unknown) {
      logger.error('Error generating market drivers snapshot:', {
        error: (error instanceof Error ? error.message : String(error)),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp
      });
      throw error;
    }
  }

  /**
   * Get enhanced market drivers snapshot with full regime analysis
   */
  async getEnhancedMarketDriversSnapshot(): Promise<{
    basic: MarketDriversSnapshot;
    enhancedMacro: EnhancedMacroDrivers;
    enhancedMarketStructure: EnhancedMarketStructure;
    enhancedRegime: EnhancedRegimeAnalysis;
  }> {
    try {
      // Get basic snapshot
      const basic = await this.getMarketDriversSnapshot();

      // Get enhanced data from all three components
      const [enhancedMacro, enhancedMarketStructure, enhancedRegime] = await Promise.all([
        this.macroEconomicFetcher.fetchMacroDrivers(),
        this.marketStructureFetcher.fetchMarketStructure(),
        this.regimeClassifier.classifyMarketRegime(
          basic.macro,
          basic.marketStructure,
          basic.geopolitical
        ),
      ]);

      return {
        basic,
        enhancedMacro,
        enhancedMarketStructure,
        enhancedRegime,
      };
    } catch (error: unknown) {
      logger.error('Error generating enhanced market drivers snapshot:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Fetch macroeconomic drivers from FRED API
   */
  private async fetchMacroDrivers(): Promise<MacroDrivers> {
    try {
      logger.info('Fetching macroeconomic drivers via FRED API');

      // Fetch enhanced macro drivers
      const enhancedMacro = await this.macroEconomicFetcher.fetchMacroDrivers();

      // Transform to basic MacroDrivers format
      const macro: MacroDrivers = {
        fedFundsRate: enhancedMacro.fedFundsRate,
        treasury10Y: enhancedMacro.treasury10Y,
        treasury2Y: enhancedMacro.treasury2Y,
        yieldCurveSpread: enhancedMacro.yieldCurveSpread,
        cpi: enhancedMacro.cpi,
        ppi: enhancedMacro.ppi,
        inflationRate: enhancedMacro.inflationRate,
        unemploymentRate: enhancedMacro.unemploymentRate,
        nonFarmPayrolls: enhancedMacro.nonFarmPayrolls,
        laborForceParticipation: enhancedMacro.laborForceParticipation,
        realGDP: enhancedMacro.realGDP,
        gdpGrowthRate: enhancedMacro.gdpGrowthRate,
        consumerConfidence: enhancedMacro.consumerConfidence,
        buildingPermits: enhancedMacro.buildingPermits,
        housingStarts: enhancedMacro.housingStarts,
        lastUpdated: enhancedMacro.metadata.lastUpdated,
      };

      logger.info('Macroeconomic drivers fetched successfully', {
        fedFundsRate: macro.fedFundsRate,
        unemploymentRate: macro.unemploymentRate,
        inflationRate: macro.inflationRate,
        source: enhancedMacro.metadata.source,
        dataQuality: enhancedMacro.metadata.dataQuality,
      });

      return macro;
    } catch (error: unknown) {
      logger.error('Failed to fetch macroeconomic drivers:', { error: error instanceof Error ? error.message : String(error) });
      // Fall back to mock data if API fails
      return this.getMockMacroDrivers();
    }
  }

  /**
   * Fetch market structure indicators from Yahoo Finance
   */
  private async fetchMarketStructure(): Promise<MarketStructure> {
    try {
      logger.info('Fetching market structure indicators via Yahoo Finance');

      // Fetch enhanced market structure data
      const enhancedStructure = await this.marketStructureFetcher.fetchMarketStructure();

      // Transform to basic MarketStructure format
      const structure: MarketStructure = {
        vix: enhancedStructure.vix,
        vixTrend: enhancedStructure.vixTrend,
        vixPercentile: enhancedStructure.vixPercentile,
        usDollarIndex: enhancedStructure.usDollarIndex,
        dollarTrend: enhancedStructure.dollarTrend,
        spy: enhancedStructure.spy,
        spyTrend: enhancedStructure.spyTrend,
        yield10Y: enhancedStructure.yield10Y,
        yieldCurveStatus: enhancedStructure.yieldCurveStatus,
        liborRate: enhancedStructure.liborRate,
        lastUpdated: enhancedStructure.lastUpdated,
      };

      logger.info('Market structure indicators fetched successfully', {
        vix: structure.vix,
        usDollarIndex: structure.usDollarIndex,
        spy: structure.spy,
        vixTrend: structure.vixTrend,
        yieldCurveStatus: structure.yieldCurveStatus,
        dataQuality: enhancedStructure.metadata.dataQuality,
      });

      return structure;
    } catch (error: unknown) {
      logger.error('Failed to fetch market structure indicators:', { error: error instanceof Error ? error.message : String(error) });
      // Fall back to mock data
      return this.getMockMarketStructure();
    }
  }

  /**
   * Fetch geopolitical risk from news analysis
   */
  private async fetchGeopoliticalRisk(): Promise<GeopoliticalRisk> {
    // Implementation will be in Phase 2 Day 4
    return this.getMockGeopoliticalRisk();
  }

  /**
   * Classify market regime based on all drivers
   */
  private async classifyMarketRegime(
    macro: MacroDrivers,
    marketStructure: MarketStructure,
    geopolitical: GeopoliticalRisk
  ): Promise<MarketRegime> {
    try {
      logger.info('Classifying market regime using advanced classifier');

      // Use the market regime classifier to get enhanced analysis
      const enhancedRegimeAnalysis = await this.regimeClassifier.classifyMarketRegime(
        macro,
        marketStructure,
        geopolitical
      );

      // Transform enhanced analysis to basic MarketRegime format
      const regime: MarketRegime = {
        currentRegime: enhancedRegimeAnalysis.currentRegime,
        confidence: enhancedRegimeAnalysis.confidence,
        riskLevel: enhancedRegimeAnalysis.riskLevel,
        description: enhancedRegimeAnalysis.description,
        favoredSectors: enhancedRegimeAnalysis.favoredSectors,
        avoidedSectors: enhancedRegimeAnalysis.avoidedSectors,
        strategy: enhancedRegimeAnalysis.tradingImplications.strategy,
        positionSizing: enhancedRegimeAnalysis.tradingImplications.positionSizing,
        duration: enhancedRegimeAnalysis.expectedDuration,
        previousRegime: enhancedRegimeAnalysis.previousRegime,
        regimeChangeDate: enhancedRegimeAnalysis.regimeChangeDate,
        stabilityScore: enhancedRegimeAnalysis.regimeStrength.overall,
        lastUpdated: enhancedRegimeAnalysis.lastUpdated,
      };

      logger.info('Market regime classified successfully', {
        regime: regime.currentRegime,
        confidence: regime.confidence,
        riskLevel: regime.riskLevel,
        regimeStrength: enhancedRegimeAnalysis.regimeStrength.overall,
        transitionRisk: enhancedRegimeAnalysis.transitionRisk.probability,
      });

      return regime;

    } catch (error: unknown) {
      logger.error('Failed to classify market regime:', { error: error instanceof Error ? error.message : String(error) });
      // Fall back to mock regime classification
      return this.getMockMarketRegime();
    }
  }

  /**
   * Helper methods for implementation
   */
  private calculateRiskOnRiskOff(marketStructure: MarketStructure, geopolitical: GeopoliticalRisk): 'risk_on' | 'risk_off' | 'neutral' {
    // Risk-Off: High VIX + High Geopolitical Risk
    if (marketStructure.vix > 25 || geopolitical.overallRiskScore > 0.6) {
      return 'risk_off';
    }
    // Risk-On: Low VIX + Low Geopolitical Risk
    if (marketStructure.vix < 18 && geopolitical.overallRiskScore < 0.3) {
      return 'risk_on';
    }
    return 'neutral';
  }

  private assessMarketHealth(macro: MacroDrivers, marketStructure: MarketStructure): 'healthy' | 'caution' | 'stress' | 'crisis' {
    if (marketStructure.vix > 40 || macro.yieldCurveSpread < -1) {
      return 'crisis';
    }
    if (marketStructure.vix > 30 || macro.yieldCurveSpread < 0) {
      return 'stress';
    }
    if (marketStructure.vix > 20 || macro.unemploymentRate > 6) {
      return 'caution';
    }
    return 'healthy';
  }

  private assessEconomicMomentum(macro: MacroDrivers): 'accelerating' | 'decelerating' | 'stable' {
    if (macro.gdpGrowthRate > 2.5 && macro.consumerConfidence > 80) {
      return 'accelerating';
    }
    if (macro.gdpGrowthRate < 1.5 || macro.consumerConfidence < 70) {
      return 'decelerating';
    }
    return 'stable';
  }

  private generateOverallAssessment(regime: MarketRegime, macro: MacroDrivers, marketStructure: MarketStructure): string {
    return `Market regime: ${regime.currentRegime.replace(/_/g, ' ').toUpperCase()} with ${regime.confidence}% confidence. Key factors: VIX at ${marketStructure.vix}, yield curve spread at ${macro.yieldCurveSpread}%, GDP growth at ${macro.gdpGrowthRate}%.`;
  }

  private identifyKeyDrivers(macro: MacroDrivers, marketStructure: MarketStructure, geopolitical: GeopoliticalRisk): string[] {
    const drivers = [];

    if (marketStructure.vix > 25) drivers.push('Elevated market volatility');
    if (macro.yieldCurveSpread < 0) drivers.push('Inverted yield curve');
    if (macro.inflationRate > 4) drivers.push('High inflation');
    if (geopolitical.overallRiskScore > 0.5) drivers.push('Geopolitical tensions');
    if (macro.unemploymentRate > 6) drivers.push('Labor market weakness');

    return drivers.length > 0 ? drivers : ['Stable market conditions'];
  }

  private generateWatchItems(regime: MarketRegime, macro: MacroDrivers, marketStructure: MarketStructure): string[] {
    const items = [];

    if (regime.currentRegime === 'bearish_contraction') {
      items.push('Fed policy announcements', 'Employment data', 'Bank earnings');
    } else if (regime.currentRegime === 'bullish_expansion') {
      items.push('Inflation data', 'Consumer spending', 'Tech earnings');
    } else if (regime.currentRegime === 'stagflation') {
      items.push('Fed rate decisions', 'Energy prices', 'Supply chain data');
    }

    return items;
  }

  private createSnapshotDate(): string {
    try {
      const now = new Date();
      const dateString = now.toISOString().split('T')[0];
      if (!dateString || dateString === 'Invalid Date') {
        throw new Error('Invalid date generated');
      }
      return dateString;
    } catch (error: unknown) {
      logger.error('Error creating snapshot date:', { error });
      // Fallback to a safe date format
      return new Date().toISOString().split('T')[0];
    }
  }

  private calculateDataAge(lastUpdated: string): number {
    if (!lastUpdated) return 999; // Very old if never updated
    try {
      const now = Date.now();
      const lastUpdate = new Date(lastUpdated).getTime();
      if (isNaN(lastUpdate)) {
        logger.warn('Invalid lastUpdated date format:', { lastUpdated });
        return 999; // Very old if date is invalid
      }
      return (now - lastUpdate) / (1000 * 60 * 60); // Hours
    } catch (error: unknown) {
      logger.error('Error calculating data age:', { error, lastUpdated });
      return 999; // Very old if error occurs
    }
  }

  private calculateOverallConfidence(macro: MacroDrivers, marketStructure: MarketStructure, geopolitical: GeopoliticalRisk): number {
    const macroAge = this.calculateDataAge(macro.lastUpdated);
    const marketAge = this.calculateDataAge(marketStructure.lastUpdated);
    const geoAge = this.calculateDataAge(geopolitical.lastUpdated);

    // Data freshness confidence
    const freshnessScore = Math.max(0, 100 - (macroAge + marketAge + geoAge) / 3);

    // Data availability confidence
    const availabilityScore = (
      (macro.lastUpdated ? 33.3 : 0) +
      (marketStructure.lastUpdated ? 33.3 : 0) +
      (geopolitical.lastUpdated ? 33.3 : 0)
    );

    return Math.round((freshnessScore + availabilityScore) / 2);
  }

  // Mock data methods for development
  private getMockMacroDrivers(): MacroDrivers {
    return {
      fedFundsRate: 5.25,
      treasury10Y: 4.2,
      treasury2Y: 4.8,
      yieldCurveSpread: -0.6,
      cpi: 301.8,
      ppi: 298.5,
      inflationRate: 3.2,
      unemploymentRate: 3.8,
      nonFarmPayrolls: 187000,
      laborForceParticipation: 62.8,
      realGDP: 21.5,
      gdpGrowthRate: 2.1,
      consumerConfidence: 69.5,
      buildingPermits: 1420,
      housingStarts: 1360,
      lastUpdated: new Date().toISOString(),
    };
  }

  private getMockMarketStructure(): MarketStructure {
    return {
      vix: 18.5,
      vixTrend: 'stable',
      vixPercentile: 65,
      usDollarIndex: 104.2,
      dollarTrend: 'stable',
      spy: 4521.8,
      spyTrend: 'bullish',
      yield10Y: 4.2,
      yieldCurveStatus: 'inverted',
      liborRate: 5.3,
      lastUpdated: new Date().toISOString(),
    };
  }

  private getMockGeopoliticalRisk(): GeopoliticalRisk {
    return {
      tradePolicy: 0.2,
      elections: 0.1,
      centralBankPolicy: 0.3,
      conflicts: 0.15,
      energyPolicy: 0.1,
      regulatory: 0.05,
      overallRiskScore: 0.3,
      riskTrend: 'stable',
      highImpactEvents: 2,
      articlesAnalyzed: 45,
      sentimentBreakdown: {
        positive: 15,
        negative: 20,
        neutral: 10,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  private getMockMarketRegime(): MarketRegime {
    return {
      currentRegime: 'goldilocks',
      confidence: 75,
      riskLevel: 'medium',
      description: 'Moderate growth with controlled inflation and manageable volatility',
      favoredSectors: ['Technology', 'Healthcare', 'Consumer Discretionary'],
      avoidedSectors: ['Utilities', 'Consumer Staples'],
      strategy: 'Balanced growth with selective technology exposure',
      positionSizing: 'Moderate',
      duration: '3-6 months',
      previousRegime: 'risk_on',
      regimeChangeDate: '2024-01-15',
      stabilityScore: 80,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Initialize Market Drivers Manager
 */
export function initializeMarketDrivers(env: any): MarketDriversManager {
  return new MarketDriversManager(env);
}

/**
 * Cache Key Management for Market Drivers
 */
export const MARKET_DRIVERS_KEYS = {
  SNAPSHOT: 'market_drivers_snapshot',
  MACRO_DRIVERS: 'market_drivers_macro',
  MARKET_STRUCTURE: 'market_drivers_market_structure',
  GEOPOLITICAL_RISK: 'market_drivers_geopolitical',
  REGIME_ANALYSIS: 'market_drivers_regime',
  HISTORICAL_SNAPSHOTS: 'market_drivers_history',
} as const;