#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix common TypeScript errors
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix logger.error calls with unknown error types
  const errorLogPattern = /logger\.(error|warn|info)\([^,]+,\s*error\s*\)/g;
  if (errorLogPattern.test(content)) {
    content = content.replace(errorLogPattern, (match) => {
      return match.replace('error)', '{ error: error instanceof Error ? error.message : String(error) })');
    });
    changed = true;
  }

  // Fix TTL_CONFIG import type usage
  if (content.includes("TTL_CONFIG' cannot be used as a value")) {
    content = content.replace(/import type \{ TTL_CONFIG \}/g, 'import { TTL_CONFIG }');
    changed = true;
  }

  // Fix .ts extension imports
  content = content.replace(/from ['"]([^'"]+)\.ts['"]/g, "from '$1.js'");
  if (content.includes('.ts')) changed = true;

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Process all TypeScript files
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.ts')) {
      try {
        fixFile(fullPath);
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error.message);
      }
    }
  }
}

processDirectory('./src');
console.log('TypeScript error fixes completed');
