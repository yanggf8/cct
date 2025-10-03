# Configuration Management

## Overview

The Dual AI Sentiment Analysis System features a comprehensive centralized configuration system that eliminates hardcoded values scattered across the codebase. All configuration is managed through `src/modules/config.ts` with environment variable integration and fallback defaults.

## Configuration Architecture

### Centralized Configuration Hub

**File**: `src/modules/config.ts`

The configuration system provides:
- **Unified Configuration**: All system settings in one location
- **Environment Integration**: Seamless environment variable support
- **Type Safety**: Proper typing and validation
- **Fallback Defaults**: Sensible defaults for all parameters
- **Hot Reload**: Configuration changes without code deployment

### Configuration Sections

```javascript
export const CONFIG = {
  KV_STORAGE: {
    ANALYSIS_TTL: 604800,           // 7 days for analysis results
    GRANULAR_TTL: 7776000,          // 90 days for granular data
    DAILY_SUMMARY_TTL: 604800,      // 7 days for daily summaries
    STATUS_TTL: 86400,              // 24 hours for status data
    REPORT_CACHE_TTL: 1800,         // 30 minutes for report cache
    METADATA_TTL: 2592000,          // 30 days for metadata
    CONSISTENCY_TIMEOUT_MS: 15000,  // 15 seconds for KV consistency
    CONSISTENCY_RETRY_DELAY_MS: 1000, // 1 second retry delay
    MAX_RETRIES: 3                  // Maximum retry attempts
  },

  MARKET_DATA: {
    CACHE_TTL: 300,                 // 5 minutes for market data cache
    RATE_LIMIT_REQUESTS_PER_MINUTE: 20, // Yahoo Finance rate limit
    YAHOO_FINANCE_BASE_URL: 'https://query1.finance.yahoo.com',
    REQUEST_TIMEOUT_MS: 10000       // 10 seconds timeout
  },

  TRADING: {
    SYMBOLS: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'], // Default symbols
    SIGNAL_CONFIDENCE_THRESHOLD: 0.7, // 70% confidence threshold
    MIN_NEWS_ARTICLES: 3,
    MAX_NEWS_ARTICLES: 10,
    CONFIDENCE_THRESHOLD: 0.6       // General confidence threshold
  },

  AI_MODELS: {
    GPT_MAX_TOKENS: 1000,
    GPT_TEMPERATURE: 0.7,
    MIN_SENTIMENT_ARTICLES: 3,
    MAX_SENTIMENT_ARTICLES: 15
  },

  LOGGING: {
    LEVEL: 'info',
    STRUCTURED: true,
    PERFORMANCE_TRACKING: true
  },

  NETWORK: {
    TIMEOUT_MS: {
      DEFAULT: 5000,
      API_REQUEST: 10000,
      AI_INFERENCE: 30000
    },
    RETRY_COUNT: {
      DEFAULT: 3,
      API_REQUEST: 5,
      KV_OPERATION: 3
    }
  }
};
```

## Environment Variables

### Required Environment Variables

```bash
# Trading Configuration
TRADING_SYMBOLS=AAPL,MSFT,GOOGL,TSLA,NVDA
SIGNAL_CONFIDENCE_THRESHOLD=0.7

# AI Configuration
GPT_MAX_TOKENS=1000
GPT_TEMPERATURE=0.7

# Logging Configuration
LOG_LEVEL=info
STRUCTURED_LOGGING=true

# Storage Configuration
KV_ANALYSIS_TTL=604800
KV_GRANULAR_TTL=7776000
```

### Optional Environment Variables

```bash
# Market Data Configuration
MARKET_DATA_CACHE_TTL=300
YAHOO_FINANCE_RATE_LIMIT=20

# Analysis Configuration
MIN_NEWS_ARTICLES=3
MAX_NEWS_ARTICLES=10
CONFIDENCE_THRESHOLD=0.6

# Performance Configuration
DEFAULT_TIMEOUT_MS=5000
API_REQUEST_TIMEOUT_MS=10000
```

## Configuration Access Patterns

### Basic Configuration Access

```javascript
import { CONFIG, getEnvConfig } from './config.js';

// Access configuration directly
const symbols = CONFIG.TRADING.SYMBOLS;
const threshold = CONFIG.TRADING.SIGNAL_CONFIDENCE_THRESHOLD;

// Access environment-aware configuration
const envConfig = getEnvConfig(env);
const effectiveSymbols = envConfig.TRADING.SYMBOLS;
```

### TTL Management

```javascript
import { KVUtils } from './shared-utilities.js';
import { CONFIG } from './config.js';

// Use centralized TTL configuration
const options = KVUtils.getOptions('analysis'); // Uses CONFIG.KV_STORAGE.ANALYSIS_TTL
await kvStore.put(key, data, options);

// Custom options with centralized defaults
const customOptions = KVUtils.getOptions('analysis', {
  expirationTtl: CONFIG.KV_STORAGE.ANALYSIS_TTL * 2
});
```

### Retry Configuration

```javascript
import { AsyncUtils } from './shared-utilities.js';
import { CONFIG } from './config.js';

// Use centralized retry configuration
const result = await AsyncUtils.retry(async () => {
  return await someOperation();
}, {
  maxRetries: CONFIG.NETWORK.RETRY_COUNT.DEFAULT,
  initialDelay: 1000
});
```

## Configuration Validation

### Environment Validation

```javascript
import { EnvironmentValidation } from './validation-utilities.js';

// Validate environment configuration
const validation = EnvironmentValidation.validateEnvironment(env);
if (!validation.valid) {
  console.error('Configuration validation failed:', validation.errors);
}
```

### Configuration Validation

```javascript
import { ConfigValidation } from './validation-utilities.js';

// Validate specific configuration sections
const tradingConfig = ConfigValidation.validateTradingConfig(CONFIG.TRADING);
const kvConfig = ConfigValidation.validateKVConfig(CONFIG.KV_STORAGE);
```

## Configuration Benefits

### 1. Centralized Management
- **Single Source of Truth**: All configuration in one location
- **Easy Maintenance**: Configuration changes affect entire system
- **Consistent Values**: Eliminates configuration conflicts

### 2. Environment Integration
- **Deployment Flexibility**: Different configurations per environment
- **Security**: Sensitive values in environment variables
- **Hot Updates**: Configuration changes without code deployment

### 3. Type Safety
- **Validation**: Automatic validation of configuration values
- **Type Checking**: Proper typing for all configuration parameters
- **Error Prevention**: Early detection of configuration issues

### 4. Developer Experience
- **IntelliSense**: Full IDE support for configuration options
- **Documentation**: Self-documenting configuration structure
- **Testing**: Easy configuration mocking for tests

## Configuration Examples

### Development Configuration

```javascript
// wrangler.toml (development)
[env.development.vars]
TRADING_SYMBOLS = "AAPL,MSFT,GOOGL"
SIGNAL_CONFIDENCE_THRESHOLD = "0.6"
LOG_LEVEL = "debug"
STRUCTURED_LOGGING = "false"
```

### Production Configuration

```javascript
// wrangler.toml (production)
[env.production.vars]
TRADING_SYMBOLS = "AAPL,MSFT,GOOGL,TSLA,NVDA"
SIGNAL_CONFIDENCE_THRESHOLD = "0.7"
LOG_LEVEL = "info"
STRUCTURED_LOGGING = "true"
```

### Testing Configuration

```javascript
// Test configuration override
const testConfig = {
  ...CONFIG,
  TRADING: {
    ...CONFIG.TRADING,
    SYMBOLS: ['TEST1', 'TEST2'],
    SIGNAL_CONFIDENCE_THRESHOLD: 0.5
  },
  LOGGING: {
    ...CONFIG.LOGGING,
    LEVEL: 'error'
  }
};
```

## Migration from Hardcoded Values

### Before (Hardcoded)
```javascript
// Scattered throughout codebase
const ttl = 604800; // 7 days
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
const threshold = 0.7;
const timeout = 5000;
```

### After (Centralized)
```javascript
// Centralized in config.js
export const CONFIG = {
  KV_STORAGE: { ANALYSIS_TTL: 604800 },
  TRADING: {
    SYMBOLS: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
    SIGNAL_CONFIDENCE_THRESHOLD: 0.7
  },
  NETWORK: { TIMEOUT_MS: { DEFAULT: 5000 } }
};

// Usage throughout codebase
import { CONFIG } from './config.js';
const ttl = CONFIG.KV_STORAGE.ANALYSIS_TTL;
const symbols = CONFIG.TRADING.SYMBOLS;
const threshold = CONFIG.TRADING.SIGNAL_CONFIDENCE_THRESHOLD;
const timeout = CONFIG.NETWORK.TIMEOUT_MS.DEFAULT;
```

## Configuration Best Practices

### 1. Use Environment Variables
```javascript
// Good
const symbols = env.TRADING_SYMBOLS?.split(',') || CONFIG.TRADING.SYMBOLS;

// Bad
const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']; // Hardcoded
```

### 2. Provide Fallback Defaults
```javascript
// Good
const level = env.LOG_LEVEL || CONFIG.LOGGING.LEVEL;

// Bad
const level = env.LOG_LEVEL || 'info'; // Duplicate default
```

### 3. Validate Configuration
```javascript
// Good
const validation = EnvironmentValidation.validateEnvironment(env);
if (!validation.valid) {
  throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
}

// Bad
// No validation
```

### 4. Group Related Configuration
```javascript
// Good
export const CONFIG = {
  TRADING: {
    SYMBOLS: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
    SIGNAL_CONFIDENCE_THRESHOLD: 0.7,
    MIN_NEWS_ARTICLES: 3,
    MAX_NEWS_ARTICLES: 10
  }
};

// Bad
export const CONFIG = {
  TRADING_SYMBOLS: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'],
  SIGNAL_CONFIDENCE_THRESHOLD: 0.7,
  MIN_NEWS_ARTICLES: 3,
  MAX_NEWS_ARTICLES: 10
};
```

## Configuration Monitoring

### Configuration Health Check

```javascript
export async function checkConfigurationHealth(env) {
  const checks = [
    { name: 'Trading Symbols', check: () => getTradingSymbols(env).length > 0 },
    { name: 'Confidence Threshold', check: () => getConfidenceThreshold(env) > 0 },
    { name: 'Log Level', check: () => getLogLevel(env) in ['error', 'warn', 'info', 'debug'] },
    { name: 'KV Storage', check: () => env.TRADING_RESULTS !== undefined }
  ];

  const results = await Promise.all(
    checks.map(async ({ name, check }) => ({
      name,
      status: (await check()) ? 'healthy' : 'unhealthy'
    }))
  );

  return {
    overall: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
    checks
  };
}
```

### Configuration Metrics

```javascript
export function getConfigurationMetrics() {
  return {
    configuration: {
      symbols_count: CONFIG.TRADING.SYMBOLS.length,
      confidence_threshold: CONFIG.TRADING.SIGNAL_CONFIDENCE_THRESHOLD,
      logging_level: CONFIG.LOGGING.LEVEL,
      kv_ttl_analysis: CONFIG.KV_STORAGE.ANALYSIS_TTL,
      market_data_cache_ttl: CONFIG.MARKET_DATA.CACHE_TTL,
      rate_limit_requests: CONFIG.MARKET_DATA.RATE_LIMIT_REQUESTS_PER_MINUTE
    }
  };
}
```

## Conclusion

The centralized configuration system provides a robust, maintainable, and scalable approach to managing system settings. It eliminates hardcoded values, provides environment flexibility, ensures type safety, and improves developer experience throughout the application lifecycle.