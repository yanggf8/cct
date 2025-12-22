/**
 * Node.js Compatibility Shim for Cloudflare Workers
 * Provides minimal process.env stub for code that references it
 * 
 * NOTE: In Cloudflare Workers, use env bindings instead of process.env
 */

declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
}

// Track warned keys to avoid spam
const warnedKeys = new Set<string>();

// Initialize process.env with a proxy that warns once per key
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = {
    env: new Proxy({} as Record<string, string | undefined>, {
      get(target, prop) {
        if (typeof prop === 'string' && prop !== 'toJSON' && !warnedKeys.has(prop)) {
          warnedKeys.add(prop);
          console.warn(`[node-shim] process.env.${prop} accessed - use env bindings in Cloudflare Workers`);
        }
        return undefined;
      }
    })
  };
}

export {};
