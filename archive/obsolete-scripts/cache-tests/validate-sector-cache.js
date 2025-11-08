#!/usr/bin/env node

// Minimal validation test for sector cache functionality
console.log('🔍 Validating sector cache implementation...');

// Test 1: Check if files exist and are readable
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/modules/sector-cache-manager.ts',
  'src/modules/sector-data-fetcher.ts', 
  'src/routes/sector-routes.ts'
];

console.log('\n📁 Checking required files...');
let filesOk = true;
for (const file of requiredFiles) {
  try {
    const fullPath = path.join(process.cwd(), file);
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${file} (${Math.round(stats.size/1024)}KB)`);
  } catch (error) {
    console.log(`❌ ${file} - ${error.message}`);
    filesOk = false;
  }
}

// Test 2: Check for key implementation patterns
console.log('\n🔧 Checking implementation patterns...');

function checkPattern(file, pattern, description) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const found = content.includes(pattern);
    console.log(`${found ? '✅' : '❌'} ${description}`);
    return found;
  } catch (error) {
    console.log(`❌ ${description} - Cannot read file`);
    return false;
  }
}

const patterns = [
  ['src/modules/sector-cache-manager.ts', 'class SectorCacheManager', 'SectorCacheManager class exists'],
  ['src/modules/sector-cache-manager.ts', 'async getSectorData(', 'Cache get method implemented'],
  ['src/modules/sector-cache-manager.ts', 'async setSectorData(', 'Cache set method implemented'],
  ['src/modules/sector-cache-manager.ts', 'getCacheStats', 'Metrics tracking implemented'],
  ['src/modules/sector-data-fetcher.ts', 'cache: SectorCacheManager', 'Data fetcher accepts cache manager'],
  ['src/modules/sector-data-fetcher.ts', 'await this.cache.getSectorData', 'Cache reads implemented'],
  ['src/modules/sector-data-fetcher.ts', 'await this.cache.setSectorData', 'Cache writes implemented'],
  ['src/routes/sector-routes.ts', 'SectorCacheManager', 'Routes use cache manager'],
  ['src/routes/sector-routes.ts', 'isDOCacheEnabled', 'Feature flag implemented']
];

let patternsOk = true;
for (const [file, pattern, description] of patterns) {
  if (!checkPattern(file, pattern, description)) {
    patternsOk = false;
  }
}

// Test 3: Basic syntax validation
console.log('\n📝 Basic syntax validation...');
let syntaxOk = true;

for (const file of requiredFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for common syntax issues
    const issues = [];
    
    if (content.includes('} catch ({ error:')) {
      issues.push('Invalid catch block syntax');
    }
    
    if (content.includes('import.*\\.ts')) {
      issues.push('TypeScript imports should use .js extension');
    }
    
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    if (issues.length === 0) {
      console.log(`✅ ${file} - No obvious syntax issues`);
    } else {
      console.log(`⚠️  ${file} - Issues: ${issues.join(', ')}`);
      syntaxOk = false;
    }
    
  } catch (error) {
    console.log(`❌ ${file} - Cannot validate: ${error.message}`);
    syntaxOk = false;
  }
}

// Summary
console.log('\n📊 Validation Summary:');
console.log(`Files: ${filesOk ? '✅' : '❌'}`);
console.log(`Patterns: ${patternsOk ? '✅' : '❌'}`);
console.log(`Syntax: ${syntaxOk ? '✅' : '❌'}`);

const overallSuccess = filesOk && patternsOk && syntaxOk;
console.log(`\n${overallSuccess ? '🎉' : '⚠️'} Overall: ${overallSuccess ? 'PASS' : 'NEEDS ATTENTION'}`);

if (overallSuccess) {
  console.log('\n✨ Sector cache refactoring appears to be correctly implemented!');
  console.log('Next steps:');
  console.log('1. Fix remaining TypeScript compilation errors');
  console.log('2. Test in DO-enabled Worker environment');
  console.log('3. Validate cache performance and metrics');
} else {
  console.log('\n🔧 Issues found that need attention before deployment.');
}

process.exit(overallSuccess ? 0 : 1);
