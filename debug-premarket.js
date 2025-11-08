#!/usr/bin/env node

/**
 * Debug script to test pre-market data bridge step by step
 */

console.log('🔍 Debugging Pre-Market Data Bridge...\n');

// Test 1: Check if generation endpoint is actually creating data
console.log('1. Testing generation endpoint...');
const generationCommand = `curl -s -X POST -H "X-API-KEY: test" -H "Content-Type: application/json" -d '{"symbols": ["AAPL"]}' "https://tft-trading-system.yanggf.workers.dev/api/v1/reports/pre-market/generate"`;
console.log(`Command: ${generationCommand}`);
console.log('Expected: Should return symbols_analyzed > 0 if working\n');

// Test 2: Check individual sentiment analysis
console.log('2. Testing individual sentiment analysis...');
const sentimentCommand = `curl -s -H "X-API-KEY: test" "https://tft-trading-system.yanggf.workers.dev/api/v1/sentiment/symbols/AAPL"`;
console.log(`Command: ${sentimentCommand}`);
console.log('Expected: Should return sentiment data with confidence\n');

// Test 3: Check if retrieval endpoint finds data after generation
console.log('3. Testing retrieval endpoint...');
const retrievalCommand = `curl -s -H "X-API-KEY: test" "https://tft-trading-system.yanggf.workers.dev/api/v1/reports/pre-market"`;
console.log(`Command: ${retrievalCommand}`);
console.log('Expected: Should return pre-market briefing data\n');

console.log('🔧 To execute these tests, run:');
console.log(`# Test 1: Generation`);
console.log(generationCommand);
console.log(`\n# Test 2: Sentiment`);
console.log(sentimentCommand);
console.log(`\n# Test 3: Retrieval`);
console.log(retrievalCommand);

console.log('\n🎯 Debug Analysis:');
console.log('- If Test 1 shows symbols_analyzed: 0, data bridge generation is failing');
console.log('- If Test 2 fails, sentiment analysis has issues');
console.log('- If Test 3 returns "Data not found" after Test 1 succeeds, storage/retrieval is broken');
console.log('- If Test 3 returns cached error, cache invalidation is needed');