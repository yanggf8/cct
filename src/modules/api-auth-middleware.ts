/**
 * Centralized API Authentication Middleware
 * Single point of authentication for all API requests
 */

import type { CloudflareEnvironment } from '../types.js';

export interface AuthResult {
  authenticated: boolean;
  reason?: string;
}

// Public endpoints that don't require authentication (exact matches only, all methods)
const PUBLIC_ENDPOINTS = [
  '/api/v1',              // API documentation root only
  '/api/v1/data/health',  // Health check
  '/api/v1/data/system-status', // System status for status page
  '/api/v1/jobs/history', // Job history (read-only)
  '/api/v1/jobs/latest',  // Latest job (read-only)
  '/health',
  '/model-health',
];

// Public endpoints for GET method only (writes still require auth)
const PUBLIC_GET_ONLY = [
  '/api/v1/settings/timezone', // User timezone preference (GET public, PUT requires auth)
];

// Public endpoint prefixes (for dynamic paths)
const PUBLIC_PREFIXES = [
  '/api/v1/jobs/snapshots/', // Job snapshots (read-only)
];

// Endpoints that serve HTML pages (no auth required)
const HTML_ENDPOINTS = [
  '/pre-market-briefing',
  '/intraday-check', 
  '/end-of-day-summary',
  '/weekly-review',
  '/weekly-analysis',
  '/',
];

/**
 * Check if endpoint requires authentication
 * @param path - URL pathname
 * @param method - HTTP method (GET, POST, PUT, etc.)
 */
export function requiresAuth(path: string, method?: string): boolean {
  // HTML pages don't require auth
  if (HTML_ENDPOINTS.some(e => path === e || path.startsWith(e + '?'))) {
    return false;
  }
  // Public API endpoints - exact match only (not prefix)
  if (PUBLIC_ENDPOINTS.some(e => path === e || path === e + '/')) {
    return false;
  }
  // GET-only public endpoints
  if (method === 'GET' && PUBLIC_GET_ONLY.some(e => path === e || path === e + '/')) {
    return false;
  }
  // Public prefixes (for dynamic paths like /api/v1/jobs/snapshots/:date/:type)
  if (PUBLIC_PREFIXES.some(p => path.startsWith(p))) {
    return false;
  }
  // Static assets don't require auth
  if (path.match(/\.(html|css|js|png|jpg|ico|svg|woff|woff2)$/)) {
    return false;
  }
  // All other /api/v1/* endpoints require auth
  return path.startsWith('/api/v1/');
}

/**
 * Centralized API authentication
 */
export function authenticateRequest(request: Request, env: CloudflareEnvironment): AuthResult {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Check if auth is required (pass method for GET-only public endpoints)
  if (!requiresAuth(path, method)) {
    return { authenticated: true, reason: 'public_endpoint' };
  }

  // Get API key from header
  const apiKey = request.headers.get('X-API-Key');
  
  // Get configured keys
  const configuredKeys = env.X_API_KEY ? env.X_API_KEY.split(',').map(k => k.trim()).filter(Boolean) : [];

  if (configuredKeys.length === 0) {
    // No keys configured - allow all (development mode)
    return { authenticated: true, reason: 'no_keys_configured' };
  }

  if (!apiKey) {
    return { authenticated: false, reason: 'missing_api_key' };
  }

  if (!configuredKeys.includes(apiKey)) {
    return { authenticated: false, reason: 'invalid_api_key' };
  }

  return { authenticated: true, reason: 'valid_api_key' };
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(reason: string): Response {
  return new Response(JSON.stringify({
    success: false,
    error: 'Unauthorized',
    message: reason === 'missing_api_key' 
      ? 'API key required. Include X-API-Key header.'
      : 'Invalid API key',
    timestamp: new Date().toISOString()
  }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'ApiKey'
    }
  });
}
