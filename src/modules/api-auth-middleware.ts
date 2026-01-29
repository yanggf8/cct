/**
 * Centralized API Authentication Middleware
 * Single point of authentication for all API requests
 */

import type { CloudflareEnvironment } from '../types.js';

export interface AuthResult {
  authenticated: boolean;
  reason?: string;
}

// Public endpoints that don't require authentication (health checks only)
const PUBLIC_ENDPOINTS = [
  '/api/v1/data/health',  // Health check
  '/health',
  '/model-health',
];

// Public endpoint prefixes (for dynamic paths)
// Security decision 2026-01-29: All job endpoints public, defer auth to future phase
const PUBLIC_PREFIXES = [
  '/api/v1/jobs/',  // All job endpoints (trigger, delete, etc.)
];

// Public GET endpoints with pattern matching (for dynamic paths like /api/v1/jobs/runs/:runId/stages)
const PUBLIC_GET_PATTERNS = [
  /^\/api\/v1\/jobs\/runs\/[^/]+\/stages$/,  // Job run stages (for diagnostics display)
];

// Public endpoints for GET method only (read access, writes require auth)
const PUBLIC_GET_ONLY: string[] = [
  '/api/v1/reports/status',   // Navigation status for Reports menu
  '/api/v1/jobs/history',     // Job history for dashboard
  '/api/v1/jobs/runs',        // Job runs list for dashboard
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
  // GET-only public patterns (for dynamic paths)
  if (method === 'GET' && PUBLIC_GET_PATTERNS.some(p => p.test(path))) {
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
