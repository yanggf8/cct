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
import { type EnhancedMacroDrivers } from './macro-economic-fetcher.js';
import { type EnhancedMarketStructure } from './market-structure-fetcher.js';
import { type EnhancedRegimeAnalysis } from './market-regime-classifier.js';
/**
 * Core Market Drivers Interfaces
 */
export interface MacroDrivers {
    fedFundsRate: number;
    treasury10Y: number;
    treasury2Y: number;
    yieldCurveSpread: number;
    cpi: number;
    ppi: number;
    inflationRate: number;
    unemploymentRate: number;
    nonFarmPayrolls: number;
    laborForceParticipation: number;
    realGDP: number;
    gdpGrowthRate: number;
    consumerConfidence: number;
    buildingPermits: number;
    housingStarts: number;
    lastUpdated: string;
}
export interface MarketStructure {
    vix: number;
    vixTrend: 'rising' | 'falling' | 'stable';
    vixPercentile: number;
    usDollarIndex: number;
    dollarTrend: 'strengthening' | 'weakening' | 'stable';
    spy: number;
    spyTrend: 'bullish' | 'bearish' | 'neutral';
    yield10Y: number;
    yield2Y: number;
    yieldCurveStatus: 'normal' | 'flat' | 'inverted';
    liborRate: number;
    lastUpdated: string;
}
export interface GeopoliticalRisk {
    tradePolicy: number;
    elections: number;
    centralBankPolicy: number;
    conflicts: number;
    energyPolicy: number;
    regulatory: number;
    overallRiskScore: number;
    riskTrend: 'increasing' | 'decreasing' | 'stable';
    highImpactEvents: number;
    articlesAnalyzed: number;
    sentimentBreakdown: {
        positive: number;
        negative: number;
        neutral: number;
    };
    lastUpdated: string;
}
export interface MarketRegime {
    currentRegime: MarketRegimeType;
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    description: string;
    favoredSectors: string[];
    avoidedSectors: string[];
    strategy: string;
    positionSizing: string;
    duration: string;
    previousRegime: MarketRegimeType;
    regimeChangeDate: string;
    stabilityScore: number;
    lastUpdated: string;
}
export type MarketRegimeType = 'bullish_expansion' | 'bearish_contraction' | 'stagflation' | 'goldilocks' | 'risk_off' | 'risk_on' | 'transitioning' | 'uncertain';
export interface MarketDriversSnapshot {
    timestamp: number;
    date: string;
    macro: MacroDrivers;
    marketStructure: MarketStructure;
    geopolitical: GeopoliticalRisk;
    regime: MarketRegime;
    riskOnRiskOff: 'risk_on' | 'risk_off' | 'neutral';
    marketHealth: 'healthy' | 'caution' | 'stress' | 'crisis';
    economicMomentum: 'accelerating' | 'decelerating' | 'stable';
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
            macro: number;
            market: number;
            geopolitical: number;
        };
        confidenceLevel: number;
    };
}
/**
 * FRED API Configuration
 * Federal Reserve Economic Data - Free comprehensive economic data
 */
export declare const FRED_SERIES: {
    readonly FED_FUNDS_RATE: "DFF";
    readonly TREASURY_10Y: "DGS10";
    readonly TREASURY_2Y: "DGS2";
    readonly TREASURY_30D: "DGS1MO";
    readonly CPI: "CPIAUCSL";
    readonly PPI: "PPIACO";
    readonly CORE_CPI: "CPILFESL";
    readonly UNEMPLOYMENT_RATE: "UNRATE";
    readonly NON_FARM_PAYROLLS: "PAYEMS";
    readonly LABOR_FORCE_PARTICIPATION: "CIVPART";
    readonly REAL_GDP: "GDPC1";
    readonly GDP_GROWTH: "A191RL1Q225SBEA";
    readonly INDUSTRIAL_PRODUCTION: "IPMAN";
    readonly CONSUMER_CONFIDENCE: "UMCSENT";
    readonly RETAIL_SALES: "RSXFS";
    readonly BUILDING_PERMITS: "PERMIT";
    readonly HOUSING_STARTS: "HOUST";
    readonly EXISTING_HOME_SALES: "MSPNHSUS";
    readonly M2_MONEY_SUPPLY: "M2SL";
    readonly LEADING_INDEX: "USSLIND";
};
export type FredSeries = typeof FRED_SERIES[keyof typeof FRED_SERIES];
/**
 * Market Structure Symbols (Yahoo Finance)
 */
export declare const MARKET_STRUCTURE_SYMBOLS: {
    readonly VIX: "^VIX";
    readonly DOLLAR_INDEX: "DX-Y.NYB";
    readonly SPY: "SPY";
    readonly QQQ: "QQQ";
    readonly DOW: "^DJI";
    readonly RUSSELL: "^RUT";
    readonly TEN_YEAR_TREASURY: "TNX";
    readonly TWO_YEAR_TREASURY: "TYX";
    readonly GOLD: "GC=F";
    readonly OIL: "CL=F";
};
/**
 * Geopolitical Risk Categories and Keywords
 */
export declare const GEOPOLITICAL_CATEGORIES: {
    readonly TRADE_POLICY: {
        readonly keywords: readonly ["tariff", "trade war", "trade deal", "import", "export", "sanction"];
        readonly weight: 0.2;
    };
    readonly ELECTIONS: {
        readonly keywords: readonly ["election", "president", "congress", "vote", "campaign", "ballot"];
        readonly weight: 0.15;
    };
    readonly CENTRAL_BANK: {
        readonly keywords: readonly ["federal reserve", "fed", "jerome powell", "interest rate", "monetary policy"];
        readonly weight: 0.25;
    };
    readonly CONFLICTS: {
        readonly keywords: readonly ["war", "conflict", "military", "attack", "tension", "geopolitical"];
        readonly weight: 0.2;
    };
    readonly ENERGY_POLICY: {
        readonly keywords: readonly ["opec", "energy policy", "oil", "petroleum", "strategic reserve"];
        readonly weight: 0.1;
    };
    readonly REGULATORY: {
        readonly keywords: readonly ["regulation", "sec", "antitrust", "compliance", "policy"];
        readonly weight: 0.1;
    };
};
/**
 * Market Regime Classification Rules
 */
export interface RegimeRule {
    name: string;
    conditions: {
        vix?: {
            min?: number;
            max?: number;
            operator?: 'lt' | 'gt' | 'eq';
        };
        yieldCurve?: {
            min?: number;
            max?: number;
            operator?: 'lt' | 'gt' | 'eq';
        };
        gdpGrowth?: {
            min?: number;
            max?: number;
            operator?: 'lt' | 'gt' | 'eq';
        };
        inflation?: {
            min?: number;
            max?: number;
            operator?: 'lt' | 'gt' | 'eq';
        };
        geopoliticalRisk?: {
            min?: number;
            max?: number;
            operator?: 'lt' | 'gt' | 'eq';
        };
    };
    result: MarketRegimeType;
    confidence: number;
}
export declare const REGIME_CLASSIFICATION_RULES: RegimeRule[];
/**
 * Main Market Drivers Manager
 */
export declare class MarketDriversManager {
    private dal;
    private cacheManager;
    private macroEconomicFetcher;
    private marketStructureFetcher;
    private regimeClassifier;
    private fredApiKey?;
    constructor(env: any);
    /**
     * Get complete Market Drivers snapshot
     */
    getMarketDriversSnapshot(): Promise<MarketDriversSnapshot>;
    /**
     * Get enhanced market drivers snapshot with full regime analysis
     */
    getEnhancedMarketDriversSnapshot(): Promise<{
        basic: MarketDriversSnapshot;
        enhancedMacro: EnhancedMacroDrivers;
        enhancedMarketStructure: EnhancedMarketStructure;
        enhancedRegime: EnhancedRegimeAnalysis;
    }>;
    /**
     * Fetch macroeconomic drivers from FRED API
     */
    private fetchMacroDrivers;
    /**
     * Fetch market structure indicators from Yahoo Finance
     */
    private fetchMarketStructure;
    /**
     * Fetch geopolitical risk from news analysis
     */
    private fetchGeopoliticalRisk;
    /**
     * Classify market regime based on all drivers
     */
    private classifyMarketRegime;
    /**
     * Helper methods for implementation
     */
    private calculateRiskOnRiskOff;
    private assessMarketHealth;
    private assessEconomicMomentum;
    private generateOverallAssessment;
    private identifyKeyDrivers;
    private generateWatchItems;
    private createSnapshotDate;
    private calculateDataAge;
    private calculateOverallConfidence;
    private getMockMacroDrivers;
    private getMockMarketStructure;
    private getMockGeopoliticalRisk;
    private getMockMarketRegime;
}
/**
 * Initialize Market Drivers Manager
 */
export declare function initializeMarketDrivers(env: any): MarketDriversManager;
/**
 * Legacy mock data access functions (for fallback only)
 */
export declare function getMockMacroDrivers(): any;
export declare function getMockMarketStructure(): any;
export declare function getMockGeopoliticalRisk(): any;
/**
 * Cache Key Management for Market Drivers
 */
export declare const MARKET_DRIVERS_KEYS: {
    readonly SNAPSHOT: "market_drivers_snapshot";
    readonly MACRO_DRIVERS: "market_drivers_macro";
    readonly MARKET_STRUCTURE: "market_drivers_market_structure";
    readonly GEOPOLITICAL_RISK: "market_drivers_geopolitical";
    readonly REGIME_ANALYSIS: "market_drivers_regime";
    readonly HISTORICAL_SNAPSHOTS: "market_drivers_history";
};
//# sourceMappingURL=market-drivers.legacy.d.ts.map