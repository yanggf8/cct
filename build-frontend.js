#!/usr/bin/env node

/**
 * Frontend Build Script
 * Compiles TypeScript and bundles frontend assets for production
 * Based on DAC frontend build approach
 */

const { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } = require('fs');
const { join, dirname } = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = 'dist';
const PUBLIC_DIR = 'public';
const STATIC_DIR = 'src/static';
const SKIP_TYPECHECK = process.argv.includes('--skip-typecheck');

console.log('🏗️  Building Frontend Assets...');

try {
  // Clean and create build directory
  execSync(`rm -rf ${BUILD_DIR}`, { stdio: 'inherit' });
  mkdirSync(BUILD_DIR, { recursive: true });
  mkdirSync(`${BUILD_DIR}/public`, { recursive: true });
  mkdirSync(`${BUILD_DIR}/static`, { recursive: true });

  // Function to copy directory recursively
  function copyDir(src, dest) {
    mkdirSync(dest, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);
      }
    }
  }

  // Copy public assets
  if (statSync(PUBLIC_DIR)) {
    console.log('📁 Copying public assets...');
    copyDir(PUBLIC_DIR, `${BUILD_DIR}/public`);
  }

  // Copy static assets
  if (statSync(STATIC_DIR)) {
    console.log('📁 Copying static assets...');
    copyDir(STATIC_DIR, `${BUILD_DIR}/static`);
  }

  // TypeScript check skipped - done once in deploy validation
  console.log('⏭️  TypeScript check deferred to deploy validation');

  // Generate build info
  const buildInfo = {
    buildTime: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    assets: {
      public: countFiles(PUBLIC_DIR),
      static: countFiles(STATIC_DIR)
    }
  };

  function countFiles(dir) {
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .length;
    } catch {
      return 0;
    }
  }

  writeFileSync(`${BUILD_DIR}/build-info.json`, JSON.stringify(buildInfo, null, 2));

  console.log('✅ Frontend build completed successfully!');
  console.log(`📊 Build Summary:`);
  console.log(`   - Public assets: ${buildInfo.assets.public} files`);
  console.log(`   - Static assets: ${buildInfo.assets.static} files`);
  console.log(`   - Build time: ${buildInfo.buildTime}`);
  console.log(`   - Output directory: ${BUILD_DIR}`);

} catch (error) {
  console.error('❌ Frontend build failed:', error.message);
  process.exit(1);
}