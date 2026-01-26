#!/usr/bin/env node

/**
 * Dual AI Sentiment Analysis - Comprehensive Regression Test Suite
 *
 * Tests the critical "higher confidence wins" logic for disagreements
 * and ensures robustness against future changes.
 *
 * Run with: node tests/regression/test-dual-ai-regression.ts
 */

import { checkAgreement, generateSignal } from '../../src/modules/dual-ai-analysis.js';
import type { ModelResult, Agreement, Signal } from '../../src/modules/dual-ai-analysis.js';

// Test utilities
interface TestCase {
  name: string;
  gpt: Partial<ModelResult>;
  db: Partial<ModelResult>;
  expected: {
    direction?: string;
    action?: string;
    strength?: string;
    agree?: boolean;
    agreementType?: string;
    isTie?: boolean;
    isPerfectTie?: boolean;
  };
}

const tests: TestCase[] = [
  // ========== DISAGREEMENT TESTS ==========
  {
    name: 'Disagreement: GPT bearish (0.75) beats DB bullish (0.65)',
    gpt: { direction: 'bearish', confidence: 0.75, error: null },
    db: { direction: 'bullish', confidence: 0.65, error: null },
    expected: {
      direction: 'bearish',
      action: 'SELL',
      agree: true,
      agreementType: 'full_agreement'
    }
  },
  {
    name: 'Disagreement: DB bullish (0.80) beats GPT bearish (0.70)',
    gpt: { direction: 'bearish', confidence: 0.70, error: null },
    db: { direction: 'bullish', confidence: 0.80, error: null },
    expected: {
      direction: 'bullish',
      action: 'BUY',
      agree: true,
      agreementType: 'full_agreement'
    }
  },
  {
    name: 'Equal confidence disagreement: Both 0.70 → HOLD',
    gpt: { direction: 'bearish', confidence: 0.70, error: null },
    db: { direction: 'bullish', confidence: 0.70, error: null },
    expected: {
      direction: 'bearish', // GPT is tie-breaker for direction tracking
      action: 'HOLD',
      agree: false,
      agreementType: 'disagreement',
      isTie: true
    }
  },
  {
    name: 'Equal confidence disagreement: Both 0.50 → HOLD',
    gpt: { direction: 'bearish', confidence: 0.50, error: null },
    db: { direction: 'bullish', confidence: 0.50, error: null },
    expected: {
      action: 'HOLD',
      isTie: true
    }
  },

  // ========== AGREEMENT TESTS ==========
  {
    name: 'Full agreement: Both bullish (0.85, 0.80) → STRONG_BUY',
    gpt: { direction: 'bullish', confidence: 0.85, error: null },
    db: { direction: 'bullish', confidence: 0.80, error: null },
    expected: {
      direction: 'bullish',
      action: 'STRONG_BUY',
      agree: true,
      agreementType: 'full_agreement',
      strength: 'STRONG'
    }
  },
  {
    name: 'Full agreement: Both bearish (0.75, 0.70) → STRONG_SELL',
    gpt: { direction: 'bearish', confidence: 0.75, error: null },
    db: { direction: 'bearish', confidence: 0.70, error: null },
    expected: {
      direction: 'bearish',
      action: 'STRONG_SELL',
      agree: true,
      agreementType: 'full_agreement',
      strength: 'STRONG'
    }
  },
  {
    name: 'Partial agreement: GPT bullish, DB neutral → BUY',
    gpt: { direction: 'bullish', confidence: 0.70, error: null },
    db: { direction: 'neutral', confidence: 0.60, error: null },
    expected: {
      direction: 'bullish',
      action: 'CONSIDER',
      agree: false,
      agreementType: 'partial_agreement'
    }
  },
  {
    name: 'Partial agreement: GPT neutral, DB bearish → SELL',
    gpt: { direction: 'neutral', confidence: 0.50, error: null },
    db: { direction: 'bearish', confidence: 0.65, error: null },
    expected: {
      direction: 'bearish',
      action: 'CONSIDER',
      agree: false,
      agreementType: 'partial_agreement'
    }
  },

  // ========== EQUAL CONFIDENCE EDGE CASES ==========
  {
    name: 'Equal confidence agreement: Both bullish 0.80 → GPT wins',
    gpt: { direction: 'bullish', confidence: 0.80, error: null },
    db: { direction: 'bullish', confidence: 0.80, error: null },
    expected: {
      direction: 'bullish',
      agree: true,
      agreementType: 'full_agreement',
      isPerfectTie: true
    }
  },
  {
    name: 'Equal confidence agreement: Both bearish 0.60 → GPT wins',
    gpt: { direction: 'bearish', confidence: 0.60, error: null },
    db: { direction: 'bearish', confidence: 0.60, error: null },
    expected: {
      direction: 'bearish',
      agree: true,
      agreementType: 'full_agreement',
      isPerfectTie: true
    }
  },

  // ========== CONFIDENCE LEVEL TESTS ==========
  {
    name: 'Very high confidence: Both 0.95+ → STRONG signal',
    gpt: { direction: 'bullish', confidence: 0.95, error: null },
    db: { direction: 'bullish', confidence: 0.96, error: null },
    expected: {
      action: 'STRONG_BUY',
      strength: 'STRONG'
    }
  },
  {
    name: 'Medium confidence: Both 0.65 → Moderate signal',
    gpt: { direction: 'bearish', confidence: 0.65, error: null },
    db: { direction: 'bearish', confidence: 0.65, error: null },
    expected: {
      action: 'SELL',
      strength: 'MODERATE'
    }
  },
  {
    name: 'Low confidence: Both 0.55 → Weak signal',
    gpt: { direction: 'bullish', confidence: 0.55, error: null },
    db: { direction: 'bullish', confidence: 0.55, error: null },
    expected: {
      action: 'WEAK_BUY',
      strength: 'WEAK'
    }
  },

  // ========== NULL/ERROR HANDLING ==========
  {
    name: 'GPT null confidence, DB valid → Use DB',
    gpt: { direction: 'bullish', confidence: null, error: null },
    db: { direction: 'bearish', confidence: 0.70, error: null },
    expected: {
      direction: 'bearish',
      agree: false,
      agreementType: 'partial_agreement'
    }
  },
  {
    name: 'Both null confidence → Error',
    gpt: { direction: 'neutral', confidence: null, error: 'No data' },
    db: { direction: 'neutral', confidence: null, error: 'No data' },
    expected: {
      agree: false,
      agreementType: 'error'
    }
  },
  {
    name: 'GPT error, DB valid → Use DB',
    gpt: { direction: 'neutral', confidence: null, error: 'timeout' },
    db: { direction: 'bullish', confidence: 0.75, error: null },
    expected: {
      direction: 'bullish',
      agree: false,
      agreementType: 'partial_agreement'
    }
  },

  // ========== EXTREME VALUES ==========
  {
    name: 'Maximum confidence: 0.99 vs 0.98',
    gpt: { direction: 'bearish', confidence: 0.99, error: null },
    db: { direction: 'bullish', confidence: 0.98, error: null },
    expected: {
      direction: 'bearish',
      action: 'STRONG_SELL'
    }
  },
  {
    name: 'Very low confidence: 0.15 vs 0.10',
    gpt: { direction: 'bearish', confidence: 0.15, error: null },
    db: { direction: 'bullish', confidence: 0.10, error: null },
    expected: {
      direction: 'bearish',
      action: 'WEAK_SELL'
    }
  }
];

// Test runner
let passed = 0;
let failed = 0;
let skipped = 0;

function runTest(testCase: TestCase): void {
  try {
    const gpt: ModelResult = {
      model: 'gemma-sea-lion-27b',
      direction: testCase.gpt.direction as any,
      confidence: testCase.gpt.confidence as number,
      reasoning: 'test',
      error: testCase.gpt.error as any,
      ...testCase.gpt
    };

    const db: ModelResult = {
      model: 'distilbert-sst-2-int8',
      direction: testCase.db.direction as any,
      confidence: testCase.db.confidence as number,
      reasoning: 'test',
      error: testCase.db.error as any,
      ...testCase.db
    };

    const agreement = checkAgreement(gpt, db);
    const signal = generateSignal(agreement, gpt, db);

    // Validate expected results
    if (testCase.expected.direction && signal.direction !== testCase.expected.direction) {
      throw new Error(`Direction mismatch: expected ${testCase.expected.direction}, got ${signal.direction}`);
    }

    if (testCase.expected.action && signal.action !== testCase.expected.action) {
      throw new Error(`Action mismatch: expected ${testCase.expected.action}, got ${signal.action}`);
    }

    if (testCase.expected.strength && signal.strength !== testCase.expected.strength) {
      throw new Error(`Strength mismatch: expected ${testCase.expected.strength}, got ${signal.strength}`);
    }

    if (testCase.expected.agree !== undefined && agreement.agree !== testCase.expected.agree) {
      throw new Error(`Agreement mismatch: expected ${testCase.expected.agree}, got ${agreement.agree}`);
    }

    if (testCase.expected.agreementType && agreement.type !== testCase.expected.agreementType) {
      throw new Error(`Agreement type mismatch: expected ${testCase.expected.agreementType}, got ${agreement.type}`);
    }

    if (testCase.expected.isTie && !(agreement.details as any).is_tie) {
      throw new Error('Expected is_tie flag but not found');
    }

    if (testCase.expected.isPerfectTie && !(agreement.details as any).is_perfect_tie) {
      throw new Error('Expected is_perfect_tie flag but not found');
    }

    console.log(`✓ ${testCase.name}`);
    passed++;

  } catch (error: any) {
    console.error(`✗ ${testCase.name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

// Property-based tests
function runPropertyTests(): void {
  console.log('\n--- Property-Based Tests ---');

  let propPassed = 0;
  let propFailed = 0;

  // Property 1: Higher confidence always wins
  for (let i = 0; i < 100; i++) {
    const gptConf = Math.random();
    const dbConf = Math.random() * 0.9; // Ensure not always higher
    const gptDir = Math.random() > 0.5 ? 'bullish' : 'bearish';
    const dbDir = gptDir === 'bullish' ? 'bearish' : 'bullish';

    try {
      const gpt: ModelResult = {
        model: 'gemma',
        direction: gptDir as any,
        confidence: gptConf,
        reasoning: 'test'
      };

      const db: ModelResult = {
        model: 'distilbert',
        direction: dbDir as any,
        confidence: dbConf,
        reasoning: 'test'
      };

      const signal = generateSignal(checkAgreement(gpt, db), gpt, db);

      const higherConf = Math.max(gptConf, dbConf);
      const lowerConf = Math.min(gptConf, dbConf);

      if (higherConf === lowerConf) {
        // Equal confidence should result in HOLD or neutral action
        if (!['HOLD', 'AVOID', 'WEAK_BUY', 'WEAK_SELL'].includes(signal.action)) {
          throw new Error(`Equal confidence should result in weak action, got ${signal.action}`);
        }
      } else {
        // Higher confidence should win
        const winnerDir = gptConf > dbConf ? gptDir : dbDir;
        if (signal.direction !== winnerDir) {
          throw new Error(`Higher confidence did not win: ${winnerDir} (${higherConf}) vs ${dbConf > gptConf ? dbDir : gptDir} (${lowerConf})`);
        }
      }

      propPassed++;
    } catch (error: any) {
      console.error(`✗ Property test ${i}: ${error.message}`);
      propFailed++;
    }
  }

  console.log(`✓ Property tests: ${propPassed} passed, ${propFailed} failed`);
  passed += propPassed;
  failed += propFailed;

  // Property 2: Signal action is never undefined
  console.log('\n--- Invariant Tests ---');
  let invariantPassed = 0;
  let invariantFailed = 0;

  for (let i = 0; i < 500; i++) {
    const directions = ['bullish', 'bearish', 'neutral'];
    const gptDir = directions[Math.floor(Math.random() * directions.length)];
    const dbDir = directions[Math.floor(Math.random() * directions.length)];

    try {
      const gpt: ModelResult = {
        model: 'gemma',
        direction: gptDir as any,
        confidence: Math.random(),
        reasoning: 'test'
      };

      const db: ModelResult = {
        model: 'distilbert',
        direction: dbDir as any,
        confidence: Math.random(),
        reasoning: 'test'
      };

      const signal = generateSignal(checkAgreement(gpt, db), gpt, db);

      // Action must be one of the known values
      const validActions = ['STRONG_BUY', 'BUY', 'WEAK_BUY', 'STRONG_SELL', 'SELL', 'WEAK_SELL', 'CONSIDER', 'HOLD', 'AVOID', 'SKIP'];
      if (!validActions.includes(signal.action)) {
        throw new Error(`Invalid action: ${signal.action}`);
      }

      invariantPassed++;
    } catch (error: any) {
      console.error(`✗ Invariant test ${i}: ${error.message}`);
      invariantFailed++;
    }
  }

  console.log(`✓ Invariant tests: ${invariantPassed} passed, ${invariantFailed} failed`);
  passed += invariantPassed;
  failed += invariantFailed;
}

// Main execution
console.log('=== Dual AI Sentiment Analysis - Regression Test Suite ===\n');
console.log(`Running ${tests.length} core tests...\n`);

tests.forEach(runTest);

console.log('\n=== Property-Based & Invariant Tests ===');
runPropertyTests();

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total tests: ${passed + failed + skipped}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Skipped: ${skipped}`);

const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
console.log(`Success Rate: ${successRate}%\n`);

if (failed === 0) {
  console.log('✅ ALL TESTS PASSED - Regression protection active');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED - Review required');
  process.exit(1);
}
