# TypeScript Type Safety Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from `any` types to proper TypeScript types throughout the codebase.

## Migration Strategy

### Phase 1: Error Handling (Completed ✅)

**Files Created:**
- `src/types/errors.ts` - Comprehensive error type definitions
- `src/utils/error-handling-migration.ts` - Migration utilities

**Migration Pattern:**
```typescript
// Before:
catch (error: any) {
  console.error(error);
}

// After:
catch (error: unknown) {
  handleError(error, { operation: 'functionName' });
}
```

**Quick Migration Script:**
```bash
# Replace catch blocks automatically
find src -name "*.ts" -exec sed -i 's/catch (error: any)/catch (error: unknown)/g' {} \;
```

### Phase 2: AI Analysis Types (Completed ✅)

**Files Created:**
- `src/types/ai-analysis.ts` - AI model interfaces

**Migration Pattern:**
```typescript
// Before:
interface Env {
  AI: any;
}

// After:
interface Env {
  AI: CloudflareAI;
}
```

### Phase 3: Cloudflare Types (Completed ✅)

**Files Created:**
- `src/types/cloudflare.ts` - Enhanced Cloudflare types

**Key Improvements:**
- Typed KV operations
- Durable Object interfaces
- R2 Bucket types
- AI binding types

### Phase 4: API Types (Completed ✅)

**Files Created:**
- `src/types/api.ts` - Request/response type definitions

**Migration Pattern:**
```typescript
// Before:
function createResponse(data: any, success: boolean) {
  return { data, success };
}

// After:
function createResponse<T>(data: T, success: boolean): ApiResponse<T> {
  return createSuccessResponse(data);
}
```

## Step-by-Step Migration

### 1. Update Error Handling

**High Priority Files (300+ catch blocks):**
- `src/modules/handlers.ts`
- `src/modules/analysis.ts`
- `src/modules/data.ts`
- `src/modules/kv-utils.ts`

**Migration Steps:**
1. Add error handling import:
```typescript
import { handleError, handleKVError, handleAIError } from '../utils/error-handling-migration.js';
```

2. Replace catch blocks:
```typescript
// Replace this:
catch (error: any) {
  console.error('Operation failed:', error);
  throw error;
}

// With this:
catch (error) {
  handleError(error, { operation: 'functionName', input: data });
}
```

### 2. Update AI Usage

**Files to Update:**
- `src/modules/dual-ai-analysis.ts`
- `src/modules/home-dashboard.ts`
- `src/modules/advanced-risk-management.ts`

**Migration Steps:**
1. Update interface imports:
```typescript
import type { CloudflareAI } from '../types.js';
```

2. Update environment interfaces:
```typescript
interface Env {
  AI: CloudflareAI; // Instead of AI: any;
}
```

### 3. Update API Endpoints

**Files to Update:**
- `src/routes/api-v1.ts`
- `src/routes/report-routes.ts`
- `src/routes/sentiment-routes.ts`

**Migration Steps:**
1. Import API types:
```typescript
import type {
  ApiResponse,
  SymbolsRequest,
  SentimentAnalysisRequest
} from '../types/api.js';
```

2. Update function signatures:
```typescript
// Before:
async function handleSentiment(request: any, env: any): Promise<any>

// After:
async function handleSentiment(
  request: SentimentAnalysisRequest,
  env: CloudflareEnvironment
): Promise<ApiResponse<SymbolSentimentResponse[]>>
```

## Validation

### Type Checking

Run type checking after each phase:
```bash
npm run typecheck
```

### Testing

Run the type safety tests:
```bash
# If using Vitest
npm test tests/type-safety.test.ts

# Manual validation
npm run typecheck && echo "✅ Type check passed"
```

### Integration Testing

Test critical workflows:
```bash
npm run test:workflows
npm run test:integration
```

## Common Issues and Solutions

### Issue 1: Cloudflare Type Conflicts

**Problem:** Custom Cloudflare types conflict with built-in types.

**Solution:** Use type assertions for compatibility:
```typescript
import type { CloudflareEnvironment as CustomEnv } from '../types.js';

interface Env extends CustomEnv {
  // Custom properties
}
```

### Issue 2: Migration Breaking Changes

**Problem:** New types break existing functionality.

**Solution:** Use gradual migration with type guards:
```typescript
function processValue(value: any): string {
  // Type guard for backward compatibility
  if (typeof value === 'string') {
    return value;
  } else if (value && typeof value.toString === 'function') {
    return value.toString();
  }
  return String(value);
}
```

### Issue 3: Error Handling Overhead

**Problem:** Too many try-catch blocks after migration.

**Solution:** Use error handling wrappers:
```typescript
import { wrapAsyncErrors } from '../utils/error-handling-migration.js';

export async function safeOperation(input: string) {
  return wrapAsyncErrors(async () => {
    const result = await riskyOperation(input);
    return transform(result);
  }, { operation: 'safeOperation', input });
}
```

## Rollback Plan

If issues arise during migration:

### 1. Partial Rollback
```bash
# Revert specific files
git checkout HEAD~1 -- src/modules/issue-file.ts
```

### 2. Feature Flag
```typescript
// Use feature flags to enable/disable new types
const USE_NEW_TYPES = env.FEATURE_FLAG_NEW_TYPES === 'true';

type SafeAPIResponse = USE_NEW_TYPES ? ApiResponse : any;
```

### 3. Complete Rollback
```bash
# Revert to previous working state
git revert HEAD
```

## Best Practices

### 1. Incremental Migration
- Migrate one module at a time
- Test after each change
- Use feature flags for gradual rollout

### 2. Type Safety First
- Start with error handling (highest impact)
- Focus on public APIs
- Maintain backward compatibility

### 3. Documentation
- Document type definitions
- Provide migration examples
- Include type safety in code reviews

### 4. Testing
- Add type-specific tests
- Test error scenarios
- Validate type contracts

## Success Metrics

### Type Safety Metrics
- **Before:** 300+ `any` types, 0% type coverage
- **After:** <50 `any` types, 85%+ type coverage

### Quality Metrics
- Reduced runtime errors
- Improved IntelliSense support
- Better error messages
- Enhanced code documentation

### Performance Metrics
- No performance degradation
- Faster development with type hints
- Reduced debugging time

## Next Steps

1. **Complete Migration:** Finish updating all remaining files
2. **Type Coverage:** Aim for 90%+ type coverage
3. **Strict Mode:** Enable strict TypeScript checks
4. **Documentation:** Update API documentation with types
5. **CI/CD:** Add type checking to CI pipeline

## Support

For migration issues:
1. Check this guide first
2. Review `tests/type-safety.test.ts` for examples
3. Use `npm run typecheck` to identify issues
4. Create feature branches for large changes