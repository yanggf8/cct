/**
 * Production Guards Status Routes
 *
 * Provides endpoints to monitor and verify production guards configuration
 * Supports operational monitoring and health checks for strict mode
 *
 * @author Sprint 1-B - Macro/FRED Strict Mode Implementation
 * @since 2025-01-XX
 */
import { createLogger } from '../modules/logging.js';
import { createProductionGuards } from '../modules/production-guards.js';
const logger = createLogger('production-guards-routes');
/**
 * Get production guards configuration status
 */
export async function handleProductionGuardsStatus(request, env) {
    try {
        const isProduction = env.ENVIRONMENT === 'production';
        const strictModeEnabled = true; // Default to true for production
        const productionGuards = createProductionGuards({
            strictMode: strictModeEnabled,
            environment: env,
            failOnMock: isProduction
        });
        const configuration = productionGuards.getConfiguration();
        const capabilities = {
            mockDetection: true,
            dataVerification: true,
            qualityChecks: true,
            runtimeMonitoring: true
        };
        const statusData = {
            status: 'operational',
            environment: env.ENVIRONMENT,
            strictMode: configuration.strictMode,
            productionMode: configuration.isProduction,
            allowsMockData: productionGuards.allowsMockData(),
            failOnMock: configuration.failOnMock,
            allowedMockSources: configuration.allowedMockSources,
            capabilities,
            lastVerified: new Date().toISOString(),
            version: '1.0.0',
            sprint: '1-B',
            // Security: Redact sensitive configuration details
            // Note: API keys and tokens are never exposed in responses
            redactedFields: ['FRED_API_KEY', 'X_API_KEY', 'internal_tokens']
        };
        return new Response(JSON.stringify({
            success: true,
            data: statusData
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
    }
    catch (error) {
        logger.error('Failed to get production guards status:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Production guards status check failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
/**
 * Validate production guards configuration
 */
export async function handleProductionGuardsValidate(request, env) {
    try {
        const isProduction = env.ENVIRONMENT === 'production';
        if (!isProduction) {
            return new Response(JSON.stringify({
                success: true,
                message: 'Validation skipped - not in production environment',
                environment: env.ENVIRONMENT,
                recommendation: 'Set ENVIRONMENT=production for production validation'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        const productionGuards = createProductionGuards({
            strictMode: true,
            environment: env,
            failOnMock: true
        });
        // Test various validation scenarios
        const validationResults = {
            configurationCheck: testConfiguration(productionGuards),
            mockDetectionTest: testMockDetection(productionGuards),
            realDataTest: testRealData(productionGuards),
            environmentValidation: validateEnvironment(env)
        };
        const allPassed = Object.values(validationResults).every(result => result.passed);
        const validationResult = {
            overall: allPassed ? 'passed' : 'failed',
            results: validationResults,
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT
        };
        return new Response(JSON.stringify({
            success: allPassed,
            data: validationResult
        }), {
            status: allPassed ? 200 : 400,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    }
    catch (error) {
        logger.error('Production guards validation failed:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Production guards validation failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
/**
 * Test configuration setup
 */
function testConfiguration(productionGuards) {
    try {
        const config = productionGuards.getConfiguration();
        if (!config.strictMode) {
            return { passed: false, details: 'Strict mode not enabled' };
        }
        if (!config.failOnMock) {
            return { passed: false, details: 'Fail-on-mock not enabled' };
        }
        if (!config.isProduction) {
            return { passed: false, details: 'Production mode not detected' };
        }
        return { passed: true, details: 'Configuration valid' };
    }
    catch (error) {
        return { passed: false, details: `Configuration error: ${error}` };
    }
}
/**
 * Test mock detection functionality
 */
function testMockDetection(productionGuards) {
    try {
        // Test with obvious mock data
        const mockData = { message: 'coming soon', mock: true };
        const verification = productionGuards.verifyApiResponse(mockData, 'validation-test');
        if (verification.isReal) {
            return { passed: false, details: 'Mock detection failed - accepted mock data' };
        }
        if (!verification.flags || verification.flags.length === 0) {
            return { passed: false, details: 'Mock detection failed - no flags raised' };
        }
        return { passed: true, details: `Mock detection working - flags: ${verification.flags.join(', ')}` };
    }
    catch (error) {
        return { passed: false, details: `Mock detection error: ${error}` };
    }
}
/**
 * Test real data acceptance
 */
function testRealData(productionGuards) {
    try {
        // Test with legitimate data
        const realData = {
            timestamp: new Date().toISOString(),
            fedFundsRate: 4.5,
            metadata: {
                source: 'FRED',
                confidence: 0.95,
                lastUpdated: new Date().toISOString()
            }
        };
        const verification = productionGuards.verifyApiResponse(realData, 'validation-test');
        if (!verification.isReal) {
            return { passed: false, details: 'Real data rejected - confidence too low' };
        }
        if (verification.confidence < 0.8) {
            return { passed: false, details: `Real data confidence too low: ${verification.confidence}` };
        }
        return { passed: true, details: `Real data accepted - confidence: ${verification.confidence}` };
    }
    catch (error) {
        return { passed: false, details: `Real data test error: ${error}` };
    }
}
/**
 * Validate environment setup
 */
function validateEnvironment(env) {
    try {
        if (!env) {
            return { passed: false, details: 'No environment provided' };
        }
        const environment = env.ENVIRONMENT;
        if (typeof environment !== 'string') {
            return { passed: false, details: 'ENVIRONMENT must be a string' };
        }
        if (environment === 'development') {
            return { passed: true, details: 'Development environment - valid for testing' };
        }
        if (environment === 'production') {
            return { passed: true, details: 'Production environment - valid for strict mode' };
        }
        return { passed: false, details: `Unknown environment: ${environment}` };
    }
    catch (error) {
        return { passed: false, details: `Environment validation error: ${error}` };
    }
}
/**
 * Health check for production guards
 */
export async function handleProductionGuardsHealthCheck(request, env) {
    try {
        const isProduction = env.ENVIRONMENT === 'production';
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT,
            strictModeActive: isProduction,
            mockDetectionActive: true,
            dataVerificationActive: true,
            ready: true
        };
        return new Response(JSON.stringify({
            success: true,
            data: healthData
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'max-age=10'
            }
        });
    }
    catch (error) {
        return new Response(JSON.stringify({
            success: false,
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
//# sourceMappingURL=production-guards-routes.js.map