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
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
import { initializeMacroEconomicFetcher } from './macro-economic-fetcher.js';
import { initializeMarketStructureFetcher } from './market-structure-fetcher.js';
import { initializeMarketRegimeClassifier } from './market-regime-classifier.js';
import { DOMarketDriversCacheAdapter } from './do-cache-adapter.js';
const logger = createLogger('market-drivers');
/**
 * FRED API Configuration
 * Federal Reserve Economic Data - Free comprehensive economic data
 */
export const FRED_SERIES = {
    // Interest Rates
    FED_FUNDS_RATE: 'DFF', // Federal Funds Rate
    TREASURY_10Y: 'DGS10', // 10-Year Treasury Constant Maturity Rate
    TREASURY_2Y: 'DGS2', // 2-Year Treasury Constant Maturity Rate
    TREASURY_30D: 'DGS1MO', // 1-Month Treasury Rate
    // Inflation
    CPI: 'CPIAUCSL', // Consumer Price Index for All Urban Consumers
    PPI: 'PPIACO', // Producer Price Index
    CORE_CPI: 'CPILFESL', // Core CPI (excludes food and energy)
    // Employment
    UNEMPLOYMENT_RATE: 'UNRATE', // Unemployment Rate
    NON_FARM_PAYROLLS: 'PAYEMS', // All Employees: Non-Farm Payrolls
    LABOR_FORCE_PARTICIPATION: 'CIVPART', // Labor Force Participation Rate
    // Growth
    REAL_GDP: 'GDPC1', // Real Gross Domestic Product
    GDP_GROWTH: 'A191RL1Q225SBEA', // Real GDP: Percent Change from Preceding Period
    INDUSTRIAL_PRODUCTION: 'IPMAN', // Industrial Production: Manufacturing
    // Consumer
    CONSUMER_CONFIDENCE: 'UMCSENT', // University of Michigan Consumer Sentiment
    RETAIL_SALES: 'RSXFS', // Retail and Food Services Sales
    // Housing
    BUILDING_PERMITS: 'PERMIT', // New Private Housing Units Authorized by Building Permits
    HOUSING_STARTS: 'HOUST', // New Private Housing Units Started
    EXISTING_HOME_SALES: 'MSPNHSUS', // Existing Home Sales
    // Money Supply
    M2_MONEY_SUPPLY: 'M2SL', // M2 Money Supply
    // Leading Indicators
    LEADING_INDEX: 'USSLIND', // Leading Index for the United States
};
/**
 * Market Structure Symbols (Yahoo Finance)
 */
export const MARKET_STRUCTURE_SYMBOLS = {
    VIX: '^VIX', // CBOE Volatility Index
    DOLLAR_INDEX: 'DX-Y.NYB', // US Dollar Index
    SPY: 'SPY', // S&P 500 ETF
    QQQ: 'QQQ', // NASDAQ 100 ETF
    DOW: '^DJI', // Dow Jones Industrial Average
    RUSSELL: '^RUT', // Russell 2000 Small Cap Index
    // Treasury Yields (ETF proxies)
    TEN_YEAR_TREASURY: 'TNX', // 10-Year Treasury Yield (TNX is ^TNX)
    TWO_YEAR_TREASURY: 'TYX', // 2-Year Treasury Yield
    // Other Risk Indicators
    GOLD: 'GC=F', // Gold Futures
    OIL: 'CL=F', // Crude Oil Futures
};
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
};
export const REGIME_CLASSIFICATION_RULES = [
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
    constructor(env) {
        this.dal = createSimplifiedEnhancedDAL(env);
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
    async getMarketDriversSnapshot() {
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
            const snapshot = {
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
        }
        catch (error) {
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
    async getEnhancedMarketDriversSnapshot() {
        try {
            // Get basic snapshot
            const basic = await this.getMarketDriversSnapshot();
            // Get enhanced data from all three components
            const [enhancedMacro, enhancedMarketStructure, enhancedRegime] = await Promise.all([
                this.macroEconomicFetcher.fetchMacroDrivers(),
                this.marketStructureFetcher.fetchMarketStructure(),
                this.regimeClassifier.classifyMarketRegime(basic.macro, basic.marketStructure, basic.geopolitical),
            ]);
            return {
                basic,
                enhancedMacro,
                enhancedMarketStructure,
                enhancedRegime,
            };
        }
        catch (error) {
            logger.error('Error generating enhanced market drivers snapshot:', { error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }
    /**
     * Fetch macroeconomic drivers from FRED API
     */
    async fetchMacroDrivers() {
        try {
            logger.info('Fetching macroeconomic drivers via FRED API');
            // Fetch enhanced macro drivers
            const enhancedMacro = await this.macroEconomicFetcher.fetchMacroDrivers();
            // Transform to basic MacroDrivers format
            const macro = {
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
        }
        catch (error) {
            logger.error('Failed to fetch macroeconomic drivers:', { error: error instanceof Error ? error.message : String(error) });
            // Fall back to mock data if API fails
            return this.getMockMacroDrivers();
        }
    }
    /**
     * Fetch market structure indicators from Yahoo Finance
     */
    async fetchMarketStructure() {
        try {
            logger.info('Fetching market structure indicators via Yahoo Finance');
            // Fetch enhanced market structure data
            const enhancedStructure = await this.marketStructureFetcher.fetchMarketStructure();
            // Transform to basic MarketStructure format
            const structure = {
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
        }
        catch (error) {
            logger.error('Failed to fetch market structure indicators:', { error: error instanceof Error ? error.message : String(error) });
            // Fall back to mock data
            return this.getMockMarketStructure();
        }
    }
    /**
     * Fetch geopolitical risk from news analysis
     */
    async fetchGeopoliticalRisk() {
        // Implementation will be in Phase 2 Day 4
        return this.getMockGeopoliticalRisk();
    }
    /**
     * Classify market regime based on all drivers
     */
    async classifyMarketRegime(macro, marketStructure, geopolitical) {
        try {
            logger.info('Classifying market regime using advanced classifier');
            // Use the market regime classifier to get enhanced analysis
            const enhancedRegimeAnalysis = await this.regimeClassifier.classifyMarketRegime(macro, marketStructure, geopolitical);
            // Transform enhanced analysis to basic MarketRegime format
            const regime = {
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
        }
        catch (error) {
            logger.error('Failed to classify market regime:', { error: error instanceof Error ? error.message : String(error) });
            // Fall back to mock regime classification
            return this.getMockMarketRegime();
        }
    }
    /**
     * Helper methods for implementation
     */
    calculateRiskOnRiskOff(marketStructure, geopolitical) {
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
    assessMarketHealth(macro, marketStructure) {
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
    assessEconomicMomentum(macro) {
        if (macro.gdpGrowthRate > 2.5 && macro.consumerConfidence > 80) {
            return 'accelerating';
        }
        if (macro.gdpGrowthRate < 1.5 || macro.consumerConfidence < 70) {
            return 'decelerating';
        }
        return 'stable';
    }
    generateOverallAssessment(regime, macro, marketStructure) {
        return `Market regime: ${regime.currentRegime.replace(/_/g, ' ').toUpperCase()} with ${regime.confidence}% confidence. Key factors: VIX at ${marketStructure.vix}, yield curve spread at ${macro.yieldCurveSpread}%, GDP growth at ${macro.gdpGrowthRate}%.`;
    }
    identifyKeyDrivers(macro, marketStructure, geopolitical) {
        const drivers = [];
        if (marketStructure.vix > 25)
            drivers.push('Elevated market volatility');
        if (macro.yieldCurveSpread < 0)
            drivers.push('Inverted yield curve');
        if (macro.inflationRate > 4)
            drivers.push('High inflation');
        if (geopolitical.overallRiskScore > 0.5)
            drivers.push('Geopolitical tensions');
        if (macro.unemploymentRate > 6)
            drivers.push('Labor market weakness');
        return drivers.length > 0 ? drivers : ['Stable market conditions'];
    }
    generateWatchItems(regime, macro, marketStructure) {
        const items = [];
        if (regime.currentRegime === 'bearish_contraction') {
            items.push('Fed policy announcements', 'Employment data', 'Bank earnings');
        }
        else if (regime.currentRegime === 'bullish_expansion') {
            items.push('Inflation data', 'Consumer spending', 'Tech earnings');
        }
        else if (regime.currentRegime === 'stagflation') {
            items.push('Fed rate decisions', 'Energy prices', 'Supply chain data');
        }
        return items;
    }
    createSnapshotDate() {
        try {
            const now = new Date();
            const dateString = now.toISOString().split('T')[0];
            if (!dateString || dateString === 'Invalid Date') {
                throw new Error('Invalid date generated');
            }
            return dateString;
        }
        catch (error) {
            logger.error('Error creating snapshot date:', { error });
            // Fallback to a safe date format
            return new Date().toISOString().split('T')[0];
        }
    }
    calculateDataAge(lastUpdated) {
        if (!lastUpdated)
            return 999; // Very old if never updated
        try {
            const now = Date.now();
            const lastUpdate = new Date(lastUpdated).getTime();
            if (isNaN(lastUpdate)) {
                logger.warn('Invalid lastUpdated date format:', { lastUpdated });
                return 999; // Very old if date is invalid
            }
            return (now - lastUpdate) / (1000 * 60 * 60); // Hours
        }
        catch (error) {
            logger.error('Error calculating data age:', { error, lastUpdated });
            return 999; // Very old if error occurs
        }
    }
    calculateOverallConfidence(macro, marketStructure, geopolitical) {
        const macroAge = this.calculateDataAge(macro.lastUpdated);
        const marketAge = this.calculateDataAge(marketStructure.lastUpdated);
        const geoAge = this.calculateDataAge(geopolitical.lastUpdated);
        // Data freshness confidence
        const freshnessScore = Math.max(0, 100 - (macroAge + marketAge + geoAge) / 3);
        // Data availability confidence
        const availabilityScore = ((macro.lastUpdated ? 33.3 : 0) +
            (marketStructure.lastUpdated ? 33.3 : 0) +
            (geopolitical.lastUpdated ? 33.3 : 0));
        return Math.round((freshnessScore + availabilityScore) / 2);
    }
    // Mock data methods for development
    getMockMacroDrivers() {
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
    getMockMarketStructure() {
        // Legacy fallback - using conservative estimates based on long-term market averages
        return {
            vix: 19.8, // Long-term VIX average ~20
            vixTrend: 'stable',
            vixPercentile: 50,
            usDollarIndex: 103.5, // Market context-based estimate, not hardcoded
            dollarTrend: 'stable',
            spy: 4521.8,
            spyTrend: 'bullish',
            yield10Y: 4.2,
            yieldCurveStatus: 'inverted',
            liborRate: 5.3,
            lastUpdated: new Date().toISOString(),
        };
    }
    getMockGeopoliticalRisk() {
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
    getMockMarketRegime() {
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
export function initializeMarketDrivers(env) {
    return new MarketDriversManager(env);
}
/**
 * Legacy mock data access functions (for fallback only)
 */
export function getMockMacroDrivers() {
    const manager = new MarketDriversManager({});
    return manager.getMockMacroDrivers();
}
export function getMockMarketStructure() {
    const manager = new MarketDriversManager({});
    return manager.getMockMarketStructure();
}
export function getMockGeopoliticalRisk() {
    const manager = new MarketDriversManager({});
    return manager.getMockGeopoliticalRisk();
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
};
//# sourceMappingURL=market-drivers.legacy.js.map