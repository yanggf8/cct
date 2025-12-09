/**
 * Money Flow Service
 * Provides money flow indicators with DAC pool integration and Yahoo Finance fallback
 */

import type { CloudflareEnvironment } from '../types';
import { createMoneyFlowAdapter, MoneyFlowIndicators } from './dac-money-flow-adapter';
import { getHistoricalData } from './yahoo-finance-integration';

/**
 * Get money flow indicators with DAC fallback strategy
 */
export async function getMoneyFlowIndicators(
  env: CloudflareEnvironment,
  symbol: string
): Promise<MoneyFlowIndicators> {
  // Strategy 1: Try DAC (extracts from stock sentiment)
  const dacAdapter = createMoneyFlowAdapter(env);
  
  if (dacAdapter) {
    try {
      const poolResult = await dacAdapter.getMoneyFlow(symbol);
      
      if (poolResult) {
        console.log(`[MONEY_FLOW] ✅ DAC HIT for ${symbol} (CMF: ${poolResult.cmf.toFixed(3)}, Trend: ${poolResult.trend})`);
        return poolResult;
      }
      
      console.log(`[MONEY_FLOW] ⚠️  DAC MISS for ${symbol}, falling back to Yahoo Finance`);
    } catch (error) {
      console.error(`[MONEY_FLOW] DAC error for ${symbol}:`, error);
    }
  }

  // Strategy 2: Fallback to Yahoo Finance calculation
  console.log(`[MONEY_FLOW] 📊 Calculating from Yahoo Finance for ${symbol}`);
  
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    const historicalData = await getHistoricalData(
      symbol,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    if (!historicalData || historicalData.length < 20) {
      return createNeutralIndicators(symbol);
    }

    const { cmf, obv } = calculateMoneyFlow(historicalData);
    
    return {
      symbol,
      cmf,
      obv,
      trend: cmf >= 0 ? 'ACCUMULATION' : 'DISTRIBUTION',
      timestamp: new Date().toISOString(),
      cached: false,
      cacheStatus: 'MISS',
      source: 'yahoo_finance'
    };
  } catch (error) {
    console.error(`[MONEY_FLOW] Yahoo Finance error for ${symbol}:`, error);
    return createNeutralIndicators(symbol);
  }
}

function calculateMoneyFlow(data: any[]): { cmf: number; obv: number } {
  const period = Math.min(20, data.length);
  const recentData = data.slice(-period);
  
  let moneyFlowVolumeSum = 0;
  let volumeSum = 0;
  let obv = 0;
  let prevClose = recentData[0]?.close || 0;

  for (const bar of recentData) {
    const highMinusLow = bar.high - bar.low;
    let mfm = 0;

    if (highMinusLow !== 0) {
      mfm = ((bar.close - bar.low) - (bar.high - bar.close)) / highMinusLow;
    }

    moneyFlowVolumeSum += mfm * bar.volume;
    volumeSum += bar.volume;

    if (bar.close > prevClose) obv += bar.volume;
    else if (bar.close < prevClose) obv -= bar.volume;
    prevClose = bar.close;
  }

  return { cmf: volumeSum > 0 ? moneyFlowVolumeSum / volumeSum : 0, obv };
}

function createNeutralIndicators(symbol: string): MoneyFlowIndicators {
  return {
    symbol,
    cmf: 0,
    obv: 0,
    trend: 'ACCUMULATION',
    timestamp: new Date().toISOString(),
    cached: false,
    cacheStatus: 'MISS',
    source: 'yahoo_finance'
  };
}
