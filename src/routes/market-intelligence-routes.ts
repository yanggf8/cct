/**
 * Unified Market Intelligence Routes (API v1)
 * Combines sector rotation and market drivers for comprehensive market analysis
 * Provides integrated investment intelligence and actionable insights
 */

import {
  ApiResponseFactory,
  ProcessingTimer,
  HttpStatus
} from '../modules/api-v1-responses.js';
import {
  validateApiKey,
  generateRequestId,
  parseQueryParams
} from './api-v1.js';
import { executeSectorRotationAnalysis, getCachedSectorRotationResults } from '../modules/sector-rotation-workflow.js';
import { initializeMarketDrivers, type MarketDriversSnapshot } from '../modules/market-drivers.js';
import { createSimplifiedEnhancedDAL } from '../modules/simplified-enhanced-dal.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment, SectorRotationResult } from '../types.js';

const logger = createLogger('market-intelligence-routes');

/**
 * Handle unified market intelligence routes
 */
export async function handleMarketIntelligenceRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
  const requestId = headers['X-Request-ID'] || generateRequestId();

  try {
    // GET /api/v1/market-intelligence/dashboard - Complete unified dashboard
    if (path === '/api/v1/market-intelligence/dashboard' && method === 'GET') {
      return await handleUnifiedDashboard(request, env, headers, requestId);
    }

    // GET /api/v1/market-intelligence/synopsis - Market synopsis with key insights
    if (path === '/api/v1/market-intelligence/synopsis' && method === 'GET') {
      return await handleMarketSynopsis(request, env, headers, requestId);
    }

    // GET /api/v1/market-intelligence/top-picks - Investment recommendations based on combined analysis
    if (path === '/api/v1/market-intelligence/top-picks' && method === 'GET') {
      return await handleTopPicks(request, env, headers, requestId);
    }

    // GET /api/v1/market-intelligence/risk-report - Comprehensive risk analysis
    if (path === '/api/v1/market-intelligence/risk-report' && method === 'GET') {
      return await handleRiskReport(request, env, headers, requestId);
    }

    // POST /api/v1/market-intelligence/comprehensive-analysis - Run complete unified analysis
    if (path === '/api/v1/market-intelligence/comprehensive-analysis' && method === 'POST') {
      return await handleComprehensiveAnalysis(request, env, headers, requestId);
    }

    // Method not allowed for existing paths
    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          `Method ${method} not allowed for ${path}`,
          'METHOD_NOT_ALLOWED',
          { requestId }
        )
      ),
      {
        status: HttpStatus.METHOD_NOT_ALLOWED,
        headers,
      }
    );
  } catch (error: unknown) {
    logger.error('MarketIntelligenceRoutes Error', { error: (error as any).message,  requestId, path, method });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Internal server error',
          'INTERNAL_ERROR',
          {
            requestId,
            path,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle unified market intelligence dashboard
 * GET /api/v1/market-intelligence/dashboard
 */
async function handleUnifiedDashboard(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  try {
    const useCache = params.cache !== 'false';

    logger.info('Starting unified dashboard generation', {
      requestId,
      useCache
    });

    // Get sector rotation results
    const sectorRotation = await getCachedSectorRotationResults(env) ||
                          (useCache ? null : await executeSectorRotationAnalysis(env));

    // Get market drivers snapshot
    const marketDrivers = initializeMarketDrivers(env);
    const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();

    // Generate unified insights
    const unifiedInsights = generateUnifiedInsights(
      sectorRotation,
      driversSnapshot,
      timer.getElapsedMs()
    );

    const dashboard = {
      timestamp: new Date().toISOString(),
      analysisDate: new Date().toISOString().split('T')[0],
      market_overview: {
        regime: driversSnapshot.regime.currentRegime,
        riskLevel: driversSnapshot.regime.riskLevel,
        confidence: driversSnapshot.regime.confidence,
        riskOnRiskOff: driversSnapshot.regime.riskLevel === 'low' ? 'risk-on' : 'risk-off',
        marketHealth: driversSnapshot.realDataCompliance ? 'healthy' : 'degraded'
      },
      sector_analysis: sectorRotation ? {
        leadingSector: sectorRotation.rotationSignals.leadingSector,
        laggingSector: sectorRotation.rotationSignals.laggingSector,
        emergingSectors: sectorRotation.rotationSignals.emergingSectors,
        decliningSectors: sectorRotation.rotationSignals.decliningSectors,
        topPerformers: getTopPerformers(sectorRotation),
        underperformers: getUnderperformers(sectorRotation)
      } : null,
      macro_environment: {
        fedFundsRate: driversSnapshot.macro.fedFundsRate.value,
        inflationRate: driversSnapshot.macro.inflationRate.value,
        unemploymentRate: driversSnapshot.macro.unemploymentRate.value,
        yieldCurveSpread: driversSnapshot.macro.yieldCurveSpread.value,
        economicMomentum: driversSnapshot.regime.currentRegime
      },
      market_structure: {
        vix: driversSnapshot.marketStructure.vix.value,
        dollarStrength: driversSnapshot.marketStructure.dollarTrend,
        marketBreadth: driversSnapshot.marketStructure.spyTrend,
        volatilityRegime: getVolatilityRegime(driversSnapshot.marketStructure.vix.value)
      },
      unified_insights: unifiedInsights,
      data_quality: {
        sectorRotationData: !!sectorRotation,
        marketDriversData: !!driversSnapshot,
        lastUpdated: new Date().toISOString(),
        processingTime: timer.getElapsedMs()
      }
    };

    logger.info('Unified dashboard generated', {
      requestId,
      regime: driversSnapshot.regime.currentRegime,
      leadingSector: sectorRotation?.rotationSignals?.leadingSector,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(dashboard, {
          source: sectorRotation ? 'mixed' : 'fresh',
          ttl: 1800, // 30 minutes
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate unified dashboard', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate unified market dashboard',
          'DASHBOARD_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle market synopsis with key insights
 * GET /api/v1/market-intelligence/synopsis
 */
async function handleMarketSynopsis(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Get market drivers snapshot
    const marketDrivers = initializeMarketDrivers(env);
    const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();

    // Get sector rotation results
    const sectorRotation = await getCachedSectorRotationResults(env);

    // Generate concise synopsis
    const riskAppetite = driversSnapshot.regime.riskLevel === 'low' ? 'risk-on' : 'risk-off';
    const synopsis = {
      timestamp: new Date().toISOString(),
      market_regime: {
        current: driversSnapshot.regime.currentRegime,
        outlook: driversSnapshot.regime.confidence > 70 ? 'stable' : 'transitioning',
        risk_appetite: riskAppetite
      },
      key_themes: identifyMarketThemes(driversSnapshot, sectorRotation),
      sector_focus: {
        favored: driversSnapshot.regime.favoredSectors,
        avoided: driversSnapshot.regime.avoidedSectors,
        best_performer: sectorRotation?.rotationSignals?.leadingSector,
        worst_performer: sectorRotation?.rotationSignals?.laggingSector
      },
      macro_watchlist: {
        critical_levels: [
          `VIX: ${driversSnapshot.marketStructure.vix.value.toFixed(1)}`,
          `Fed Funds Rate: ${driversSnapshot.macro.fedFundsRate.value.toFixed(2)}%`,
          `Yield Curve Spread: ${driversSnapshot.macro.yieldCurveSpread.value.toFixed(2)}%`
        ],
        trend_signals: [
          `Dollar: ${driversSnapshot.marketStructure.dollarTrend}`,
          `Market Momentum: ${driversSnapshot.marketStructure.spyTrend}`,
          `Volatility: ${getVolatilityRegime(driversSnapshot.marketStructure.vix.value)}`
        ]
      },
      investment_strategy: generateInvestmentStrategy(driversSnapshot, sectorRotation),
      time_horizon: driversSnapshot.regime.duration || 'medium_term'
    };

    logger.info('Market synopsis generated', {
      requestId,
      regime: driversSnapshot.regime.currentRegime,
      riskAppetite,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(synopsis, {
          source: 'fresh',
          ttl: 900, // 15 minutes
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate market synopsis', {
      requestId,
      error: (error instanceof Error ? error.message : String(error))
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate market synopsis',
          'SYNOPSIS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle investment top picks based on combined analysis
 * GET /api/v1/market-intelligence/top-picks
 */
async function handleTopPicks(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Get sector rotation results
    const sectorRotation = await getCachedSectorRotationResults(env);

    // Get market drivers snapshot
    const marketDrivers = initializeMarketDrivers(env);
    const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();

    // Generate top picks based on combined analysis
    const topPicks = generateTopPicks(sectorRotation, driversSnapshot);

    const response = {
      timestamp: new Date().toISOString(),
      methodology: 'Combined sector rotation and market drivers analysis',
      market_context: {
        regime: driversSnapshot.regime.currentRegime,
        riskLevel: driversSnapshot.regime.riskLevel,
        confidence: driversSnapshot.regime.confidence
      },
      top_picks: topPicks,
      risk_considerations: generateRiskConsiderations(driversSnapshot),
      allocation_suggestions: generateAllocationSuggestions(driversSnapshot, topPicks)
    };

    logger.info('Top picks generated', {
      requestId,
      picksCount: topPicks.length,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(response, {
          source: 'analysis',
          ttl: 3600, // 1 hour
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate top picks', {
      requestId,
      error: (error instanceof Error ? error.message : String(error))
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate investment top picks',
          'TOP_PICKS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle comprehensive risk analysis
 * GET /api/v1/market-intelligence/risk-report
 */
async function handleRiskReport(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    // Get market drivers snapshot
    const marketDrivers = initializeMarketDrivers(env);
    const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();

    // Get sector rotation results
    const sectorRotation = await getCachedSectorRotationResults(env);

    const riskReport = {
      timestamp: new Date().toISOString(),
      overall_risk_assessment: {
        level: driversSnapshot.regime.riskLevel,
        score: calculateRiskScore(driversSnapshot),
        outlook: driversSnapshot.regime.confidence > 70 ? 'stable' : 'elevated_uncertainty'
      },
      macro_risks: {
        recession_risk: driversSnapshot.macro.yieldCurveSpread.value < -0.5 ? 'high' : 'moderate',
        inflation_risk: driversSnapshot.macro.inflationRate.value > 3 ? 'elevated' : 'moderate',
        monetary_policy_risk: driversSnapshot.macro.fedFundsRate.value > 4.5 ? 'tight' : 'accommodative'
      },
      market_risks: {
        volatility_risk: getVolatilityRiskLevel(driversSnapshot.marketStructure.vix.value),
        systemic_risk: driversSnapshot.geopolitical.overallRiskScore.value > 0.7 ? 'elevated' : 'moderate',
        liquidity_risk: 'normal' // Would need additional analysis
      },
      sector_risks: sectorRotation ? analyzeSectorRisks(sectorRotation, driversSnapshot) : null,
      risk_mitigation: generateRiskMitigationStrategies(driversSnapshot, sectorRotation),
      key_watch_items: [
        ...driversSnapshot.regime.avoidedSectors.map(item => ({ type: 'market_driver', item })),
        ...(sectorRotation?.rotationSignals?.decliningSectors || []).map(sector => ({ type: 'sector_weakness', item: sector }))
      ]
    };

    logger.info('Risk report generated', {
      requestId,
      riskLevel: driversSnapshot.regime.riskLevel,
      riskScore: calculateRiskScore(driversSnapshot),
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(riskReport, {
          source: 'analysis',
          ttl: 1800, // 30 minutes
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to generate risk report', {
      requestId,
      error: (error instanceof Error ? error.message : String(error))
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to generate risk report',
          'RISK_REPORT_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

/**
 * Handle comprehensive unified analysis
 * POST /api/v1/market-intelligence/comprehensive-analysis
 */
async function handleComprehensiveAnalysis(
  request: Request,
  env: CloudflareEnvironment,
  headers: Record<string, string>,
  requestId: string
): Promise<Response> {
  const timer = new ProcessingTimer();

  try {
    logger.info('Starting comprehensive unified analysis', { requestId });

    // Execute sector rotation analysis
    const sectorRotation = await executeSectorRotationAnalysis(env);

    // Get market drivers snapshot
    const marketDrivers = initializeMarketDrivers(env);
    const driversSnapshot = await marketDrivers.getMarketDriversSnapshot();

    // Generate comprehensive unified analysis
    const comprehensiveAnalysis = {
      timestamp: new Date().toISOString(),
      analysis_date: new Date().toISOString().split('T')[0],
      execution_summary: {
        totalProcessingTime: timer.getElapsedMs(),
        sectorAnalysisTime: sectorRotation.executionMetrics.totalProcessingTime,
        componentsAnalyzed: ['sector_rotation', 'market_drivers', 'risk_analysis', 'investment_insights']
      },
      market_intelligence: {
        drivers: driversSnapshot,
        sectors: sectorRotation,
        unified_insights: generateUnifiedInsights(sectorRotation, driversSnapshot, timer.getElapsedMs())
      },
      actionable_intelligence: {
        top_opportunities: generateTopPicks(sectorRotation, driversSnapshot),
        key_risks: generateRiskConsiderations(driversSnapshot),
        strategy_recommendations: generateInvestmentStrategy(driversSnapshot, sectorRotation),
        allocation_guidance: generateAllocationSuggestions(driversSnapshot, generateTopPicks(sectorRotation, driversSnapshot))
      },
      quality_metrics: {
        data_completeness: calculateDataCompleteness(sectorRotation, driversSnapshot),
        confidence_score: calculateOverallConfidence(sectorRotation, driversSnapshot),
        freshness_score: 100 // Fresh analysis
      }
    };

    logger.info('Comprehensive unified analysis completed', {
      requestId,
      regime: driversSnapshot.regime.currentRegime,
      leadingSector: sectorRotation.rotationSignals.leadingSector,
      processingTime: timer.getElapsedMs()
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.success(comprehensiveAnalysis, {
          source: 'fresh',
          ttl: 3600, // 1 hour
          requestId,
          processingTime: timer.finish(),
        })
      ),
      { status: HttpStatus.OK, headers }
    );

  } catch (error: any) {
    logger.error('Failed to execute comprehensive analysis', {
      requestId,
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    return new Response(
      JSON.stringify(
        ApiResponseFactory.error(
          'Failed to execute comprehensive market analysis',
          'COMPREHENSIVE_ANALYSIS_ERROR',
          {
            requestId,
            error: error.message,
            processingTime: timer.finish()
          }
        )
      ),
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        headers,
      }
    );
  }
}

// Helper functions for unified analysis

function generateUnifiedInsights(
  sectorRotation: SectorRotationResult | null,
  driversSnapshot: MarketDriversSnapshot,
  processingTime: number
): any {
  if (!sectorRotation) {
    return {
      status: 'limited',
      message: 'Sector rotation data unavailable',
      availableInsights: ['market_regime', 'macro_environment'],
      processingTime
    };
  }

  // Align favored sectors from market drivers with actual sector performance
  const favoredSectorsPerformance = driversSnapshot.regime.favoredSectors.map(favoredSector => {
    const sectorETF = sectorRotation.etfAnalyses.find(etf =>
      etf.name.toLowerCase().includes(favoredSector.toLowerCase())
    );
    return {
      sector: favoredSector,
      etf: sectorETF?.symbol,
      performance: sectorETF?.performanceMetrics.daily || 0,
      sentiment: sectorETF?.sentiment.overall || 'neutral',
      alignment: sectorETF ? 'aligned' : 'no_data'
    };
  });

  return {
    market_narrative: generateMarketNarrative(driversSnapshot, sectorRotation),
    sector_alignment: {
      favored_sectors_performance: favoredSectorsPerformance,
      alignment_score: calculateAlignmentScore(favoredSectorsPerformance),
      key_misalignments: findMisalignments(favoredSectorsPerformance)
    },
    risk_adjusted_opportunities: identifyRiskAdjustedOpportunities(sectorRotation, driversSnapshot),
    market_regime_confirmation: {
      regime: driversSnapshot.regime.currentRegime,
      confidence: driversSnapshot.regime.confidence,
      sector_rotation_support: assessRegimeSupport(sectorRotation, driversSnapshot)
    },
    processing_time: processingTime
  };
}

function generateMarketNarrative(driversSnapshot: MarketDriversSnapshot, sectorRotation: SectorRotationResult): string {
  const regime = driversSnapshot.regime.currentRegime;
  const riskLevel = driversSnapshot.regime.riskLevel;
  const leadingSector = sectorRotation.rotationSignals.leadingSector;
  const riskAppetite = driversSnapshot.regime.riskLevel === 'low' ? 'risk-on' : 'risk-off';

  return `Market is in a ${regime} regime with ${riskLevel} risk levels. ` +
    `${leadingSector} is showing relative strength with ${sectorRotation.etfAnalyses.find(etf => etf.symbol === leadingSector)?.performanceMetrics.daily.toFixed(2) || 'minimal'}% daily performance. ` +
    `Risk appetite is ${riskAppetite} with VIX at ${driversSnapshot.marketStructure.vix.value.toFixed(1)}.`;
}

function getTopPerformers(sectorRotation: SectorRotationResult): Array<{symbol: string, name: string, performance: number}> {
  return sectorRotation.etfAnalyses
    .sort((a: any, b: any) => b.performanceMetrics.daily - a.performanceMetrics.daily)
    .slice(0, 3)
    .map(etf => ({
      symbol: etf.symbol,
      name: etf.name,
      performance: etf.performanceMetrics.daily
    }));
}

function getUnderperformers(sectorRotation: SectorRotationResult): Array<{symbol: string, name: string, performance: number}> {
  return sectorRotation.etfAnalyses
    .sort((a: any, b: any) => a.performanceMetrics.daily - b.performanceMetrics.daily)
    .slice(0, 3)
    .map(etf => ({
      symbol: etf.symbol,
      name: etf.name,
      performance: etf.performanceMetrics.daily
    }));
}

function getVolatilityRegime(vix: number): string {
  if (vix > 30) return 'high_volatility';
  if (vix > 20) return 'elevated_volatility';
  return 'normal_volatility';
}

function identifyMarketThemes(driversSnapshot: MarketDriversSnapshot, sectorRotation: SectorRotationResult | null): string[] {
  const themes = [];
  const riskAppetite = driversSnapshot.regime.riskLevel === 'low' ? 'risk_on' : 'risk_off';

  if (riskAppetite === 'risk_on') {
    themes.push('Risk-on sentiment dominant');
  } else if (riskAppetite === 'risk_off') {
    themes.push('Risk aversion prevailing');
  }

  if (driversSnapshot.marketStructure.vix.value > 25) {
    themes.push('Elevated volatility environment');
  }

  if (driversSnapshot.macro.yieldCurveSpread.value < 0) {
    themes.push('Inverted yield curve concerns');
  }

  if (sectorRotation) {
    const topPerformer = sectorRotation.etfAnalyses.find(etf => etf.symbol === sectorRotation.rotationSignals.leadingSector);
    if (topPerformer && topPerformer.performanceMetrics.daily > 1) {
      themes.push(`${topPerformer.name} sector leadership`);
    }
  }

  return themes;
}

function generateInvestmentStrategy(driversSnapshot: MarketDriversSnapshot, sectorRotation: SectorRotationResult | null): string {
  const regime = driversSnapshot.regime.currentRegime;
  const riskLevel = driversSnapshot.regime.riskLevel;
  const riskAppetite = riskLevel === 'low' ? 'risk_on' : riskLevel === 'high' ? 'risk_off' : 'neutral';

  if (riskLevel === 'high' || regime.includes('contraction')) {
    return 'Defensive positioning with focus on quality and dividend stability';
  } else if (riskLevel === 'medium' && riskAppetite === 'neutral') {
    return 'Balanced approach with selective growth exposure';
  } else {
    return 'Growth-oriented with emphasis on sector leaders and innovation';
  }
}

function generateTopPicks(sectorRotation: SectorRotationResult | null, driversSnapshot: MarketDriversSnapshot): any[] {
  if (!sectorRotation) return [];

  return sectorRotation.etfAnalyses
    .filter(etf => {
      // Favor sectors aligned with market drivers' favored sectors
      const isFavored = driversSnapshot.regime.favoredSectors.some(favored =>
        etf.name.toLowerCase().includes(favored.toLowerCase())
      );

      // Good performance and positive sentiment
      const goodPerformance = etf.performanceMetrics.daily > -1;
      const positiveSentiment = etf.sentiment.overall !== 'bearish';

      return isFavored && goodPerformance && positiveSentiment;
    })
    .sort((a: any, b: any) => b.performanceMetrics.daily - a.performanceMetrics.daily)
    .slice(0, 5)
    .map(etf => ({
      symbol: etf.symbol,
      name: etf.name,
      investment_thesis: `${etf.name} shows ${etf.sentiment.overall} sentiment with ${etf.performanceMetrics.daily.toFixed(2)}% performance. ${etf.rotationSignal.reasoning}`,
      risk_level: etf.performanceMetrics.volatility > 20 ? 'high' : etf.performanceMetrics.volatility > 15 ? 'medium' : 'low',
      allocation_suggestion: 'moderate'
    }));
}

function generateRiskConsiderations(driversSnapshot: MarketDriversSnapshot): string[] {
  const considerations = [];

  if (driversSnapshot.marketStructure.vix.value > 25) {
    considerations.push('Elevated volatility requires position sizing discipline');
  }

  if (driversSnapshot.macro.yieldCurveSpread.value < -0.5) {
    considerations.push('Recession risk from inverted yield curve');
  }

  if (driversSnapshot.geopolitical.overallRiskScore.value > 0.6) {
    considerations.push('Geopolitical tensions may impact market stability');
  }

  if (driversSnapshot.regime.confidence < 60) {
    considerations.push('Low regime confidence suggests defensive positioning');
  }

  return considerations;
}

function generateAllocationSuggestions(driversSnapshot: MarketDriversSnapshot, topPicks: any[]): any {
  const baseAllocation = {
    equities: driversSnapshot.regime.riskLevel === 'high' ? 60 : driversSnapshot.regime.riskLevel === 'medium' ? 75 : 85,
    fixed_income: driversSnapshot.regime.riskLevel === 'high' ? 30 : driversSnapshot.regime.riskLevel === 'medium' ? 20 : 10,
    cash: driversSnapshot.regime.riskLevel === 'high' ? 10 : driversSnapshot.regime.riskLevel === 'medium' ? 5 : 5
  };

  if (topPicks.length > 0) {
    baseAllocation['sector_focus'] = topPicks.slice(0, 3).map(pick => ({
      symbol: pick.symbol,
      allocation: '15-20%'
    }));
  }

  return baseAllocation;
}

function calculateRiskScore(driversSnapshot: MarketDriversSnapshot): number {
  let score = 0.5; // Base score

  // VIX contribution
  if (driversSnapshot.marketStructure.vix.value > 30) score += 0.2;
  else if (driversSnapshot.marketStructure.vix.value > 20) score += 0.1;

  // Yield curve contribution
  if (driversSnapshot.macro.yieldCurveSpread.value < -1) score += 0.2;
  else if (driversSnapshot.macro.yieldCurveSpread.value < 0) score += 0.1;

  // Geopolitical risk contribution
  score += driversSnapshot.geopolitical.overallRiskScore.value * 0.3;

  return Math.min(1.0, score);
}

function getVolatilityRiskLevel(vix: number): string {
  if (vix > 35) return 'extreme';
  if (vix > 25) return 'high';
  if (vix > 18) return 'moderate';
  return 'low';
}

function analyzeSectorRisks(sectorRotation: SectorRotationResult, driversSnapshot: MarketDriversSnapshot): any {
  const decliningSectors = sectorRotation.rotationSignals.decliningSectors;

  return {
    sectors_with_weakness: decliningSectors.map(sector => ({
      symbol: sector,
      name: sectorRotation.etfAnalyses.find(etf => etf.symbol === sector)?.name || sector,
      performance: sectorRotation.etfAnalyses.find(etf => etf.symbol === sector)?.performanceMetrics.daily || 0
    })),
    concentration_risk: sectorRotation.etfAnalyses.filter(etf => etf.performanceMetrics.daily < -2).length > 5 ? 'high' : 'moderate'
  };
}

function generateRiskMitigationStrategies(driversSnapshot: MarketDriversSnapshot, sectorRotation: SectorRotationResult | null): string[] {
  const strategies = [];

  if (driversSnapshot.regime.riskLevel === 'high') {
    strategies.push('Increase defensive sector allocation');
    strategies.push('Reduce position sizes and increase cash');
  }

  if (driversSnapshot.marketStructure.vix.value > 25) {
    strategies.push('Use options for hedges when appropriate');
    strategies.push('Focus on quality and low-beta names');
  }

  if (sectorRotation && sectorRotation.rotationSignals.decliningSectors.length > 3) {
    strategies.push('Avoid or reduce exposure to weakening sectors');
  }

  return strategies;
}

function calculateAlignmentScore(favoredSectorsPerformance: any[]): number {
  if (favoredSectorsPerformance.length === 0) return 0.5;

  const alignedCount = favoredSectorsPerformance.filter(sector => sector.alignment === 'aligned').length;
  return alignedCount / favoredSectorsPerformance.length;
}

function findMisalignments(favoredSectorsPerformance: any[]): any[] {
  return favoredSectorsPerformance.filter(sector => sector.alignment === 'no_data' || sector.performance < -1);
}

function identifyRiskAdjustedOpportunities(sectorRotation: SectorRotationResult, driversSnapshot: MarketDriversSnapshot): any[] {
  return sectorRotation.etfAnalyses
    .filter(etf => {
      const riskAdjustedReturn = etf.performanceMetrics.daily / (etf.performanceMetrics.volatility / 100);
      return riskAdjustedReturn > 0.1 && etf.sentiment.overall !== 'bearish';
    })
    .sort((a: any, b: any) => {
      const riskReturnA = a.performanceMetrics.daily / (a.performanceMetrics.volatility / 100);
      const riskReturnB = b.performanceMetrics.daily / (b.performanceMetrics.volatility / 100);
      return riskReturnB - riskReturnA;
    })
    .slice(0, 3)
    .map(etf => ({
      symbol: etf.symbol,
      name: etf.name,
      risk_adjusted_return: etf.performanceMetrics.daily / (etf.performanceMetrics.volatility / 100),
      reasoning: `${etf.name} offers favorable risk-adjusted returns with ${etf.sentiment.overall} sentiment`
    }));
}

function assessRegimeSupport(sectorRotation: SectorRotationResult, driversSnapshot: MarketDriversSnapshot): string {
  const leadingSectorPerformance = sectorRotation.etfAnalyses.find(etf => etf.symbol === sectorRotation.rotationSignals.leadingSector)?.performanceMetrics.daily || 0;

  if (leadingSectorPerformance > 1 && driversSnapshot.regime.confidence > 70) {
    return 'strong';
  } else if (leadingSectorPerformance > 0 && driversSnapshot.regime.confidence > 50) {
    return 'moderate';
  } else {
    return 'weak';
  }
}

function calculateDataCompleteness(sectorRotation: SectorRotationResult, driversSnapshot: MarketDriversSnapshot): number {
  let completeness = 0.5; // Base for market drivers

  if (sectorRotation && sectorRotation.etfAnalyses.length === 11) {
    completeness += 0.4; // Full sector coverage
  }

  if (driversSnapshot.macro.fedFundsRate.value > 0) {
    completeness += 0.1; // Macro data available
  }

  return Math.min(1.0, completeness);
}

function calculateOverallConfidence(sectorRotation: SectorRotationResult, driversSnapshot: MarketDriversSnapshot): number {
  const regimeConfidence = driversSnapshot.regime.confidence / 100;
  const sectorDataQuality = sectorRotation ? 0.8 : 0.5;

  return (regimeConfidence + sectorDataQuality) / 2;
}