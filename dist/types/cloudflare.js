/**
 * Enhanced Cloudflare Type Definitions
 *
 * Comprehensive type definitions for Cloudflare Workers, KV, Durable Objects, and R2.
 * Replaces generic 'any' types with specific, well-defined interfaces.
 */
// ============================================================================
// Type Guards
// ============================================================================
export function isKVNamespace(value) {
    return value && typeof value === 'object' &&
        typeof value.get === 'function' &&
        typeof value.put === 'function' &&
        typeof value.delete === 'function';
}
export function isR2Bucket(value) {
    return value && typeof value === 'object' &&
        typeof value.head === 'function' &&
        typeof value.get === 'function' &&
        typeof value.put === 'function' &&
        typeof value.delete === 'function';
}
export function isD1Database(value) {
    return value && typeof value === 'object' &&
        typeof value.prepare === 'function' &&
        typeof value.batch === 'function' &&
        typeof value.exec === 'function';
}
export function isDurableObjectNamespace(value) {
    return value && typeof value === 'object' &&
        typeof value.idFromName === 'function' &&
        typeof value.idFromString === 'function';
}
export function isAi(value) {
    return value && typeof value === 'object' &&
        typeof value.run === 'function';
}
//# sourceMappingURL=cloudflare.js.map