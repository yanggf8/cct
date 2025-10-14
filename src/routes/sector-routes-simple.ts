/**
 * Sector Routes - Simple Implementation
 * Rate-limit-safe sector rotation API endpoints
 * ZERO AI/News API dependencies - pure market data analysis
 */

import { SimpleSectorFetcher } from '../modules/sector-fetcher-simple.js';
import { SectorIndicators } from '../modules/sector-indicators.js';
import { SECTOR_CONFIG } from '../modules/sector-config.js';

interface SectorSnapshotResponse {
  success: boolean;
  data?: {
    timestamp: string;
    date: string;
    sectors: any[];
    spy: any;
    metadata: {
      fetchedAt: string;
      source: string;
      apiCalls: number;
      fetchTimeMs: number;
    };
  };
  error?: string;
  timestamp: string;
}

interface SectorAnalysisResponse {
  success: boolean;
  data?: {
    timestamp: string;
    sectors: any[];
    summary: {
      leadingStrength: string[];
      weakeningStrength: string[];
      laggingWeakness: string[];
      improvingWeakness: string[];
    };
    marketAnalysis: {
      trend: string;
      confidence: number;
      topSectors: string[];
      weakSectors: string[];
    };
  };
  error?: string;
  timestamp: string;
}

export class SectorRoutes {
  private fetcher: SimpleSectorFetcher;
  private indicators: SectorIndicators;

  constructor() {
    this.fetcher = new SimpleSectorFetcher();
    this.indicators = new SectorIndicators();
  }

  /**
   * GET /api/sectors/snapshot
   * Get current sector snapshot with real-time data
   */
  async handleSectorSnapshot(): Promise<SectorSnapshotResponse> {
    try {
      const snapshot = await this.fetcher.fetchSectorSnapshot();

      return {
        success: true,
        data: snapshot,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/sectors/analysis
   * Get complete sector rotation analysis
   */
  async handleSectorAnalysis(): Promise<SectorAnalysisResponse> {
    try {
      // First get the snapshot data
      const snapshot = await this.fetcher.fetchSectorSnapshot();

      if (!snapshot.sectors || snapshot.sectors.length === 0) {
        throw new Error('No sector data available for analysis');
      }

      // Analyze sectors (simplified analysis without heavy calculations)
      const analyzedSectors = snapshot.sectors.map(sector => {
        // Simple classification based on performance
        let quadrant: string;
        let signals: string[] = [];

        if (sector.changePercent > 2) {
          quadrant = 'Leading Strength';
          signals.push('Strong outperformance');
        } else if (sector.changePercent > 0.5) {
          quadrant = 'Weakening Strength';
          signals.push('Moderate outperformance');
        } else if (sector.changePercent > -0.5) {
          quadrant = 'Improving Weakness';
          signals.push('Neutral performance');
        } else {
          quadrant = 'Lagging Weakness';
          signals.push('Underperformance');
        }

        return {
          ...sector,
          quadrant,
          signals,
          relativeStrength: 100 + (sector.changePercent * 2), // Simple RS calculation
          momentum: sector.changePercent
        };
      });

      // Group sectors by quadrant
      const summary = {
        leadingStrength: analyzedSectors
          .filter(s => s.quadrant === 'Leading Strength')
          .map(s => s.symbol),
        weakeningStrength: analyzedSectors
          .filter(s => s.quadrant === 'Weakening Strength')
          .map(s => s.symbol),
        laggingWeakness: analyzedSectors
          .filter(s => s.quadrant === 'Lagging Weakness')
          .map(s => s.symbol),
        improvingWeakness: analyzedSectors
          .filter(s => s.quadrant === 'Improving Weakness')
          .map(s => s.symbol)
      };

      // Market analysis
      const avgPerformance = analyzedSectors.reduce((sum, s) => sum + s.changePercent, 0) / analyzedSectors.length;
      const marketAnalysis = {
        trend: avgPerformance > 1 ? 'Bullish' : avgPerformance < -1 ? 'Bearish' : 'Neutral',
        confidence: Math.min(Math.abs(avgPerformance) / 2, 1),
        topSectors: analyzedSectors
          .sort((a, b) => b.changePercent - a.changePercent)
          .slice(0, 3)
          .map(s => s.symbol),
        weakSectors: analyzedSectors
          .sort((a, b) => a.changePercent - b.changePercent)
          .slice(0, 3)
          .map(s => s.symbol)
      };

      return {
        success: true,
        data: {
          timestamp: snapshot.timestamp,
          sectors: analyzedSectors,
          summary,
          marketAnalysis
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/sectors/health
   * Get sector system health status
   */
  async handleSectorHealth(): Promise<{
    success: boolean;
    data?: {
      status: string;
      fetcher: any;
      config: any;
      lastUpdate?: string;
    };
    error?: string;
    timestamp: string;
  }> {
    try {
      const fetcherStatus = this.fetcher.getCircuitBreakerStatus();

      return {
        success: true,
        data: {
          status: 'healthy',
          fetcher: fetcherStatus,
          config: {
            symbols: SECTOR_CONFIG.SYMBOLS.length,
            refreshInterval: SECTOR_CONFIG.REFRESH_INTERVALS,
            maxConcurrentRequests: SECTOR_CONFIG.RATE_LIMITING.MAX_CONCURRENT_REQUESTS,
            batchDelay: SECTOR_CONFIG.RATE_LIMITING.BATCH_DELAY_MS
          }
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/sectors/test
   * Test the sector system with minimal API calls
   */
  async handleSectorTest(): Promise<{
    success: boolean;
    message: string;
    data?: any;
    timestamp: string;
  }> {
    try {
      const testResult = await this.fetcher.testFetch();

      return {
        success: testResult.success,
        message: testResult.message,
        data: testResult.data,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /api/sectors/config
   * Get sector configuration (for debugging)
   */
  async handleSectorConfig(): Promise<{
    success: boolean;
    data?: any;
    timestamp: string;
  }> {
    return {
      success: true,
      data: {
        symbols: SECTOR_CONFIG.SYMBOLS,
        sectorNames: SECTOR_CONFIG.SECTOR_NAMES,
        refreshIntervals: SECTOR_CONFIG.REFRESH_INTERVALS,
        rateLimiting: SECTOR_CONFIG.RATE_LIMITING,
        indicators: SECTOR_CONFIG.INDICATORS,
        thresholds: SECTOR_CONFIG.QUADRANT_THRESHOLDS
      },
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Route handler function for Cloudflare Workers
 */
export async function handleSectorRoute(request: Request, env: any, ctx: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const sectorRoutes = new SectorRoutes();

  try {
    let response;

    switch (path) {
      case '/api/sectors/snapshot':
        response = await sectorRoutes.handleSectorSnapshot();
        break;

      case '/api/sectors/analysis':
        response = await sectorRoutes.handleSectorAnalysis();
        break;

      case '/api/sectors/health':
        response = await sectorRoutes.handleSectorHealth();
        break;

      case '/api/sectors/test':
        response = await sectorRoutes.handleSectorTest();
        break;

      case '/api/sectors/config':
        response = await sectorRoutes.handleSectorConfig();
        break;

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Sector endpoint not found',
          availableEndpoints: [
            '/api/sectors/snapshot',
            '/api/sectors/analysis',
            '/api/sectors/health',
            '/api/sectors/test',
            '/api/sectors/config'
          ]
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
    }

    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('Sector route error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export default handleSectorRoute;