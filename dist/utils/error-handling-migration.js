/**
 * Error Handling Migration Utility
 *
 * Provides quick migration functions to replace `catch (error: any)` patterns
 * throughout the codebase without breaking existing functionality.
 */
import { toAppError } from '../types/errors.js';
/**
 * Replace catch (error: any) with proper error handling
 * Usage: Replace `catch (error: any)` with `catch (error) { handleError(error, context); }`
 */
export function handleError(error, context) {
    const appError = toAppError(error, context);
    // Log the error with context
    console.error('Application error:', {
        message: appError.message,
        category: appError.category,
        severity: appError.severity,
        context: appError.context,
        timestamp: appError.timestamp,
        stack: appError.stack
    });
    throw appError;
}
/**
 * Handle error with custom fallback instead of throwing
 */
export function handleErrorWithFallback(error, fallback, context) {
    const appError = toAppError(error, context);
    console.warn('Error handled with fallback:', {
        message: appError.message,
        category: appError.category,
        severity: appError.severity,
        context: appError.context,
        fallback
    });
    return fallback;
}
/**
 * Async error wrapper for functions
 */
export async function wrapAsyncErrors(fn, context) {
    try {
        return await fn();
    }
    catch (error) {
        handleError(error, context);
    }
}
/**
 * Sync error wrapper for functions
 */
export function wrapSyncErrors(fn, context) {
    try {
        return fn();
    }
    catch (error) {
        handleError(error, context);
    }
}
/**
 * Specific error handlers for common patterns
 */
/**
 * Handle KV operation errors
 */
export function handleKVError(error, operation, key) {
    const appError = toAppError(error, { operation, key });
    // Enhance KV-specific errors
    if (appError.category === 'network') {
        appError.severity = 'high';
        appError.retryable = true;
    }
    else {
        // Keep original category but set a default name
        if (!appError.name || appError.name === 'UnknownError') {
            appError.name = 'KVOperationError';
        }
    }
    console.error('KV operation failed:', {
        operation,
        key,
        error: appError.message,
        category: appError.category,
        retryable: appError.retryable
    });
    throw appError;
}
/**
 * Handle AI model errors
 */
export function handleAIError(error, model, input) {
    const appError = toAppError(error, { model, input });
    // Enhance AI-specific errors
    if (appError.message.includes('timeout')) {
        appError.category = 'timeout';
        appError.name = 'AITimeoutError';
        appError.severity = 'high';
    }
    else if (appError.message.includes('rate limit')) {
        appError.category = 'rate_limit';
        appError.name = 'AIRateLimitError';
        appError.severity = 'medium';
    }
    else if (appError.category === 'network') {
        appError.name = 'AINetworkError';
        appError.severity = 'high';
    }
    else {
        appError.category = 'external_api';
        appError.name = 'AIModelError';
    }
    console.error('AI model operation failed:', {
        model,
        error: appError.message,
        category: appError.category,
        retryable: appError.retryable
    });
    throw appError;
}
/**
 * Handle API request errors
 */
export function handleAPIError(error, endpoint, method) {
    const appError = toAppError(error, { endpoint, method });
    // Enhance API-specific errors
    if (appError.message.includes('timeout')) {
        appError.category = 'timeout';
        appError.name = 'APITimeoutError';
    }
    else if (appError.message.includes('rate limit')) {
        appError.category = 'rate_limit';
        appError.name = 'APIRateLimitError';
    }
    else if (appError.message.includes('unauthorized')) {
        appError.category = 'authentication';
        appError.name = 'APIAuthenticationError';
        appError.retryable = false;
    }
    else if (appError.message.includes('forbidden')) {
        appError.category = 'authorization';
        appError.name = 'APIAuthorizationError';
        appError.retryable = false;
    }
    else if (appError.category === 'network') {
        appError.name = 'APINetworkError';
    }
    console.error('API request failed:', {
        endpoint,
        method,
        error: appError.message,
        category: appError.category,
        retryable: appError.retryable
    });
    throw appError;
}
/**
 * Migration templates for common patterns
 */
/**
 * Template 1: Replace `catch (error: any) { console.error(error); }`
 * Before: catch (error: any) { console.error(error); }
 * After:  catch (error) { handleError(error, { operation: 'functionName' }); }
 */
export const MIGRATION_TEMPLATE_1 = `
// Before:
catch (error: any) {
  console.error(error);
}

// After:
catch (error) {
  handleError(error, { operation: 'functionName' });
}
`;
/**
 * Template 2: Replace `catch (error: any) { return null; }`
 * Before: catch (error: any) { return null; }
 * After:  catch (error) { return handleErrorWithFallback(error, null, { operation: 'functionName' }); }
 */
export const MIGRATION_TEMPLATE_2 = `
// Before:
catch (error: any) {
  return null;
}

// After:
catch (error) {
  return handleErrorWithFallback(error, null, { operation: 'functionName' });
}
`;
/**
 * Template 3: Replace `catch (error: any) { throw error; }`
 * Before: catch (error: any) { throw error; }
 * After:  catch (error) { handleError(error, { operation: 'functionName' }); }
 */
export const MIGRATION_TEMPLATE_3 = `
// Before:
catch (error: any) {
  throw error;
}

// After:
catch (error) {
  handleError(error, { operation: 'functionName' });
}
`;
/**
 * Quick migration function for批量 updates
 */
export function migrateCatchBlocks(code, operationName) {
    return code
        // Replace basic catch blocks
        .replace(/catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*console\.error\(error\);\s*\}/g, `catch (error) { handleError(error, { operation: '${operationName}' }); }`)
        // Replace return null patterns
        .replace(/catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*return\s+null;\s*\}/g, `catch (error) { return handleErrorWithFallback(error, null, { operation: '${operationName}' }); }`)
        // Replace throw error patterns
        .replace(/catch\s*\(\s*error\s*:\s*any\s*\)\s*\{\s*throw\s+error;\s*\}/g, `catch (error) { handleError(error, { operation: '${operationName}' }); }`)
        // Replace simple error handling
        .replace(/catch\s*\(\s*error\s*:\s*any\s*\)/g, 'catch (error)');
}
/**
 * Usage examples and best practices
 */
export const USAGE_EXAMPLES = {
    basicMigration: `
import { handleError, handleKVError, handleAIError } from '../utils/error-handling-migration.js';

// Example 1: Basic error handling
try {
  const result = await someOperation();
  return result;
} catch (error) {
  handleError(error, { operation: 'someOperation', input: data });
}

// Example 2: KV operation
try {
  const value = await env.KV.get(key);
  return value;
} catch (error) {
  handleKVError(error, 'get', key);
}

// Example 3: AI model call
try {
  const result = await env.AI.run(model, input);
  return result;
} catch (error) {
  handleAIError(error, model, input);
}
`,
    withFallbacks: `
import { handleErrorWithFallback } from '../utils/error-handling-migration.js';

// Example: Return fallback value on error
try {
  const data = await fetchData();
  return process(data);
} catch (error) {
  return handleErrorWithFallback(error, defaultData, {
    operation: 'fetchAndProcess',
    fallback: 'defaultData'
  });
}
`,
    asyncWrappers: `
import { wrapAsyncErrors, wrapSyncErrors } from '../utils/error-handling-migration.js';

// Example: Wrap entire functions
export async function safeOperation(input: string) {
  return wrapAsyncErrors(async () => {
    const result = await riskyOperation(input);
    return transform(result);
  }, { operation: 'safeOperation', input });
}

export function safeSyncOperation(input: number) {
  return wrapSyncErrors(() => {
    return riskySyncOperation(input);
  }, { operation: 'safeSyncOperation', input });
}
`
};
//# sourceMappingURL=error-handling-migration.js.map