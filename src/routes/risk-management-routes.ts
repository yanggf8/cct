/**
 * Risk Management API Routes
 * API endpoints for advanced risk assessment and monitoring
 * Phase 2D: Advanced Risk Management & Regulatory Compliance
 */

import { createAdvancedRiskManagementEngine } from '../modules/advanced-risk-management.js';
import { createRegulatoryComplianceEngine } from '../modules/regulatory-compliance.js';
import { ApiResponseFactory } from '../modules/api-v1-responses.js';

/**
 * Risk Management Routes Handler
 */
export class RiskManagementRoutesHandler {
  constructor(env) {
    this.env = env;
    this.riskEngine = createAdvancedRiskManagementEngine(env);
    this.complianceEngine = createRegulatoryComplianceEngine(env);
  }

  /**
   * Handle risk assessment request
   * POST /api/v1/risk/assessment
   */
  async handleRiskAssessment(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData, marketData = {};
      if (requestData.portfolio && requestData.portfolio.portfolioId) {
        // Test format: { portfolio: { portfolioId, weights, ... } }
        portfolioData = requestData.portfolio;
        marketData = requestData.marketData || {};
      } else if (requestData.portfolioData && requestData.portfolioData.portfolioId) {
        // Expected format: { portfolioData: { portfolioId, weights, ... } }
        portfolioData = requestData.portfolioData;
        marketData = requestData.marketData || {};
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data with portfolioId is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      // Perform comprehensive risk assessment
      const assessment = await this.riskEngine.performRiskAssessment(portfolioData, marketData);

      const body = ApiResponseFactory.success({
        assessment: {
          id: assessment.id,
          portfolioId: assessment.portfolioId,
          assessmentDate: assessment.assessmentDate,
          overallRiskScore: assessment.overallRiskScore,
          riskLevel: assessment.riskLevel,
          categoryBreakdown: assessment.categoryBreakdown,
          recommendations: assessment.recommendations,
          alerts: assessment.alerts
        },
        summary: {
          totalCategories: Object.keys(assessment.categoryBreakdown).length,
          highRiskCategories: Object.values(assessment.categoryBreakdown)
            .filter(cat => cat.level.value >= 3).length,
          totalAlerts: assessment.alerts.length,
          totalRecommendations: assessment.recommendations.length
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Risk assessment request failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'RISK_ASSESSMENT_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle market risk assessment
   * POST /api/v1/risk/market
   */
  async handleMarketRiskAssessment(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData, marketData = {};
      if (requestData.portfolio) {
        // Test format: { portfolio: { weights, betas, ... } }
        portfolioData = requestData.portfolio;
        marketData = requestData.marketData || {};
      } else if (requestData.portfolioData) {
        // Expected format: { portfolioData: { weights, betas, ... } }
        portfolioData = requestData.portfolioData;
        marketData = requestData.marketData || {};
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      const marketRisk = await this.riskEngine.assessMarketRisk(portfolioData, marketData);

      const body = ApiResponseFactory.success({
        marketRisk: {
          category: marketRisk.category,
          score: marketRisk.score,
          level: marketRisk.level,
          metrics: marketRisk.metrics,
          factors: marketRisk.factors
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Market risk assessment failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'MARKET_RISK_ASSESSMENT_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle concentration risk assessment
   * POST /api/v1/risk/concentration
   */
  async handleConcentrationRiskAssessment(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData;
      if (requestData.portfolio) {
        portfolioData = requestData.portfolio;
      } else if (requestData.portfolioData) {
        portfolioData = requestData.portfolioData;
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      const concentrationRisk = await this.riskEngine.assessConcentrationRisk(portfolioData);

      const body = ApiResponseFactory.success({
        concentrationRisk: {
          category: concentrationRisk.category,
          score: concentrationRisk.score,
          level: concentrationRisk.level,
          metrics: concentrationRisk.metrics,
          concentrations: concentrationRisk.concentrations
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Concentration risk assessment failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'CONCENTRATION_RISK_ASSESSMENT_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle liquidity risk assessment
   * POST /api/v1/risk/liquidity
   */
  async handleLiquidityRiskAssessment(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData, marketData = {};
      if (requestData.portfolio) {
        portfolioData = requestData.portfolio;
        marketData = requestData.marketData || {};
      } else if (requestData.portfolioData) {
        portfolioData = requestData.portfolioData;
        marketData = requestData.marketData || {};
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      const liquidityRisk = await this.riskEngine.assessLiquidityRisk(portfolioData, marketData);

      const body = ApiResponseFactory.success({
        liquidityRisk: {
          category: liquidityRisk.category,
          score: liquidityRisk.score,
          level: liquidityRisk.level,
          metrics: liquidityRisk.metrics,
          factors: liquidityRisk.factors
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Liquidity risk assessment failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'LIQUIDITY_RISK_ASSESSMENT_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle stress testing
   * POST /api/v1/risk/stress-test
   */
  async handleStressTest(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData, scenarios = [];
      if (requestData.portfolio && requestData.portfolio.portfolioId) {
        portfolioData = requestData.portfolio;
        scenarios = requestData.scenarios || [];
      } else if (requestData.portfolioData && requestData.portfolioData.portfolioId) {
        portfolioData = requestData.portfolioData;
        scenarios = requestData.scenarios || [];
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data with portfolioId is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      const stressTest = await this.riskEngine.performAdvancedStressTest(portfolioData, scenarios);

      const body = ApiResponseFactory.success({
        stressTest: {
          id: stressTest.id,
          portfolioId: stressTest.portfolioId,
          testDate: stressTest.testDate,
          scenarios: stressTest.scenarios,
          aggregateResults: stressTest.aggregateResults,
          worstCaseScenario: stressTest.worstCaseScenario,
          recommendations: stressTest.recommendations
        },
        summary: {
          scenariosRun: Object.keys(stressTest.scenarios).length,
          worstCaseLoss: stressTest.aggregateResults.worstCaseLoss,
          averageLoss: stressTest.aggregateResults.averageLoss,
          weightedLoss: stressTest.aggregateResults.weightedLoss
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Stress test failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'STRESS_TEST_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle compliance assessment
   * POST /api/v1/risk/compliance
   */
  async handleComplianceAssessment(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData, clientData = {}, frameworks = [];
      if (requestData.portfolio && requestData.portfolio.portfolioId) {
        portfolioData = requestData.portfolio;
        clientData = requestData.clientData || {};
        frameworks = requestData.frameworks || [];
      } else if (requestData.portfolioData && requestData.portfolioData.portfolioId) {
        portfolioData = requestData.portfolioData;
        clientData = requestData.clientData || {};
        frameworks = requestData.frameworks || [];
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data with portfolioId is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      const assessment = await this.complianceEngine.performComplianceAssessment(
        portfolioData, clientData, frameworks
      );

      const body = ApiResponseFactory.success({
        compliance: {
          id: assessment.id,
          assessmentDate: assessment.assessmentDate,
          portfolioId: assessment.portfolioId,
          overallStatus: assessment.overallStatus,
          frameworkResults: assessment.frameworkResults,
          violations: assessment.violations,
          recommendations: assessment.recommendations,
          upcomingDeadlines: assessment.upcomingDeadlines
        },
        summary: {
          frameworksChecked: assessment.frameworks.length,
          compliant: assessment.overallStatus.value === 1,
          violationsCount: assessment.violations.length,
          upcomingDeadlinesCount: assessment.upcomingDeadlines.length
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Compliance assessment failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'COMPLIANCE_ASSESSMENT_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle regulatory report generation
   * POST /api/v1/risk/regulatory-report
   */
  async handleRegulatoryReport(request) {
    try {
      const { portfolioData, reportType, framework, period = {} } = await request.json();

      if (!portfolioData || !reportType) {
        const body = ApiResponseFactory.error(
          'Portfolio data and reportType are required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      const report = await this.complianceEngine.generateRegulatoryReport(
        portfolioData, reportType, framework, period
      );

      const body = ApiResponseFactory.success({
        report: {
          id: report.id,
          reportType: report.reportType,
          framework: report.framework,
          reportDate: report.reportDate,
          period: report.period,
          status: report.status,
          content: report.content
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Regulatory report generation failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'REGULATORY_REPORT_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle risk limits check
   * POST /api/v1/risk/limits
   */
  async handleRiskLimitsCheck(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData;
      if (requestData.portfolio) {
        portfolioData = requestData.portfolio;
      } else if (requestData.portfolioData) {
        portfolioData = requestData.portfolioData;
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      // Perform quick risk assessment to check limits
      const assessment = await this.riskEngine.performRiskAssessment(portfolioData, {});
      const limitsCheck = assessment.riskLimits;

      const body = ApiResponseFactory.success({
        limitsCheck: {
          breached: limitsCheck.breached || [],
          withinLimits: limitsCheck.withinLimits || [],
          overallStatus: limitsCheck.breached?.length > 0 ? 'BREACHED' : 'WITHIN_LIMITS'
        },
        summary: {
          breachedCount: limitsCheck.breached?.length || 0,
          withinLimitsCount: limitsCheck.withinLimits?.length || 0
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Risk limits check failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'RISK_LIMITS_CHECK_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle risk analytics
   * POST /api/v1/risk/analytics
   */
  async handleRiskAnalytics(request) {
    try {
      const requestData = await request.json();

      // Handle both direct and nested portfolio data structures
      let portfolioData, marketData = {}, includeStressTest = false;
      if (requestData.portfolio && requestData.portfolio.portfolioId) {
        portfolioData = requestData.portfolio;
        marketData = requestData.marketData || {};
        includeStressTest = requestData.includeStressTest || false;
      } else if (requestData.portfolioData && requestData.portfolioData.portfolioId) {
        portfolioData = requestData.portfolioData;
        marketData = requestData.marketData || {};
        includeStressTest = requestData.includeStressTest || false;
      } else {
        const body = ApiResponseFactory.error(
          'Portfolio data with portfolioId is required',
          'INVALID_REQUEST'
        );
        return new Response(JSON.stringify(body), { status: 400 });
      }

      // Perform comprehensive risk assessment
      const assessment = await this.riskEngine.performRiskAssessment(portfolioData, marketData);

      const analytics = {
        portfolioId: portfolioData.portfolioId,
        assessmentDate: assessment.assessmentDate,
        overallRisk: {
          score: assessment.overallRiskScore,
          level: assessment.riskLevel,
          trend: 'STABLE' // Would calculate from historical data
        },
        riskBreakdown: assessment.categoryBreakdown,
        keyMetrics: {
          var95: assessment.categoryBreakdown.marketRisk?.metrics?.var95 || 0,
          cvar95: assessment.categoryBreakdown.marketRisk?.metrics?.cvar95 || 0,
          portfolioBeta: assessment.categoryBreakdown.marketRisk?.metrics?.portfolioBeta || 1.0,
          maxConcentration: assessment.categoryBreakdown.concentrationRisk?.metrics?.maxSingleAssetWeight || 0,
          liquidityRatio: assessment.categoryBreakdown.liquidityRisk?.metrics?.liquidityRatio || 0
        },
        alerts: assessment.alerts,
        recommendations: assessment.recommendations
      };

      // Include stress test if requested
      if (includeStressTest) {
        const stressTest = await this.riskEngine.performAdvancedStressTest(portfolioData, []);
        analytics.stressTest = {
          worstCaseLoss: stressTest.aggregateResults.worstCaseLoss,
          averageLoss: stressTest.aggregateResults.averageLoss,
          scenarios: Object.keys(stressTest.scenarios).length
        };
      }

      const body = ApiResponseFactory.success({
        analytics,
        summary: {
          riskLevel: analytics.overallRisk.level.label,
          alertsCount: analytics.alerts.length,
          recommendationsCount: analytics.recommendations.length
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Risk analytics failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'RISK_ANALYTICS_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }

  /**
   * Handle risk health check
   * GET /api/v1/risk/health
   */
  async handleRiskHealthCheck(request) {
    try {
      const body = ApiResponseFactory.success({
        status: 'healthy',
        services: {
          riskEngine: 'operational',
          complianceEngine: 'operational',
          stressTesting: 'operational'
        },
        version: '2.0-Phase2D',
        capabilities: {
          riskAssessment: true,
          stressTesting: true,
          complianceChecking: true,
          regulatoryReporting: true
        }
      });

      return new Response(JSON.stringify(body), { status: 200 });

    } catch (error: unknown) {
      console.error('Risk health check failed:', error);
      const body = ApiResponseFactory.error(
        error.message,
        'HEALTH_CHECK_FAILED'
      );
      return new Response(JSON.stringify(body), { status: 500 });
    }
  }
}

/**
 * Main risk management request router
 */
export async function handleRiskManagementRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1', ''); // Remove /api/v1 prefix

  const handler = new RiskManagementRoutesHandler(env);

  // Route to appropriate handler
  if (path === '/risk/assessment' && request.method === 'POST') {
    return await handler.handleRiskAssessment(request);
  }

  if (path === '/risk/market' && request.method === 'POST') {
    return await handler.handleMarketRiskAssessment(request);
  }

  if (path === '/risk/concentration' && request.method === 'POST') {
    return await handler.handleConcentrationRiskAssessment(request);
  }

  if (path === '/risk/liquidity' && request.method === 'POST') {
    return await handler.handleLiquidityRiskAssessment(request);
  }

  if (path === '/risk/stress-test' && request.method === 'POST') {
    return await handler.handleStressTest(request);
  }

  if (path === '/risk/compliance' && request.method === 'POST') {
    return await handler.handleComplianceAssessment(request);
  }

  if (path === '/risk/regulatory-report' && request.method === 'POST') {
    return await handler.handleRegulatoryReport(request);
  }

  if (path === '/risk/limits' && request.method === 'POST') {
    return await handler.handleRiskLimitsCheck(request);
  }

  if (path === '/risk/analytics' && request.method === 'POST') {
    return await handler.handleRiskAnalytics(request);
  }

  if (path === '/risk/health' && request.method === 'GET') {
    return await handler.handleRiskHealthCheck(request);
  }

  // Not found
  const body = ApiResponseFactory.error(
    `Risk endpoint ${path} not found`,
    'ENDPOINT_NOT_FOUND'
  );
  return new Response(JSON.stringify(body), { status: 404 });
}