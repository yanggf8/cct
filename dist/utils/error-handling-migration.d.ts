/**
 * Error Handling Migration Utility
 *
 * Provides quick migration functions to replace `catch (error: any)` patterns
 * throughout the codebase without breaking existing functionality.
 */
/**
 * Replace catch (error: any) with proper error handling
 * Usage: Replace `catch (error: any)` with `catch (error) { handleError(error, context); }`
 */
export declare function handleError(error: unknown, context?: Record<string, any>): never;
/**
 * Handle error with custom fallback instead of throwing
 */
export declare function handleErrorWithFallback<T>(error: unknown, fallback: T, context?: Record<string, any>): T;
/**
 * Async error wrapper for functions
 */
export declare function wrapAsyncErrors<T>(fn: () => Promise<T>, context?: Record<string, any>): Promise<T>;
/**
 * Sync error wrapper for functions
 */
export declare function wrapSyncErrors<T>(fn: () => T, context?: Record<string, any>): T;
/**
 * Specific error handlers for common patterns
 */
/**
 * Handle KV operation errors
 */
export declare function handleKVError(error: unknown, operation: string, key?: string): never;
/**
 * Handle AI model errors
 */
export declare function handleAIError(error: unknown, model: string, input?: any): never;
/**
 * Handle API request errors
 */
export declare function handleAPIError(error: unknown, endpoint: string, method?: string): never;
/**
 * Migration templates for common patterns
 */
/**
 * Template 1: Replace `catch (error: any) { console.error(error); }`
 * Before: catch (error: any) { console.error(error); }
 * After:  catch (error) { handleError(error, { operation: 'functionName' }); }
 */
export declare const MIGRATION_TEMPLATE_1 = "\n// Before:\ncatch (error: any) {\n  console.error(error);\n}\n\n// After:\ncatch (error) {\n  handleError(error, { operation: 'functionName' });\n}\n";
/**
 * Template 2: Replace `catch (error: any) { return null; }`
 * Before: catch (error: any) { return null; }
 * After:  catch (error) { return handleErrorWithFallback(error, null, { operation: 'functionName' }); }
 */
export declare const MIGRATION_TEMPLATE_2 = "\n// Before:\ncatch (error: any) {\n  return null;\n}\n\n// After:\ncatch (error) {\n  return handleErrorWithFallback(error, null, { operation: 'functionName' });\n}\n";
/**
 * Template 3: Replace `catch (error: any) { throw error; }`
 * Before: catch (error: any) { throw error; }
 * After:  catch (error) { handleError(error, { operation: 'functionName' }); }
 */
export declare const MIGRATION_TEMPLATE_3 = "\n// Before:\ncatch (error: any) {\n  throw error;\n}\n\n// After:\ncatch (error) {\n  handleError(error, { operation: 'functionName' });\n}\n";
/**
 * Quick migration function for批量 updates
 */
export declare function migrateCatchBlocks(code: string, operationName: string): string;
/**
 * Usage examples and best practices
 */
export declare const USAGE_EXAMPLES: {
    basicMigration: string;
    withFallbacks: string;
    asyncWrappers: string;
};
//# sourceMappingURL=error-handling-migration.d.ts.map