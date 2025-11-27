#!/usr/bin/env node

/**
 * Backend Build Script
 * Compiles TypeScript and prepares backend for Cloudflare Workers deployment
 * Based on DAC backend build approach
 */

const { execSync } = require('child_process');

console.log('🏗️  Building Backend...');

try {
  // Run TypeScript compilation check
  console.log('🔍 Running TypeScript compilation check...');
  execSync('npx tsc --noEmit', {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('✅ TypeScript compilation successful');

  // Generate deployment metadata
  const buildInfo = {
    buildTime: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    nodeVersion: process.version,
    platform: process.platform
  };

  // Write build info to dist directory
  const fs = require('fs');
  try {
    fs.mkdirSync('dist', { recursive: true });
    fs.writeFileSync(
      'dist/deployment-info.json',
      JSON.stringify(buildInfo, null, 2)
    );
  } catch (error) {
    console.warn('Warning: Could not write deployment info:', error.message);
  }

  console.log('✅ Backend build completed successfully!');
  console.log('📊 Build Summary:');
  console.log(`   - Build time: ${buildInfo.buildTime}`);
  console.log(`   - Node version: ${buildInfo.nodeVersion}`);
  console.log(`   - Platform: ${buildInfo.platform}`);

} catch (error) {
  console.error('❌ Backend build failed:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout);
  if (error.stderr) console.log('STDERR:', error.stderr);
  process.exit(1);
}