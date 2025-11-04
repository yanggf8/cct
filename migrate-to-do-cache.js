#!/usr/bin/env node

/**
 * Migration script to replace legacy cache implementations with DO cache
 * Automatically updates imports and instantiations across the codebase
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Migration mappings
const migrations = [
  // Cache Manager replacements
  {
    from: "import { createCacheManager, type CacheManager } from './cache-manager.js';",
    to: "import { createDOCacheAdapter, type DOCacheAdapter } from './do-cache-adapter.js';"
  },
  {
    from: "import { CacheManager } from './cache-manager.js';",
    to: "import { DOCacheAdapter } from './do-cache-adapter.js';"
  },
  {
    from: "createCacheManager(",
    to: "createDOCacheAdapter("
  },
  {
    from: "new CacheManager(",
    to: "new DOCacheAdapter("
  },
  {
    from: ": CacheManager",
    to: ": DOCacheAdapter"
  },

  // Sector Cache Manager replacements
  {
    from: "import { SectorCacheManager } from './sector-cache-manager.js';",
    to: "import { DOSectorCacheAdapter } from './do-cache-adapter.js';"
  },
  {
    from: "new SectorCacheManager(",
    to: "new DOSectorCacheAdapter("
  },
  {
    from: ": SectorCacheManager",
    to: ": DOSectorCacheAdapter"
  },

  // Market Drivers Cache Manager replacements
  {
    from: "import { MarketDriversCacheManager } from './market-drivers-cache-manager.js';",
    to: "import { DOMarketDriversCacheAdapter } from './do-cache-adapter.js';"
  },
  {
    from: "new MarketDriversCacheManager(",
    to: "new DOMarketDriversCacheAdapter("
  },
  {
    from: ": MarketDriversCacheManager",
    to: ": DOMarketDriversCacheAdapter"
  },

  // Backtesting Cache Manager replacements
  {
    from: "import { BacktestingCacheManager } from './backtesting-cache.js';",
    to: "import { DOBacktestingCacheAdapter } from './do-cache-adapter.js';"
  },
  {
    from: "new BacktestingCacheManager(",
    to: "new DOBacktestingCacheAdapter("
  },
  {
    from: ": BacktestingCacheManager",
    to: ": DOBacktestingCacheAdapter"
  }
];

/**
 * Process a single file
 */
function processFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) {
    return false;
  }

  // Skip the adapter file itself and some specific files
  const fileName = path.basename(filePath);
  if (fileName === 'do-cache-adapter.ts' || 
      fileName === 'cache-manager.ts' ||
      fileName === 'dual-cache-do.ts' ||
      fileName === 'cache-durable-object.ts') {
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Apply migrations
  for (const migration of migrations) {
    if (content.includes(migration.from)) {
      content = content.replace(new RegExp(escapeRegExp(migration.from), 'g'), migration.to);
      modified = true;
      console.log(`✓ Updated ${filePath}: ${migration.from} → ${migration.to}`);
    }
  }

  // Write back if modified
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recursively process directory
 */
function processDirectory(dir) {
  const entries = fs.readdirSync(dir);
  let totalModified = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      totalModified += processDirectory(fullPath);
    } else if (stat.isFile()) {
      if (processFile(fullPath)) {
        totalModified++;
      }
    }
  }

  return totalModified;
}

/**
 * Main migration function
 */
function main() {
  console.log('🚀 Starting DO Cache Migration...\n');

  if (!fs.existsSync(srcDir)) {
    console.error('❌ Source directory not found:', srcDir);
    process.exit(1);
  }

  const modifiedFiles = processDirectory(srcDir);

  console.log(`\n✅ Migration complete!`);
  console.log(`📊 Modified ${modifiedFiles} files`);
  
  if (modifiedFiles > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Review the changes with: git diff');
    console.log('2. Test the application: npm run dev');
    console.log('3. Deploy if tests pass: npm run deploy');
    console.log('4. Enable DO cache: wrangler secret put FEATURE_FLAG_DO_CACHE "true"');
  } else {
    console.log('\n💡 No files needed migration - already using DO cache or no legacy cache usage found');
  }
}

// Run migration
if (require.main === module) {
  main();
}

module.exports = { processFile, processDirectory, migrations };
