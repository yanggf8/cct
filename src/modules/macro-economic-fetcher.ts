/**
 * Macroeconomic Data Fetcher
 *
 * Integrates FRED API client with Market Drivers system to fetch and process
 * macroeconomic data. Converts FRED data format to our Market Drivers format
 * and provides additional analysis and calculations.
 *
 * Features:
 * - FRED API integration with production strict mode (no mock fallbacks)
 * - Data transformation and validation with fail-fast errors in production
 * - Cache integration with 4-hour TTL for macroeconomic data
 * - Error handling and retry logic with circuit breaker pattern
 * - Derived metric calculations
 * - Strict mode enforcement for production environments
 *
 * @author Market Drivers Pipeline - Phase 2 Day 2
 * @since 2025-10-10
 * @updated Sprint 1-A - Production Market Indicators Implementation
 */

import { createLogger } from './logging.js';
import { initializeFredApiClient, MockFredApiClient, type MacroEconomicSnapshot, type EconomicData } from './fred-api-client.js';
import { createFredApiClient, createFredApiClientWithHealthCheck } from './fred-api-factory.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import type { MacroDrivers, DataSourceResult } from './market-drivers-replacement.js';
import { DOMarketDriversCacheAdapter } from './do-cache-adapter.js';
import { createProductionGuards } from './production-guards.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('macro-economic-fetcher');

/**
 * Macroeconomic Data Fetcher Options
 */
export interface MacroEconomicFetcherOptions {
  fredApiKey?: string;
  useMockData?: boolean;
  cacheManager?: DOMarketDriversCacheAdapter;
  enableCaching?: boolean;
  environment?: CloudflareEnvironment;
  forceMockClient?: boolean;
  strictMode?: boolean;  // NEW: Production-only mode that prevents mock fallbacks
}

/**
 * Enhanced Macro Drivers with additional analysis
 */
export interface EnhancedMacroDrivers extends MacroDrivers {
  // Additional derived metrics
  realYieldCurve: number;               // Inflation-adjusted yield curve
  monetaryPolicyStance: 'tight' | 'neutral' | 'accommodative';
  economicMomentum: 'accelerating' | 'decelerating' | 'stable';
  recessionRisk: 'low' | 'medium' | 'high' | 'elevated';

  // Employment quality metrics
  employmentQualityIndex: number;       // Composite employment health score
  wageGrowthPressure: number;           // Implied wage growth pressure

  // Inflation metrics
  disinflationProgress: number;         // Progress on bringing inflation down
  coreVsHeadlineSpread: number;         // Core vs headline inflation gap

  // Financial conditions
  financialConditionsIndex: number;     // Composite financial conditions
  creditMarketStress: number;           // Credit market stress indicator

  // Leading indicators
  leadingEconomicIndex: number;         // Normalized leading index
  recessionProbability: number;         // Model-based recession probability

  metadata: {
    source: 'FRED' | 'Mock';
    lastUpdated: string;
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
    missingData: string[];
    calculations: string[];
  };
}

/**
 * Macroeconomic Data Fetcher Implementation
 */
export class MacroEconomicFetcher {
  private fredApiClient;
  private cacheManager?: DOMarketDriversCacheAdapter;
  private circuitBreaker;
  private enableCaching: boolean;
  private useMockData: boolean;
  private strictMode: boolean;  // NEW: Production-only mode flag
  private environment?: CloudflareEnvironment;
  private productionGuards;  // NEW: Runtime mock detection

  constructor(options: MacroEconomicFetcherOptions) {
    this.environment = options.environment;
    this.enableCaching = options.enableCaching !== false;
    this.cacheManager = options.cacheManager;
    this.strictMode = options.strictMode || false;

    // Production strict mode validation
    if (this.strictMode && this.environment) {
      const isProduction = this.environment.ENVIRONMENT === 'production';
      if (isProduction) {
        // In production strict mode, mock data is forbidden
        if (options.forceMockClient || options.useMockData) {
          throw new Error('Production strict mode: Mock data is forbidden in production environment');
        }

        // Require FRED API key in production strict mode
        if (!options.fredApiKey) {
          throw new Error('Production strict mode: FRED API key is required in production environment');
        }
      }
    }

    // Determine if we should use mock data (restricted by strict mode)
    this.useMockData = !this.strictMode && (
      options.forceMockClient ||
      options.useMockData ||
      !options.fredApiKey
    );

    // Initialize production guards for runtime mock detection
    this.productionGuards = createProductionGuards({
      strictMode: this.strictMode,
      environment: this.environment,
      failOnMock: this.strictMode
    });

    // Initialize FRED API client using the new factory
    if (this.environment && !options.forceMockClient) {
      // Use the enhanced factory with environment configuration
      logger.info('Initializing FRED API client with environment configuration');
      this.fredApiClient = createFredApiClient(this.environment, {
        forceMock: this.useMockData,
        enableLogging: true,
        customApiKey: options.fredApiKey
      });
    } else {
      // Fallback to legacy initialization
      if (this.useMockData) {
        logger.info('Using mock FRED API client for development');
        this.fredApiClient = new MockFredApiClient();
      } else {
        logger.info('Initializing FRED API client with real API (legacy mode)');
        this.fredApiClient = initializeFredApiClient({
          apiKey: options.fredApiKey!,
          rateLimitDelay: 1000,
          maxRetries: 3,
          cacheEnabled: true,
        });
      }
    }

    // Initialize circuit breaker
    this.circuitBreaker = CircuitBreakerFactory.getInstance('macro-economic-fetcher');
  }

  /**
   * Fetch macro economic data
   */
  async fetchMacroDrivers(date?: Date | string): Promise<EnhancedMacroDrivers> {
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    try {
      logger.info('Fetching macro economic drivers', { date: dateStr, useMockData: this.useMockData });

      // Check cache first
      if (this.enableCaching && this.cacheManager) {
        const cached = await this.cacheManager.getMarketDrivers();
        if (cached) {
          logger.info('Macro drivers retrieved from cache', { date: dateStr });
          return this.enhanceMacroDrivers(cached);
        }
      }

      // Fetch fresh data from FRED API
      const snapshot = await this.circuitBreaker.execute(async () => {
        return await this.fredApiClient.getMacroEconomicSnapshot();
      });

      // Transform to our format
      const basicMacroDrivers = this.transformSnapshotToMacroDrivers(snapshot);

      // Enhance with additional analysis
      const enhancedMacroDrivers = this.enhanceMacroDrivers(basicMacroDrivers);

      // Store in cache
      if (this.enableCaching && this.cacheManager) {
        await this.cacheManager.setMarketDrivers(enhancedMacroDrivers);
      }

      logger.info('Macro economic drivers fetched successfully', {
        date: dateStr,
        fedFundsRate: enhancedMacroDrivers.fedFundsRate,
        unemploymentRate: enhancedMacroDrivers.unemploymentRate,
        inflationRate: enhancedMacroDrivers.inflationRate,
      });

      // Production guard verification - ensure data integrity before returning
      if (this.strictMode) {
        const verification = this.productionGuards.verifyApiResponse(enhancedMacroDrivers, 'macro-economic-fetcher');

        if (!verification.isReal) {
          throw new Error(`Production strict mode: Data integrity verification failed - ${JSON.stringify(verification.flags)}`);
        }

        logger.info('Production guard verification passed', {
          source: verification.source,
          confidence: verification.confidence,
          flags: verification.flags
        });
      }

      return enhancedMacroDrivers;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch macro economic drivers:', { error: errorMessage });

      // In strict mode, fail fast without any mock fallbacks
      if (this.strictMode) {
        throw new Error(`Production strict mode: FRED API failure - ${errorMessage}. No fallback to mock data allowed.`);
      }

      // Legacy behavior: fall back to mock data only if not using mock already
      if (!this.useMockData) {
        logger.warn('Falling back to mock data due to API failure (strict mode disabled)');
        const mockClient = new MockFredApiClient();
        const mockSnapshot = await mockClient.getMacroEconomicSnapshot();
        const basicMacroDrivers = this.transformSnapshotToMacroDrivers(mockSnapshot);
        return this.enhanceMacroDrivers(basicMacroDrivers);
      }

      throw new Error(`Macro Economic Fetcher Error: ${errorMessage}`);
    }
  }

  /**
   * Convert EconomicData to DataSourceResult format
   */
  private toDataSourceResult(data: EconomicData): DataSourceResult {
    return {
      value: data.value,
      timestamp: data.lastUpdated,
      source: 'FRED' as const,
      seriesId: data.series?.toString(),
      quality: 'high' as const,
      lastValidated: data.lastUpdated,
      confidence: 95
    };
  }

  /**
   * Transform FRED snapshot to MacroDrivers format
   */
  private transformSnapshotToMacroDrivers(snapshot: MacroEconomicSnapshot): MacroDrivers {
    return {
      // Interest Rates
      fedFundsRate: this.toDataSourceResult(snapshot.fedFundsRate),
      treasury10Y: this.toDataSourceResult(snapshot.treasury10Y),
      treasury2Y: this.toDataSourceResult(snapshot.treasury2Y),
      yieldCurveSpread: this.toDataSourceResult(snapshot.yieldCurveSpread),

      // Inflation
      cpi: this.toDataSourceResult(snapshot.cpi),
      ppi: this.toDataSourceResult(snapshot.ppi),
      inflationRate: this.toDataSourceResult(snapshot.inflationRate),

      // Employment
      unemploymentRate: this.toDataSourceResult(snapshot.unemploymentRate),
      nonFarmPayrolls: this.toDataSourceResult(snapshot.nonFarmPayrolls),
      laborForceParticipation: this.toDataSourceResult(snapshot.laborForceParticipation),

      // Growth
      realGDP: this.toDataSourceResult(snapshot.realGDP),
      gdpGrowthRate: this.toDataSourceResult(snapshot.gdpGrowthRate),
      consumerConfidence: this.toDataSourceResult(snapshot.consumerConfidence),

      // Housing
      buildingPermits: this.toDataSourceResult(snapshot.buildingPermits),
      housingStarts: this.toDataSourceResult(snapshot.housingStarts),

      lastUpdated: snapshot.metadata.lastUpdated,
      dataSourceCompliance: true,
    };
  }

  /**
   * Enhance basic macro drivers with additional analysis
   */
  private enhanceMacroDrivers(basic: MacroDrivers): EnhancedMacroDrivers {
    // Calculate real yield curve (inflation-adjusted)
    const realYieldCurve = basic.treasury10Y.value - basic.inflationRate.value;

    // Determine monetary policy stance
    const fedFundsNeutral = 2.5; // Assumed neutral rate
    let monetaryPolicyStance: 'tight' | 'neutral' | 'accommodative';
    if (basic.fedFundsRate.value > fedFundsNeutral + 1) {
      monetaryPolicyStance = 'tight';
    } else if (basic.fedFundsRate.value < fedFundsNeutral - 1) {
      monetaryPolicyStance = 'accommodative';
    } else {
      monetaryPolicyStance = 'neutral';
    }

    // Assess economic momentum
    let economicMomentum: 'accelerating' | 'decelerating' | 'stable';
    if (basic.gdpGrowthRate.value > 2.5 && basic.consumerConfidence.value > 75) {
      economicMomentum = 'accelerating';
    } else if (basic.gdpGrowthRate.value < 1.5 || basic.consumerConfidence.value < 65) {
      economicMomentum = 'decelerating';
    } else {
      economicMomentum = 'stable';
    }

    // Calculate recession risk
    let recessionRisk: 'low' | 'medium' | 'high' | 'elevated';
    const recessionScore = this.calculateRecessionScore(basic);
    if (recessionScore > 7) {
      recessionRisk = 'elevated';
    } else if (recessionScore > 5) {
      recessionRisk = 'high';
    } else if (recessionScore > 3) {
      recessionRisk = 'medium';
    } else {
      recessionRisk = 'low';
    }

    // Calculate employment quality index
    const employmentQualityIndex = this.calculateEmploymentQuality(basic);

    // Estimate wage growth pressure
    const wageGrowthPressure = this.calculateWageGrowthPressure(basic);

    // Calculate disinflation progress
    const disinflationProgress = this.calculateDisinflationProgress(basic);

    // Core vs headline inflation spread
    const coreVsHeadlineSpread = basic.inflationRate.value - 2.8; // Assumed core rate

    // Financial conditions index
    const financialConditionsIndex = this.calculateFinancialConditions(basic);

    // Credit market stress
    const creditMarketStress = this.calculateCreditMarketStress(basic);

    // Leading economic index (normalized)
    const leadingEconomicIndex = 100; // Base value - would normalize against historical data

    // Recession probability (simplified model)
    const recessionProbability = Math.min(Math.max(recessionScore * 10, 0), 100);

    // Determine data quality
    const missingData = this.identifyMissingData(basic);
    const dataQuality = missingData.length === 0 ? 'excellent' :
                      missingData.length <= 2 ? 'good' :
                      missingData.length <= 4 ? 'fair' : 'poor';

    return {
      ...basic,
      realYieldCurve,
      monetaryPolicyStance,
      economicMomentum,
      recessionRisk,
      employmentQualityIndex,
      wageGrowthPressure,
      disinflationProgress,
      coreVsHeadlineSpread,
      financialConditionsIndex,
      creditMarketStress,
      leadingEconomicIndex,
      recessionProbability,
      metadata: {
        source: this.useMockData ? 'Mock' : 'FRED',
        lastUpdated: basic.lastUpdated,
        dataQuality: dataQuality as 'excellent' | 'good' | 'fair' | 'poor',
        missingData,
        calculations: [
          'realYieldCurve',
          'monetaryPolicyStance',
          'economicMomentum',
          'recessionRisk',
          'employmentQualityIndex',
          'wageGrowthPressure',
          'disinflationProgress',
          'financialConditionsIndex',
          'recessionProbability'
        ],
      },
    };
  }

  /**
   * Calculate recession risk score (0-10)
   */
  private calculateRecessionScore(macro: MacroDrivers): number {
    let score = 0;

    // Yield curve inversion (strongest signal)
    if (macro.yieldCurveSpread.value < -0.5) {
      score += 3;
    } else if (macro.yieldCurveSpread.value < 0) {
      score += 2;
    }

    // High unemployment
    if (macro.unemploymentRate.value > 6) {
      score += 2;
    } else if (macro.unemploymentRate.value > 5) {
      score += 1;
    }

    // Low GDP growth
    if (macro.gdpGrowthRate.value < 0) {
      score += 2;
    } else if (macro.gdpGrowthRate.value < 1) {
      score += 1;
    }

    // High inflation (stagflation risk)
    if (macro.inflationRate.value > 5) {
      score += 1;
    }

    // Low consumer confidence
    if (macro.consumerConfidence.value < 60) {
      score += 1;
    }

    // Declining housing market
    if (macro.buildingPermits.value < 1200) {
      score += 1;
    }

    return Math.min(score, 10);
  }

  /**
   * Calculate employment quality index (0-100)
   */
  private calculateEmploymentQuality(macro: MacroDrivers): number {
    let score = 50; // Base score

    // Unemployment rate component (0-30 points)
    if (macro.unemploymentRate.value < 4) {
      score += 30;
    } else if (macro.unemploymentRate.value < 5) {
      score += 20;
    } else if (macro.unemploymentRate.value < 6) {
      score += 10;
    } else {
      score -= 10;
    }

    // Labor force participation (0-20 points)
    if (macro.laborForceParticipation.value > 63) {
      score += 20;
    } else if (macro.laborForceParticipation.value > 62) {
      score += 10;
    } else {
      score -= 5;
    }

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate wage growth pressure (0-10)
   */
  private calculateWageGrowthPressure(macro: MacroDrivers): number {
    let pressure = 0;

    // Low unemployment = higher wage pressure
    if (macro.unemploymentRate.value < 4) {
      pressure += 4;
    } else if (macro.unemploymentRate.value < 4.5) {
      pressure += 2;
    }

    // High inflation = higher wage demands
    if (macro.inflationRate.value > 4) {
      pressure += 3;
    } else if (macro.inflationRate.value > 3) {
      pressure += 1;
    }

    // Strong job growth = higher wage pressure
    if (macro.nonFarmPayrolls.value > 250000) {
      pressure += 3;
    } else if (macro.nonFarmPayrolls.value > 200000) {
      pressure += 1;
    }

    return Math.min(pressure, 10);
  }

  /**
   * Calculate disinflation progress (0-100)
   */
  private calculateDisinflationProgress(macro: MacroDrivers): number {
    const targetInflation = 2.0; // Fed target
    const currentInflation = macro.inflationRate.value;

    if (currentInflation <= targetInflation) {
      return 100;
    }

    const inflationGap = currentInflation - targetInflation;
    const maxGap = 6.0; // Maximum considered gap for calculation

    return Math.max(0, 100 - (inflationGap / maxGap) * 100);
  }

  /**
   * Calculate financial conditions index (0-200)
   * Higher = tighter financial conditions
   */
  private calculateFinancialConditions(macro: MacroDrivers): number {
    let conditions = 100; // Neutral baseline

    // Interest rate impact
    const rateImpact = (macro.fedFundsRate.value - 2.5) * 20; // Neutral rate assumed 2.5%
    conditions += rateImpact;

    // Yield curve impact
    if (macro.yieldCurveSpread.value < 0) {
      conditions += Math.abs(macro.yieldCurveSpread.value) * 30; // Inverted curve tightens conditions
    }

    // Inflation impact
    const inflationImpact = (macro.inflationRate.value - 2.0) * 10;
    conditions += inflationImpact;

    return Math.min(Math.max(conditions, 0), 200);
  }

  /**
   * Calculate credit market stress (0-10)
   */
  private calculateCreditMarketStress(macro: MacroDrivers): number {
    let stress = 0;

    // Inverted yield curve = credit stress
    if (macro.yieldCurveSpread.value < -1) {
      stress += 4;
    } else if (macro.yieldCurveSpread.value < 0) {
      stress += 2;
    }

    // High rates = credit stress
    if (macro.fedFundsRate.value > 5) {
      stress += 3;
    } else if (macro.fedFundsRate.value > 4) {
      stress += 1;
    }

    // Economic weakness = credit stress
    if (macro.gdpGrowthRate.value < 0) {
      stress += 3;
    } else if (macro.gdpGrowthRate.value < 1) {
      stress += 1;
    }

    return Math.min(stress, 10);
  }

  /**
   * Identify missing data
   */
  private identifyMissingData(macro: MacroDrivers): string[] {
    const missing: string[] = [];

    if (macro.fedFundsRate.value === 0) missing.push('fedFundsRate');
    if (macro.treasury10Y.value === 0) missing.push('treasury10Y');
    if (macro.treasury2Y.value === 0) missing.push('treasury2Y');
    if (macro.cpi.value === 0) missing.push('cpi');
    if (macro.unemploymentRate.value === 0) missing.push('unemploymentRate');
    if (macro.nonFarmPayrolls.value === 0) missing.push('nonFarmPayrolls');
    if (macro.realGDP.value === 0) missing.push('realGDP');
    if (macro.gdpGrowthRate.value === 0) missing.push('gdpGrowthRate');

    return missing;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const fredHealth = await this.fredApiClient.healthCheck();
      const hasCacheManager = !!this.cacheManager;
      const cacheStats = (this.cacheManager as any)?.getCacheStats();

      return {
        status: fredHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        details: {
          fredApi: fredHealth,
          cacheEnabled: this.enableCaching,
          cacheManager: hasCacheManager,
          cacheStats,
          useMockData: this.useMockData,
          circuitBreakerStatus: this.circuitBreaker.getMetrics(),
        }
      };
    } catch (error: unknown) {
      return {
        status: 'unhealthy',
        details: {
          error: (error instanceof Error ? error.message : String(error)),
          useMockData: this.useMockData,
        }
      };
    }
  }
}

/**
 * Initialize Macro Economic Fetcher
 */
export function initializeMacroEconomicFetcher(options: MacroEconomicFetcherOptions): MacroEconomicFetcher {
  return new MacroEconomicFetcher(options);
}

export default MacroEconomicFetcher;