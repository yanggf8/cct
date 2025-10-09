/**
 * FRED API Client
 *
 * Federal Reserve Economic Data API client for comprehensive macroeconomic data.
 * Provides access to U.S. economic indicators including interest rates,
 * inflation, employment, GDP, and other key metrics.
 *
 * Features:
 * - Rate limiting and retry logic
 * - Caching integration
 * - Data validation and error handling
 * - Bulk data fetching with optimization
 * - Real-time and historical data support
 *
 * @author Market Drivers Pipeline - Phase 2 Day 2
 * @since 2025-10-10
 */

import { createLogger } from './logging.js';
import { CircuitBreakerFactory } from './circuit-breaker.js';
import { KeyHelpers } from './kv-key-factory.js';
import { createDAL } from './dal.js';
import { FRED_SERIES, FredSeries } from './market-drivers.js';

const logger = createLogger('fred-api-client');

/**
 * FRED API Configuration
 */
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

/**
 * FRED API Response Types
 */
interface FredObservation {
  date: string;
  value: string | null;
  realtime_start: string;
  realtime_end: string;
}

interface FredSeriesResponse {
  realtime_start: string;
  realtime_end: string;
  observation_start: string;
  observation_end: string;
  units: string;
  unit_mult: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  frequency: string;
  frequency_short: string;
  last_updated: string;
  observation_end: string;
  sort_order: string;
  count: number;
  observations: FredObservation[];
}

interface FredSeriesInfo {
  id: string;
  title: string;
  units: string;
  unit_mult: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  frequency: string;
  frequency_short: string;
  last_updated: string;
  observation_start: string;
  observation_end: string;
  popularity: number;
  notes: string;
}

interface FredInfoResponse {
  realtime_start: string;
  realtime_end: string;
  series_info: FredSeriesInfo;
}

interface FredError {
  error_code: number;
  error_message: string;
}

/**
 * FRED API Client Options
 */
export interface FredApiClientOptions {
  apiKey: string;
  baseUrl?: string;
  rateLimitDelay?: number;
  maxRetries?: number;
  cacheEnabled?: boolean;
  defaultStartDate?: string;
}

/**
 * Processed Economic Data
 */
export interface EconomicData {
  series: FredSeries;
  value: number;
  date: string;
  change: number; // Change from previous period
  changePercent: number; // Percentage change from previous period
  trend: 'up' | 'down' | 'stable';
  source: string;
  lastUpdated: string;
}

/**
 * Macro Economic Snapshot
 */
export interface MacroEconomicSnapshot {
  timestamp: number;
  date: string;

  // Interest Rates
  fedFundsRate: EconomicData;
  treasury10Y: EconomicData;
  treasury2Y: EconomicData;
  yieldCurveSpread: EconomicData;

  // Inflation
  cpi: EconomicData;
  cpiChangePercent: EconomicData;
  coreCpi: EconomicData;
  ppi: EconomicData;
  inflationRate: EconomicData;

  // Employment
  unemploymentRate: EconomicData;
  nonFarmPayrolls: EconomicData;
  laborForceParticipation: EconomicData;

  // Growth
  realGDP: EconomicData;
  gdpGrowthRate: EconomicData;
  industrialProduction: EconomicData;

  // Consumer
  consumerConfidence: EconomicData;
  retailSales: EconomicData;

  // Housing
  buildingPermits: EconomicData;
  housingStarts: EconomicData;

  // Money Supply
  m2MoneySupply: EconomicData;

  // Leading Indicators
  leadingIndex: EconomicData;

  metadata: {
    source: 'FRED';
    lastUpdated: string;
    dataFreshness: number; // Hours since last update
    seriesCount: number;
    cacheHit: boolean;
  };
}

/**
 * FRED API Client Implementation
 */
export class FredApiClient {
  private apiKey: string;
  private baseUrl: string;
  private dal;
  private circuitBreaker;
  private rateLimitDelay: number;
  private maxRetries: number;
  private cacheEnabled: boolean;
  private defaultStartDate: string;

  constructor(options: FredApiClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || FRED_BASE_URL;
    this.rateLimitDelay = options.rateLimitDelay || 1000; // 1 second between requests
    this.maxRetries = options.maxRetries || 3;
    this.cacheEnabled = options.cacheEnabled !== false;
    this.defaultStartDate = options.defaultStartDate || this.getDefaultStartDate();

    // Initialize DAL and circuit breaker
    this.dal = createDAL({ TRADING_RESULTS: null } as any); // DAL for caching
    this.circuitBreaker = CircuitBreakerFactory.getInstance('fred-api');
  }

  /**
   * Get current macro economic snapshot
   */
  async getMacroEconomicSnapshot(): Promise<MacroEconomicSnapshot> {
    const timestamp = Date.now();
    const today = new Date().toISOString().split('T')[0];

    try {
      logger.info('Fetching macro economic snapshot from FRED API');

      // Check cache first
      const cacheKey = KeyHelpers.getMarketDriversFredDataKey('snapshot', today);
      if (this.cacheEnabled) {
        const cached = await this.getCachedSnapshot(cacheKey);
        if (cached) {
          logger.info('Macro economic snapshot retrieved from cache');
          return { ...cached, metadata: { ...cached.metadata, cacheHit: true } };
        }
      }

      // Fetch all required series data
      const seriesData = await this.fetchAllRequiredSeries();

      // Process and calculate derived metrics
      const snapshot = this.processSeriesDataToSnapshot(seriesData);

      // Store in cache
      if (this.cacheEnabled) {
        await this.cacheSnapshot(cacheKey, snapshot);
      }

      logger.info('Macro economic snapshot generated successfully', {
        date: snapshot.date,
        seriesCount: Object.keys(seriesData).length
      });

      return snapshot;
    } catch (error) {
      logger.error('Failed to generate macro economic snapshot:', error);
      throw new Error(`FRED API Error: ${error.message}`);
    }
  }

  /**
   * Get specific economic series data
   */
  async getSeriesData(
    series: FredSeries,
    startDate?: string,
    endDate?: string,
    limit?: number
  ): Promise<FredSeriesResponse> {
    const start = startDate || this.defaultStartDate;
    const end = endDate || new Date().toISOString().split('T')[0];

    return await this.circuitBreaker.execute(async () => {
      const url = new URL(`${this.baseUrl}/series/observations`);
      url.searchParams.set('series_id', series);
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('file_type', 'json');
      url.searchParams.set('observation_start', start);
      url.searchParams.set('observation_end', end);
      url.searchParams.set('sort_order', 'desc'); // Most recent first

      if (limit) {
        url.searchParams.set('limit', limit.toString());
      }

      const response = await this.makeRequest(url.toString());

      if (!response.ok) {
        throw new Error(`FRED API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error_code) {
        throw new Error(`FRED API Error ${data.error_code}: ${data.error_message}`);
      }

      return data;
    });
  }

  /**
   * Get series information
   */
  async getSeriesInfo(series: FredSeries): Promise<FredSeriesInfo> {
    return await this.circuitBreaker.execute(async () => {
      const url = new URL(`${this.baseUrl}/series`);
      url.searchParams.set('series_id', series);
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('file_type', 'json');

      const response = await this.makeRequest(url.toString());

      if (!response.ok) {
        throw new Error(`FRED API request failed: ${response.status} ${response.statusText}`);
      }

      const data: FredInfoResponse = await response.json();

      if (data.error_code) {
        throw new Error(`FRED API Error ${data.error_code}: ${data.error_message}`);
      }

      return data.series_info;
    });
  }

  /**
   * Fetch all required series for macro snapshot
   */
  private async fetchAllRequiredSeries(): Promise<Map<FredSeries, FredSeriesResponse>> {
    const seriesMap = new Map<FredSeries, FredSeriesResponse>();

    // Required series for macro snapshot
    const requiredSeries: FredSeries[] = [
      // Interest Rates
      FRED_SERIES.FED_FUNDS_RATE,
      FRED_SERIES.TREASURY_10Y,
      FRED_SERIES.TREASURY_2Y,

      // Inflation
      FRED_SERIES.CPI,
      FRED_SERIES.CORE_CPI,
      FRED_SERIES.PPI,

      // Employment
      FRED_SERIES.UNEMPLOYMENT_RATE,
      FRED_SERIES.NON_FARM_PAYROLLS,
      FRED_SERIES.LABOR_FORCE_PARTICIPATION,

      // Growth
      FRED_SERIES.REAL_GDP,
      FRED_SERIES.GDP_GROWTH,
      FRED_SERIES.INDUSTRIAL_PRODUCTION,

      // Consumer
      FRED_SERIES.CONSUMER_CONFIDENCE,
      FRED_SERIES.RETAIL_SALES,

      // Housing
      FRED_SERIES.BUILDING_PERMITS,
      FRED_SERIES.HOUSING_STARTS,

      // Money Supply
      FRED_SERIES.M2_MONEY_SUPPLY,

      // Leading Indicators
      FRED_SERIES.LEADING_INDEX,
    ];

    // Fetch series with rate limiting
    for (let i = 0; i < requiredSeries.length; i++) {
      const series = requiredSeries[i];

      try {
        // Get latest 2 observations for trend calculation
        const data = await this.getSeriesData(series, undefined, undefined, 2);
        seriesMap.set(series, data);

        // Rate limiting between requests
        if (i < requiredSeries.length - 1) {
          await this.delay(this.rateLimitDelay);
        }
      } catch (error) {
        logger.warn(`Failed to fetch series ${series}:`, error);
        // Continue with other series even if one fails
      }
    }

    return seriesMap;
  }

  /**
   * Process series data into macro snapshot
   */
  private processSeriesDataToSnapshot(seriesMap: Map<FredSeries, FredSeriesResponse>): MacroEconomicSnapshot {
    const timestamp = Date.now();
    const date = new Date().toISOString().split('T')[0];

    // Helper function to extract economic data from series
    const extractData = (series: FredSeries, defaultValue: number = 0): EconomicData => {
      const data = seriesMap.get(series);
      if (!data || data.observations.length === 0) {
        return this.createEmptyEconomicData(series, defaultValue);
      }

      const current = data.observations[0];
      const previous = data.observations[1];

      const currentValue = current.value ? parseFloat(current.value) : defaultValue;
      const previousValue = previous?.value ? parseFloat(previous.value) : defaultValue;

      const change = currentValue - previousValue;
      const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

      return {
        series,
        value: currentValue,
        date: current.date,
        change,
        changePercent,
        trend: this.calculateTrend(changePercent),
        source: 'FRED',
        lastUpdated: data.last_updated || new Date().toISOString(),
      };
    };

    // Extract all economic indicators
    const fedFundsRate = extractData(FRED_SERIES.FED_FUNDS_RATE, 5.25);
    const treasury10Y = extractData(FRED_SERIES.TREASURY_10Y, 4.0);
    const treasury2Y = extractData(FRED_SERIES.TREASURY_2Y, 4.5);
    const yieldCurveSpread: EconomicData = {
      series: 'YIELD_CURVE_SPREAD' as FredSeries,
      value: treasury10Y.value - treasury2Y.value,
      date: treasury10Y.date,
      change: (treasury10Y.change - treasury2Y.change),
      changePercent: treasury10Y.changePercent - treasury2Y.changePercent,
      trend: this.calculateTrend((treasury10Y.changePercent - treasury2Y.changePercent)),
      source: 'FRED',
      lastUpdated: new Date().toISOString(),
    };

    const cpi = extractData(FRED_SERIES.CPI, 300);
    const coreCpi = extractData(FRED_SERIES.CORE_CPI, 300);
    const ppi = extractData(FRED_SERIES.PPI, 300);
    const cpiChangePercent: EconomicData = {
      series: 'CPI_CHANGE_PERCENT' as FredSeries,
      value: cpi.changePercent,
      date: cpi.date,
      change: cpi.changePercent,
      changePercent: 0, // No percent change for percent values
      trend: this.calculateTrend(cpi.changePercent),
      source: 'FRED',
      lastUpdated: cpi.lastUpdated,
    };
    const inflationRate = cpiChangePercent;

    const unemploymentRate = extractData(FRED_SERIES.UNEMPLOYMENT_RATE, 4.0);
    const nonFarmPayrolls = extractData(FRED_SERIES.NON_FARM_PAYROLLS, 200000);
    const laborForceParticipation = extractData(FRED_SERIES.LABOR_FORCE_PARTICIPATION, 62.5);

    const realGDP = extractData(FRED_SERIES.REAL_GDP, 21.0);
    const gdpGrowthRate = extractData(FRED_SERIES.GDP_GROWTH, 2.0);
    const industrialProduction = extractData(FRED_SERIES.INDUSTRIAL_PRODUCTION, 100);

    const consumerConfidence = extractData(FRED_SERIES.CONSUMER_CONFIDENCE, 70);
    const retailSales = extractData(FRED_SERIES.RETAIL_SALES, 500);

    const buildingPermits = extractData(FRED_SERIES.BUILDING_PERMITS, 1400);
    const housingStarts = extractData(FRED_SERIES.HOUSING_STARTS, 1400);

    const m2MoneySupply = extractData(FRED_SERIES.M2_MONEY_SUPPLY, 20000);
    const leadingIndex = extractData(FRED_SERIES.LEADING_INDEX, 100);

    // Calculate data freshness
    const latestUpdate = Math.max(
      fedFundsRate.lastUpdated ? new Date(fedFundsRate.lastUpdated).getTime() : 0,
      cpi.lastUpdated ? new Date(cpi.lastUpdated).getTime() : 0,
      unemploymentRate.lastUpdated ? new Date(unemploymentRate.lastUpdated).getTime() : 0,
      realGDP.lastUpdated ? new Date(realGDP.lastUpdated).getTime() : 0
    );

    const dataFreshness = latestUpdate > 0
      ? (timestamp - latestUpdate) / (1000 * 60 * 60) // Hours since last update
      : 999; // Very old if never updated

    return {
      timestamp,
      date,

      // Interest Rates
      fedFundsRate,
      treasury10Y,
      treasury2Y,
      yieldCurveSpread,

      // Inflation
      cpi,
      cpiChangePercent,
      coreCpi,
      ppi,
      inflationRate,

      // Employment
      unemploymentRate,
      nonFarmPayrolls,
      laborForceParticipation,

      // Growth
      realGDP,
      gdpGrowthRate,
      industrialProduction,

      // Consumer
      consumerConfidence,
      retailSales,

      // Housing
      buildingPermits,
      housingStarts,

      // Money Supply
      m2MoneySupply,

      // Leading Indicators
      leadingIndex,

      metadata: {
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
        dataFreshness,
        seriesCount: seriesMap.size,
        cacheHit: false,
      },
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest(url: string, retries = 0): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CCT-Trading-System/1.0',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.rateLimitDelay * 2;

        if (retries < this.maxRetries) {
          logger.warn(`Rate limited, retrying in ${delay}ms`, { url, retries });
          await this.delay(delay);
          return this.makeRequest(url, retries + 1);
        }

        throw new Error('Rate limit exceeded after maximum retries');
      }

      return response;
    } catch (error) {
      if (retries < this.maxRetries) {
        logger.warn(`Request failed, retrying (${retries + 1}/${this.maxRetries})`, { url, error });
        await this.delay(this.rateLimitDelay * (retries + 1));
        return this.makeRequest(url, retries + 1);
      }

      throw error;
    }
  }

  /**
   * Cache operations
   */
  private async getCachedSnapshot(cacheKey: string): Promise<MacroEconomicSnapshot | null> {
    try {
      const result = await this.dal.read<MacroEconomicSnapshot>(cacheKey);
      return result.success ? result.data : null;
    } catch (error) {
      logger.error('Cache read error:', error);
      return null;
    }
  }

  private async cacheSnapshot(cacheKey: string, snapshot: MacroEconomicSnapshot): Promise<void> {
    try {
      const result = await this.dal.write(cacheKey, snapshot, {
        expirationTtl: 3600, // 1 hour cache
      });

      if (!result.success) {
        throw new Error(`Failed to cache snapshot: ${result.error}`);
      }
    } catch (error) {
      logger.error('Cache write error:', error);
      // Continue even if caching fails
    }
  }

  /**
   * Helper functions
   */
  private calculateTrend(changePercent: number): 'up' | 'down' | 'stable' {
    const threshold = 0.1; // 0.1% threshold
    if (changePercent > threshold) return 'up';
    if (changePercent < -threshold) return 'down';
    return 'stable';
  }

  private createEmptyEconomicData(series: FredSeries, defaultValue: number): EconomicData {
    return {
      series,
      value: defaultValue,
      date: new Date().toISOString().split('T')[0],
      change: 0,
      changePercent: 0,
      trend: 'stable',
      source: 'FRED',
      lastUpdated: new Date().toISOString(),
    };
  }

  private getDefaultStartDate(): string {
    // Default to 2 years ago for historical context
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date.toISOString().split('T')[0];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check for FRED API
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      // Test with a simple series
      const data = await this.getSeriesData(FRED_SERIES.FED_FUNDS_RATE, undefined, undefined, 1);

      return {
        status: 'healthy',
        details: {
          apiKeyConfigured: !!this.apiKey,
          baseUrl: this.baseUrl,
          lastTest: new Date().toISOString(),
          sampleDataAvailable: data.observations.length > 0,
          latestObservation: data.observations[0]?.date || null,
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          apiKeyConfigured: !!this.apiKey,
          lastTest: new Date().toISOString(),
        }
      };
    }
  }
}

/**
 * Initialize FRED API Client
 */
export function initializeFredApiClient(options: FredApiClientOptions): FredApiClient {
  if (!options.apiKey) {
    throw new Error('FRED API key is required');
  }

  return new FredApiClient(options);
}

/**
 * Mock FRED API Client for development/testing
 */
export class MockFredApiClient extends FredApiClient {
  constructor() {
    super({ apiKey: 'mock-key' });
  }

  async getMacroEconomicSnapshot(): Promise<MacroEconomicSnapshot> {
    return {
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],

      // Interest Rates
      fedFundsRate: {
        series: FRED_SERIES.FED_FUNDS_RATE,
        value: 5.25,
        date: new Date().toISOString().split('T')[0],
        change: 0.25,
        changePercent: 5.0,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      treasury10Y: {
        series: FRED_SERIES.TREASURY_10Y,
        value: 4.2,
        date: new Date().toISOString().split('T')[0],
        change: -0.05,
        changePercent: -1.2,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      treasury2Y: {
        series: FRED_SERIES.TREASURY_2Y,
        value: 4.8,
        date: new Date().toISOString().split('T')[0],
        change: 0.1,
        changePercent: 2.1,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      yieldCurveSpread: {
        series: 'YIELD_CURVE_SPREAD' as FredSeries,
        value: -0.6,
        date: new Date().toISOString().split('T')[0],
        change: -0.15,
        changePercent: -33.3,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Inflation
      cpi: {
        series: FRED_SERIES.CPI,
        value: 301.8,
        date: new Date().toISOString().split('T')[0],
        change: 0.4,
        changePercent: 0.13,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      cpiChangePercent: {
        series: 'CPI_CHANGE_PERCENT' as FredSeries,
        value: 3.2,
        date: new Date().toISOString().split('T')[0],
        change: 0.1,
        changePercent: 0,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      coreCpi: {
        series: FRED_SERIES.CORE_CPI,
        value: 298.5,
        date: new Date().toISOString().split('T')[0],
        change: 0.3,
        changePercent: 0.10,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      ppi: {
        series: FRED_SERIES.PPI,
        value: 298.5,
        date: new Date().toISOString().split('T')[0],
        change: -0.2,
        changePercent: -0.07,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      inflationRate: {
        series: 'INFLATION_RATE' as FredSeries,
        value: 3.2,
        date: new Date().toISOString().split('T')[0],
        change: 0.1,
        changePercent: 0,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Employment
      unemploymentRate: {
        series: FRED_SERIES.UNEMPLOYMENT_RATE,
        value: 3.8,
        date: new Date().toISOString().split('T')[0],
        change: -0.1,
        changePercent: -2.6,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      nonFarmPayrolls: {
        series: FRED_SERIES.NON_FARM_PAYROLLS,
        value: 187000,
        date: new Date().toISOString().split('T')[0],
        change: 12000,
        changePercent: 6.9,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      laborForceParticipation: {
        series: FRED_SERIES.LABOR_FORCE_PARTICIPATION,
        value: 62.8,
        date: new Date().toISOString().split('T')[0],
        change: -0.1,
        changePercent: -0.16,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Growth
      realGDP: {
        series: FRED_SERIES.REAL_GDP,
        value: 21.5,
        date: new Date().toISOString().split('T')[0],
        change: 0.3,
        changePercent: 1.4,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      gdpGrowthRate: {
        series: FRED_SERIES.GDP_GROWTH,
        value: 2.1,
        date: new Date().toISOString().split('T')[0],
        change: 0.2,
        changePercent: 10.5,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      industrialProduction: {
        series: FRED_SERIES.INDUSTRIAL_PRODUCTION,
        value: 103.5,
        date: new Date().toISOString().split('T')[0],
        change: 0.8,
        changePercent: 0.78,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Consumer
      consumerConfidence: {
        series: FRED_SERIES.CONSUMER_CONFIDENCE,
        value: 69.5,
        date: new Date().toISOString().split('T')[0],
        change: -2.1,
        changePercent: -2.9,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      retailSales: {
        series: FRED_SERIES.RETAIL_SALES,
        value: 689.2,
        date: new Date().toISOString().split('T')[0],
        change: 12.3,
        changePercent: 1.8,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Housing
      buildingPermits: {
        series: FRED_SERIES.BUILDING_PERMITS,
        value: 1420,
        date: new Date().toISOString().split('T')[0],
        change: -45,
        changePercent: -3.1,
        trend: 'down',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },
      housingStarts: {
        series: FRED_SERIES.HOUSING_STARTS,
        value: 1360,
        date: new Date().toISOString().split('T')[0],
        change: 25,
        changePercent: 1.9,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Money Supply
      m2MoneySupply: {
        series: FRED_SERIES.M2_MONEY_SUPPLY,
        value: 20756,
        date: new Date().toISOString().split('T')[0],
        change: 125,
        changePercent: 0.6,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      // Leading Indicators
      leadingIndex: {
        series: FRED_SERIES.LEADING_INDEX,
        value: 104.2,
        date: new Date().toISOString().split('T')[0],
        change: 0.8,
        changePercent: 0.77,
        trend: 'up',
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
      },

      metadata: {
        source: 'FRED',
        lastUpdated: new Date().toISOString(),
        dataFreshness: 0.5, // 30 minutes old
        seriesCount: 18,
        cacheHit: false,
      },
    };
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    return {
      status: 'healthy',
      details: {
        mock: true,
        apiKeyConfigured: true,
        lastTest: new Date().toISOString(),
      }
    };
  }
}

export default FredApiClient;