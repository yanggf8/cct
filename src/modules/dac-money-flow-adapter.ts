/**
 * DAC Money Flow Pool Adapter
 * Extracts money flow indicators from DAC stock sentiment endpoint
 */

import type { CloudflareEnvironment } from '../types';

export interface MoneyFlowIndicators {
  symbol: string;
  cmf: number;
  obv: number;
  trend: 'ACCUMULATION' | 'DISTRIBUTION';
  timestamp: string;
  cached: boolean;
  cacheStatus: 'HIT' | 'MISS';
  cachedAt?: string;
  source?: 'dac_pool' | 'yahoo_finance';
}

export class DACMoneyFlowAdapter {
  constructor(private dacBackend: Fetcher) {}

  async getMoneyFlow(symbol: string): Promise<MoneyFlowIndicators | null> {
    try {
      // Use public stock sentiment endpoint which includes money flow
      const request = new Request(
        `https://dac-backend/api/sentiment/stock/${symbol}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const response = await this.dacBackend.fetch(request);

      if (!response.ok) {
        console.warn(`[DAC_MONEY_FLOW] Sentiment fetch failed for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      
      // Extract money flow from sentiment response
      const stock = data.stocks?.[0] || data;
      const mf = stock.moneyFlow;

      if (!mf) {
        console.warn(`[DAC_MONEY_FLOW] No money flow in sentiment for ${symbol}`);
        return null;
      }

      return {
        symbol,
        cmf: mf.cmf ?? 0,
        obv: mf.obv ?? 0,
        trend: mf.trend ?? (mf.cmf >= 0 ? 'ACCUMULATION' : 'DISTRIBUTION'),
        timestamp: stock.cachedAt ?? new Date().toISOString(),
        cached: true,
        cacheStatus: 'HIT',
        cachedAt: stock.cachedAt,
        source: 'dac_pool'
      };

    } catch (error) {
      console.error(`[DAC_MONEY_FLOW] Error for ${symbol}:`, error);
      return null;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const request = new Request('https://dac-backend/health', { method: 'GET' });
      const response = await this.dacBackend.fetch(request);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export function createMoneyFlowAdapter(env: CloudflareEnvironment): DACMoneyFlowAdapter | null {
  if (!env.DAC_BACKEND) {
    console.warn('[DAC_MONEY_FLOW] DAC backend not available');
    return null;
  }

  return new DACMoneyFlowAdapter(env.DAC_BACKEND as any);
}
