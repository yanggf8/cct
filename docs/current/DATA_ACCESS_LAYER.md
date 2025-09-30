# Data Access Layer (DAL) - TypeScript

**Created**: 2025-09-30
**Status**: ✅ Production-Ready
**Location**: `src/modules/dal.ts`

## Overview

Centralized, type-safe TypeScript Data Access Layer for all KV storage operations across the application.

## Architecture

### Design Goals
- **Type Safety**: Full TypeScript type definitions for all operations
- **Consistent Error Handling**: Standardized error responses across the application
- **Automatic Retry Logic**: Exponential backoff with configurable retries
- **KV Key Factory Integration**: Standardized key generation and TTL management
- **Comprehensive Logging**: Structured logging for all operations
- **Eventual Consistency Awareness**: 60-second delay handling for KV writes

## Key Features

### 1. Type-Safe Interfaces

```typescript
export interface AnalysisData {
  test_mode?: boolean;
  symbols_analyzed: string[];
  trading_signals: Record<string, TradingSignal>;
  timestamp: string;
  data_source?: string;
  cron_execution_id?: string;
  analysis_type?: string;
}

export interface KVReadResult<T> {
  success: boolean;
  data?: T;
  key: string;
  source: 'kv' | 'cache' | 'error';
  error?: string;
}

export interface KVWriteResult {
  success: boolean;
  key: string;
  ttl?: number;
  error?: string;
}
```

### 2. Automatic Retry with Exponential Backoff

```typescript
private async retry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (attempt < this.retryConfig.maxRetries - 1) {
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

**Default Configuration**:
- Max Retries: 3
- Base Delay: 1000ms
- Max Delay: 10000ms

### 3. Specialized Methods

#### Analysis Data Operations
```typescript
// Read analysis for specific date
const result = await dal.getAnalysis('2025-09-30');
if (result.success) {
  console.log('Symbols:', result.data.symbols_analyzed);
}

// Store analysis with automatic TTL
await dal.storeAnalysis('2025-09-30', analysisData);
```

#### Manual/On-Demand Analysis
```typescript
// Store manual analysis (separate from cron history)
const timestamp = Date.now();
await dal.storeManualAnalysis(timestamp, analysisData);

// Read manual analysis
const manualResult = await dal.getManualAnalysis(timestamp);
```

#### Generic Operations
```typescript
// Generic read
const result = await dal.read<CustomType>('custom_key');

// Generic write with custom TTL
await dal.write('custom_key', data, { expirationTtl: 3600 });

// List keys with prefix
const { keys, cursor } = await dal.listKeys('analysis_2025-09');

// Delete key
await dal.deleteKey('old_key');
```

## Usage from JavaScript

The DAL is written in TypeScript but fully compatible with JavaScript:

```javascript
import { createDAL } from './dal.js';

// Create DAL instance
const dal = createDAL(env);

// Use DAL operations
const result = await dal.getAnalysis('2025-09-30');
```

See `src/modules/dal-example.js` for comprehensive usage examples.

## Integration with KV Key Factory

The DAL automatically uses KV Key Factory for:
- Standardized key generation
- Automatic TTL assignment based on key type
- Key validation and sanitization

```typescript
// DAL internally uses:
const key = KVKeyFactory.generateKey(KeyTypes.ANALYSIS, { date });
const kvOptions = KeyHelpers.getKVOptions(KeyTypes.ANALYSIS);
```

## Error Handling

All DAL methods return structured results:

```typescript
// Success case
{
  success: true,
  data: { ... },
  key: 'analysis_2025-09-30',
  source: 'kv'
}

// Error case
{
  success: false,
  key: 'analysis_2025-09-30',
  source: 'error',
  error: 'Analysis not found'
}
```

## Migration from Direct KV Access

### Before (Direct KV Access)
```javascript
const key = `analysis_${date}`;
const data = await env.TRADING_RESULTS.get(key);
const parsed = JSON.parse(data);
```

### After (Using DAL)
```javascript
const dal = createDAL(env);
const result = await dal.getAnalysis(date);
if (result.success) {
  const parsed = result.data;
}
```

### Benefits
- ✅ Type safety from TypeScript
- ✅ Automatic retry logic
- ✅ Consistent error handling
- ✅ KV Key Factory integration
- ✅ Comprehensive logging
- ✅ Centralized error recovery

## Current Usage

**Direct KV Access Remaining**: 129 operations across 21 files
**DAL Adoption**: Message tracking module (msg-tracking.ts)
**Future Migration**: Gradual migration of remaining files to use DAL

## Related Documentation

- [KV Key Factory](./KV_KEY_FACTORY.md) - Key generation and management
- [Message Tracking](./MESSAGE_TRACKING.md) - Platform-agnostic message tracking
- [Configuration](./CONFIGURATION.md) - System configuration management