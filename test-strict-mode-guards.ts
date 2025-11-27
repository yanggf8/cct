/**
 * Strict Mode Guardrail Tests
 *
 * Regression tests to ensure strict mode always prevents mock data usage in production
 * Validates that no future changes can bypass production protections
 *
 * @author Sprint 1-B - Macro/FRED Strict Mode Implementation
 * @since 2025-01-XX
 */

import { createProductionGuards } from '../src/modules/production-guards.js';

// Production environment constants
const PRODUCTION_ENV = {
  ENVIRONMENT: 'production',
  // Mock production env for testing without real deployment
  VERSION: '1.0.0'
} as any;

const DEVELOPMENT_ENV = {
  ENVIRONMENT: 'development',
  VERSION: '1.0.0-dev'
} as any;

/**
 * Guardrail: Ensure strict mode prevents all mock data paths
 */
async function testGuardrail_StrictModePreventsMockData() {
  console.log('🛡️  Guardrail Test: Strict Mode Prevents All Mock Data');

  const productionGuards = createProductionGuards({
    strictMode: true,
    environment: PRODUCTION_ENV,
    failOnMock: true
  });

  const mockScenarios = [
    { name: 'Direct mock data', data: { mock: true, values: [1, 2, 3] } },
    { name: 'Coming soon message', data: { message: 'coming soon' } },
    { name: 'Placeholder text', data: { text: 'PLACEHOLDER' } },
    { name: 'Test data', data: { testData: true, sample: 'sample' } },
    { name: 'Demo data', data: { demo: true, example: 'example' } },
    { name: 'Synthetic data', data: { synthetic: true, generated: 'generated' } },
    { name: 'Fake API response', data: { fake: true, artificial: true } },
    { name: 'Development mode', data: { environment: 'development', mode: 'dev' } },
    { name: 'Empty data', data: {} },
    { name: 'Null data', data: null },
    { name: 'Undefined data', data: undefined }
  ];

  let allTestsPassed = true;

  for (const scenario of mockScenarios) {
    try {
      console.log(`  Testing: ${scenario.name}`);

      const verification = productionGuards.verifyApiResponse(scenario.data, 'guardrail-test');

      if (verification.isReal) {
        console.log(`    ❌ FAILED: Mock data incorrectly accepted as real`);
        console.log(`    Flags: ${JSON.stringify(verification.flags)}`);
        allTestsPassed = false;
      } else {
        console.log(`    ✅ PASSED: Mock data correctly rejected`);
      }
    } catch (error) {
      // Expected behavior - should throw on mock data in strict mode
      if (error instanceof Error && error.message.includes('Production strict mode')) {
        console.log(`    ✅ PASSED: Mock data correctly rejected with error`);
      } else {
        console.log(`    ❌ UNEXPECTED: Wrong error type: ${error}`);
        allTestsPassed = false;
      }
    }
  }

  return allTestsPassed;
}

/**
 * Guardrail: Ensure real data passes strict mode verification
 */
async function testGuardrail_RealDataPassesStrictMode() {
  console.log('✅ Guardrail Test: Real Data Passes Strict Mode');

  const productionGuards = createProductionGuards({
    strictMode: true,
    environment: PRODUCTION_ENV,
    failOnMock: true
  });

  const realDataScenarios = [
    {
      name: 'FRED economic data',
      data: {
        fedFundsRate: 4.75,
        unemploymentRate: 3.9,
        inflationRate: 2.1,
        gdpGrowthRate: 2.3,
        consumerConfidence: 85.2,
        metadata: {
          source: 'FRED',
          confidence: 0.98,
          lastUpdated: new Date().toISOString(),
          dataQuality: 'high'
        }
      }
    },
    {
      name: 'Market structure data',
      data: {
        vix: 18.5,
        usDollarIndex: 104.2,
        spy: 4521.8,
        yield10Y: 4.25,
        yield2Y: 4.65,
        liborRate: 4.5, // Real SOFR
        metadata: {
          source: 'Yahoo Finance + FRED',
          confidence: 0.95,
          lastUpdated: new Date().toISOString()
        }
      }
    },
    {
      name: 'Correlation analysis data',
      data: {
        symbols: ['AAPL', 'MSFT', 'GOOGL'],
        correlationMatrix: {
          'AAPL-MSFT': 0.85,
          'AAPL-GOOG': 0.73,
          'MSFT-GOOG': 0.91
        },
        metadata: {
          source: 'Market Data Analysis',
          confidence: 0.88,
          period: '30 days'
        }
      }
    }
  ];

  let allTestsPassed = true;

  for (const scenario of realDataScenarios) {
    try {
      console.log(`  Testing: ${scenario.name}`);

      const verification = productionGuards.verifyApiResponse(scenario.data, 'guardrail-test');

      if (verification.isReal && verification.confidence > 0.8) {
        console.log(`    ✅ PASSED: Real data accepted with ${verification.confidence.toFixed(2)} confidence`);
        console.log(`    Source: ${verification.source}`);
      } else {
        console.log(`    ❌ FAILED: Real data rejected or low confidence`);
        console.log(`    Real: ${verification.isReal}, Confidence: ${verification.confidence}`);
        if (verification.flags.length > 0) {
          console.log(`    Flags: ${JSON.stringify(verification.flags)}`);
        }
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`    ❌ UNEXPECTED: Real data verification failed: ${error}`);
      allTestsPassed = false;
    }
  }

  return allTestsPassed;
}

/**
 * Guardrail: Ensure environment-specific behavior
 */
async function testGuardrail_EnvironmentSpecificBehavior() {
  console.log('🌍 Guardrail Test: Environment-Specific Behavior');

  // Test production environment
  console.log('  Testing production environment...');
  const prodGuards = createProductionGuards({
    strictMode: true,
    environment: PRODUCTION_ENV,
    failOnMock: true
  });

  const prodConfig = prodGuards.getConfiguration();
  console.log(`    Production - Strict: ${prodConfig.strictMode}, FailOnMock: ${prodConfig.failOnMock}`);

  if (!prodConfig.isProduction) {
    console.log('    ❌ FAILED: Production environment not detected');
    return false;
  }

  // Test development environment
  console.log('  Testing development environment...');
  const devGuards = createProductionGuards({
    strictMode: false,
    environment: DEVELOPMENT_ENV,
    failOnMock: false
  });

  const devConfig = devGuards.getConfiguration();
  console.log(`    Development - Strict: ${devConfig.strictMode}, FailOnMock: ${devConfig.failOnMock}, AllowsMock: ${devGuards.allowsMockData()}`);

  if (devConfig.isProduction) {
    console.log('    ❌ FAILED: Development environment incorrectly detected as production');
    return false;
  }

  console.log('    ✅ PASSED: Environment-specific behavior correct');
  return true;
}

/**
 * Run all guardrail tests
 */
export async function runStrictModeGuardrailTests() {
  console.log('🛡️ Running Strict Mode Guardrail Test Suite');
  console.log('==========================================\n');

  const results = {
    mockPrevention: await testGuardrail_StrictModePreventsMockData(),
    realDataApproval: await testGuardrail_RealDataPassesStrictMode(),
    environmentBehavior: await testGuardrail_EnvironmentSpecificBehavior()
  };

  console.log('\nGuardrail Test Results:');
  console.log(`  Mock Data Prevention: ${results.mockPrevention ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Real Data Approval: ${results.realDataApproval ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Environment Behavior: ${results.environmentBehavior ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(result => result);

  console.log(`\n${allPassed ? '✅' : '❌'} Overall Guardrail Result: ${allPassed ? 'PASSED' : 'FAILED'}`);

  if (allPassed) {
    console.log('\n🎯 All strict mode protections verified and operational');
    console.log('🚀 Production environment is secure against mock data leakage');
  } else {
    console.log('\n⚠️  Guardrail violations detected - immediate action required');
    console.log('❌ Deploy to production is NOT recommended until issues are resolved');
  }

  return allPassed;
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runStrictModeGuardrailTests().catch(console.error);
}

export default {
  runStrictModeGuardrailTests
};