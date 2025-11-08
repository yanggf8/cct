/**
 * Sector Indicators Module - TypeScript
 * Technical analysis indicators for sector rotation analysis
 * Calculates OBV, CMF, and relative strength indicators for institutional money flow tracking
 *
 * @author Sector Rotation Pipeline v1.3
 * @since 2025-10-10
 */

import { createLogger } from './logging.js';
import { DataValidator, OHLCVBar } from './data-validation.js';
import { KVKeyFactory, KeyTypes, KeyHelpers } from './kv-key-factory.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';

const logger = createLogger('sector-indicators');

// Technical indicator interfaces
export interface OBVData {
  symbol: string;
  obv: number;
  obvChange: number;
  obvTrend: 'up' | 'down' | 'neutral';
  volumeTrend: 'accumulating' | 'distributing' | 'neutral';
  timestamp: number;
}

export interface CMFData {
  symbol: string;
  cmf: number;
  cmfChange: number;
  moneyFlowSignal: 'bullish' | 'bearish' | 'neutral';
  moneyFlowVolume: number;
  timestamp: number;
}

export interface RelativeStrengthData {
  symbol: string;
  benchmark: string; // SPY or other benchmark
  relativeStrength: number;
  rsTrend: 'outperforming' | 'underperforming' | 'neutral';
  momentumScore: number;
  timestamp: number;
}

export interface SectorIndicators {
  symbol: string;
  timestamp: number;
  obv?: OBVData;
  cmf?: CMFData;
  relativeStrength?: RelativeStrengthData;
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

export interface IndicatorConfig {
  obv: {
    period: number;
    smoothingFactor: number;
  };
  cmf: {
    period: number;
  };
  relativeStrength: {
    benchmark: string;
    period: number;
  };
}

/**
 * Sector Indicators Calculator
 */
export class SectorIndicators {
  private dal: any;
  private validator: DataValidator;
  private config: IndicatorConfig;

  constructor(env: any, config?: Partial<IndicatorConfig>) {
    this.dal = createSimplifiedEnhancedDAL(env);
    this.validator = new DataValidator();

    this.config = {
      obv: {
        period: 20,
        smoothingFactor: 0.1
      },
      cmf: {
        period: 20
      },
      relativeStrength: {
        benchmark: 'SPY',
        period: 50
      },
      ...config
    };
  }

  /**
   * Calculate On-Balance Volume (OBV) indicator
   * OBV measures buying and selling pressure by adding volume on up days and subtracting on down days
   */
  async calculateOBV(symbol: string, historicalData: OHLCVBar[]): Promise<OBVData | null> {
    try {
      if (historicalData.length < 2) {
        logger.warn(`Insufficient data for OBV calculation on ${symbol}`);
        return null;
      }

      // Validate data
      const validation = this.validator.validateOHLCVArray(historicalData);
      if (!validation.isValid) {
        logger.error(`Invalid data for OBV calculation on ${symbol}:`, validation.errors);
        return null;
      }

      const validData = validation.data!;

      // Calculate OBV
      let obv = 0;
      const obvValues: number[] = [];

      for (let i = 1; i < validData.length; i++) {
        const current = validData[i];
        const previous = validData[i - 1];

        if (current.close > previous.close) {
          // Up day - add volume
          obv += current.volume;
        } else if (current.close < previous.close) {
          // Down day - subtract volume
          obv -= current.volume;
        }
        // Unchanged day - no change to OBV

        obvValues.push(obv);
      }

      // Calculate smoothed OBV (exponential moving average)
      const smoothedOBV = this.calculateEMA(obvValues, this.config.obv.smoothingFactor);
      const currentOBV = smoothedOBV[smoothedOBV.length - 1] || obvValues[obvValues.length - 1];

      // Calculate OBV change and trend
      const previousOBV = smoothedOBV[smoothedOBV.length - 2] || obvValues[obvValues.length - 2];
      const obvChange = currentOBV - previousOBV;
      const obvTrend = this.determineTrend(obvChange, 0.02); // 2% threshold

      // Determine volume trend (accumulation/distribution)
      const recentVolume = validData.slice(-5).map(d => d.volume);
      const avgRecentVolume = recentVolume.reduce((a: any, b: any) => a + b, 0) / recentVolume.length;
      const historicalVolume = validData.slice(-20).map(d => d.volume);
      const avgHistoricalVolume = historicalVolume.reduce((a: any, b: any) => a + b, 0) / historicalVolume.length;

      let volumeTrend: 'accumulating' | 'distributing' | 'neutral' = 'neutral';
      if (avgRecentVolume > avgHistoricalVolume * 1.2) {
        volumeTrend = 'accumulating';
      } else if (avgRecentVolume < avgHistoricalVolume * 0.8) {
        volumeTrend = 'distributing';
      }

      return {
        symbol,
        obv: Math.round(currentOBV),
        obvChange: Math.round(obvChange),
        obvTrend,
        volumeTrend,
        timestamp: Date.now()
      };

    } catch (error: unknown) {
      logger.error(`Error calculating OBV for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Calculate Chaikin Money Flow (CMF) indicator
   * CMF measures money flow volume over a period, indicating buying/selling pressure
   */
  async calculateCMF(symbol: string, historicalData: OHLCVBar[]): Promise<CMFData | null> {
    try {
      const period = this.config.cmf.period;
      if (historicalData.length < period + 1) {
        logger.warn(`Insufficient data for CMF calculation on ${symbol}. Need ${period + 1}, got ${historicalData.length}`);
        return null;
      }

      // Validate data
      const validation = this.validator.validateOHLCVArray(historicalData);
      if (!validation.isValid) {
        logger.error(`Invalid data for CMF calculation on ${symbol}:`, validation.errors);
        return null;
      }

      const validData = validation.data!;
      const recentData = validData.slice(-period);

      // Calculate Money Flow Volume and Money Flow for each period
      let moneyFlowVolumeSum = 0;
      let volumeSum = 0;

      for (const bar of recentData) {
        // Calculate Money Flow Multiplier
        const highMinusLow = bar.high - bar.low;
        let moneyFlowMultiplier = 0;

        if (highMinusLow !== 0) {
          moneyFlowMultiplier = ((bar.close - bar.low) - (bar.high - bar.close)) / highMinusLow;
        }

        // Calculate Money Flow Volume
        const moneyFlowVolume = moneyFlowMultiplier * bar.volume;

        moneyFlowVolumeSum += moneyFlowVolume;
        volumeSum += bar.volume;
      }

      // Calculate CMF
      const cmf = volumeSum > 0 ? moneyFlowVolumeSum / volumeSum : 0;

      // Calculate CMF change (compare with previous period if available)
      let cmfChange = 0;
      if (historicalData.length > period + 1) {
        const previousPeriod = validData.slice(-period - 1, -1);
        let prevMoneyFlowVolumeSum = 0;
        let prevVolumeSum = 0;

        for (const bar of previousPeriod) {
          const highMinusLow = bar.high - bar.low;
          let moneyFlowMultiplier = 0;

          if (highMinusLow !== 0) {
            moneyFlowMultiplier = ((bar.close - bar.low) - (bar.high - bar.close)) / highMinusLow;
          }

          prevMoneyFlowVolumeSum += moneyFlowMultiplier * bar.volume;
          prevVolumeSum += bar.volume;
        }

        const previousCMF = prevVolumeSum > 0 ? prevMoneyFlowVolumeSum / prevVolumeSum : 0;
        cmfChange = cmf - previousCMF;
      }

      // Determine money flow signal
      let moneyFlowSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (cmf > 0.1) {
        moneyFlowSignal = 'bullish';
      } else if (cmf < -0.1) {
        moneyFlowSignal = 'bearish';
      } else if (cmf > 0.05) {
        moneyFlowSignal = 'bullish';
      } else if (cmf < -0.05) {
        moneyFlowSignal = 'bearish';
      }

      return {
        symbol,
        cmf: Math.round(cmf * 1000) / 1000, // Round to 3 decimal places
        cmfChange: Math.round(cmfChange * 1000) / 1000,
        moneyFlowSignal,
        moneyFlowVolume: Math.round(moneyFlowVolumeSum),
        timestamp: Date.now()
      };

    } catch (error: unknown) {
      logger.error(`Error calculating CMF for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Calculate Relative Strength indicator
   * Measures how a sector performs relative to a benchmark (SPY)
   */
  async calculateRelativeStrength(
    symbol: string,
    sectorData: OHLCVBar[],
    benchmarkData: OHLCVBar[]
  ): Promise<RelativeStrengthData | null> {
    try {
      const period = this.config.relativeStrength.period;

      if (sectorData.length < period || benchmarkData.length < period) {
        logger.warn(`Insufficient data for Relative Strength calculation on ${symbol}`);
        return null;
      }

      // Validate data
      const sectorValidation = this.validator.validateOHLCVArray(sectorData);
      const benchmarkValidation = this.validator.validateOHLCVArray(benchmarkData);

      if (!sectorValidation.isValid || !benchmarkValidation.isValid) {
        logger.error(`Invalid data for Relative Strength calculation on ${symbol}`);
        return null;
      }

      const validSectorData = sectorValidation.data!;
      const validBenchmarkData = benchmarkValidation.data!;

      const recentSectorData = validSectorData.slice(-period);
      const recentBenchmarkData = validBenchmarkData.slice(-period);

      // Calculate returns for both sector and benchmark
      const sectorReturns = this.calculateReturns(recentSectorData);
      const benchmarkReturns = this.calculateReturns(recentBenchmarkData);

      // Calculate relative strength (sector return - benchmark return)
      const relativeStrength = sectorReturns - benchmarkReturns;

      // Calculate momentum score (based on trend of relative strength)
      const momentumScore = this.calculateMomentumScore(recentSectorData, recentBenchmarkData);

      // Determine trend
      let rsTrend: 'outperforming' | 'underperforming' | 'neutral' = 'neutral';
      if (relativeStrength > 0.02) { // 2% outperformance threshold
        rsTrend = 'outperforming';
      } else if (relativeStrength < -0.02) { // 2% underperformance threshold
        rsTrend = 'underperforming';
      }

      return {
        symbol,
        benchmark: this.config.relativeStrength.benchmark,
        relativeStrength: Math.round(relativeStrength * 10000) / 10000, // 4 decimal places
        rsTrend,
        momentumScore: Math.round(momentumScore * 100) / 100,
        timestamp: Date.now()
      };

    } catch (error: unknown) {
      logger.error(`Error calculating Relative Strength for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Calculate all indicators for a sector
   */
  async calculateAllIndicators(
    symbol: string,
    sectorData: OHLCVBar[],
    benchmarkData?: OHLCVBar[]
  ): Promise<SectorIndicators | null> {
    try {
      const indicators: SectorIndicators = {
        symbol,
        timestamp: Date.now(),
        overallSignal: 'neutral',
        confidence: 0
      } as SectorIndicators;

      // Calculate OBV
      const obvData = await this.calculateOBV(symbol, sectorData);
      if (obvData) {
        indicators.obv = obvData;
      }

      // Calculate CMF
      const cmfData = await this.calculateCMF(symbol, sectorData);
      if (cmfData) {
        indicators.cmf = cmfData;
      }

      // Calculate Relative Strength (if benchmark data provided)
      if (benchmarkData) {
        const rsData = await this.calculateRelativeStrength(symbol, sectorData, benchmarkData);
        if (rsData) {
          indicators.relativeStrength = rsData;
        }
      }

      // Determine overall signal and confidence
      const signalAnalysis = this.analyzeOverallSignal(indicators);
      indicators.overallSignal = signalAnalysis.signal;
      indicators.confidence = signalAnalysis.confidence;

      return indicators;

    } catch (error: unknown) {
      logger.error(`Error calculating all indicators for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Store indicators in KV cache
   */
  async storeIndicators(indicators: SectorIndicators): Promise<void> {
    try {
      const cacheKey = KeyHelpers.getSectorIndicatorsKey(indicators.symbol);
      const kvOptions = KeyHelpers.getKVOptions(KeyTypes.SECTOR_INDICATORS, {
        metadata: {
          type: 'sector_indicators',
          symbol: indicators.symbol,
          timestamp: indicators.timestamp,
          signal: indicators.overallSignal,
          confidence: indicators.confidence,
          version: '1.0'
        }
      });

      await this.dal.write(cacheKey, indicators);
      logger.debug(`Stored indicators for ${indicators.symbol}`);

    } catch (error: unknown) {
      logger.error(`Error storing indicators for ${indicators.symbol}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Retrieve indicators from KV cache
   */
  async getIndicators(symbol: string): Promise<SectorIndicators | null> {
    try {
      const cacheKey = KeyHelpers.getSectorIndicatorsKey(symbol);
      const result = await this.dal.read(cacheKey);

      if (result.data) {
        return result.data as SectorIndicators;
      }
      return null;

    } catch (error: unknown) {
      logger.error(`Error retrieving indicators for ${symbol}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(values: number[], smoothingFactor: number): number[] {
    if (values.length === 0) return [];

    const ema: number[] = [values[0]];

    for (let i = 1; i < values.length; i++) {
      ema[i] = (values[i] * smoothingFactor) + (ema[i - 1] * (1 - smoothingFactor));
    }

    return ema;
  }

  /**
   * Determine trend based on change and threshold
   */
  private determineTrend(change: number, threshold: number): 'up' | 'down' | 'neutral' {
    if (change > threshold) return 'up';
    if (change < -threshold) return 'down';
    return 'neutral';
  }

  /**
   * Calculate total return over period
   */
  private calculateReturns(data: OHLCVBar[]): number {
    if (data.length < 2) return 0;

    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;

    return (endPrice - startPrice) / startPrice;
  }

  /**
   * Calculate momentum score based on price action consistency
   */
  private calculateMomentumScore(sectorData: OHLCVBar[], benchmarkData: OHLCVBar[]): number {
    let score = 0;
    const period = Math.min(sectorData.length, benchmarkData.length, 20);

    for (let i = 1; i < period; i++) {
      const sectorReturn = (sectorData[i].close - sectorData[i-1].close) / sectorData[i-1].close;
      const benchmarkReturn = (benchmarkData[i].close - benchmarkData[i-1].close) / benchmarkData[i-1].close;

      if (sectorReturn > benchmarkReturn) {
        score += 1;
      } else if (sectorReturn < benchmarkReturn) {
        score -= 1;
      }
    }

    return score / period; // Normalize to -1 to 1 range
  }

  /**
   * Analyze overall signal from individual indicators
   */
  private analyzeOverallSignal(indicators: SectorIndicators): {
    signal: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
  } {
    let bullishSignals = 0;
    let bearishSignals = 0;
    let totalSignals = 0;

    // Analyze OBV
    if (indicators.obv) {
      totalSignals++;
      if (indicators.obv.obvTrend === 'up' && indicators.obv.volumeTrend === 'accumulating') {
        bullishSignals++;
      } else if (indicators.obv.obvTrend === 'down' && indicators.obv.volumeTrend === 'distributing') {
        bearishSignals++;
      }
    }

    // Analyze CMF
    if (indicators.cmf) {
      totalSignals++;
      if (indicators.cmf.moneyFlowSignal === 'bullish') {
        bullishSignals++;
      } else if (indicators.cmf.moneyFlowSignal === 'bearish') {
        bearishSignals++;
      }
    }

    // Analyze Relative Strength
    if (indicators.relativeStrength) {
      totalSignals++;
      if (indicators.relativeStrength.rsTrend === 'outperforming') {
        bullishSignals++;
      } else if (indicators.relativeStrength.rsTrend === 'underperforming') {
        bearishSignals++;
      }
    }

    // Determine overall signal and confidence
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0;

    if (totalSignals > 0) {
      const bullishRatio = bullishSignals / totalSignals;
      const bearishRatio = bearishSignals / totalSignals;

      if (bullishRatio > 0.6) {
        signal = 'bullish';
        confidence = bullishRatio;
      } else if (bearishRatio > 0.6) {
        signal = 'bearish';
        confidence = bearishRatio;
      } else {
        signal = 'neutral';
        confidence = Math.max(bullishRatio, bearishRatio);
      }
    }

    return { signal, confidence };
  }

  /**
   * Get configuration
   */
  getConfig(): IndicatorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IndicatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Sector indicators configuration updated');
  }
}

/**
 * Default sector indicators instance
 */
export const defaultSectorIndicators = (env: any): SectorIndicators => {
  return new SectorIndicators(env);
};

/**
 * Convenience functions for common indicator operations
 */
export async function calculateSectorOBV(symbol: string, data: OHLCVBar[]): Promise<OBVData | null> {
  // This would need env parameter in actual implementation
  throw new Error('Direct function calls not supported - use SectorIndicators class instance');
}

export async function calculateSectorCMF(symbol: string, data: OHLCVBar[]): Promise<CMFData | null> {
  // This would need env parameter in actual implementation
  throw new Error('Direct function calls not supported - use SectorIndicators class instance');
}

export async function calculateSectorRelativeStrength(
  symbol: string,
  sectorData: OHLCVBar[],
  benchmarkData: OHLCVBar[]
): Promise<RelativeStrengthData | null> {
  // This would need env parameter in actual implementation
  throw new Error('Direct function calls not supported - use SectorIndicators class instance');
}