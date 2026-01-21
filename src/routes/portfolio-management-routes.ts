/**
 * Portfolio Management Routes (API v1)
 * Web-based portfolio symbol management via Durable Objects
 */

import { ApiResponseFactory, ProcessingTimer, HttpStatus } from '../modules/api-v1-responses.js';
import { validateApiKey, generateRequestId } from './api-v1.js';
import { createLogger } from '../modules/logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('portfolio-mgmt-routes');

/**
 * Handle all portfolio management routes
 */
export async function handlePortfolioManagementRoutes(
  request: Request,
  env: CloudflareEnvironment,
  path: string,
  headers: Record<string, string>
): Promise<Response> {
  const timer = new ProcessingTimer();
  const requestId = generateRequestId();

  // All portfolio endpoints are protected
  const authResult = validateApiKey(request, env);
  if (!authResult.valid) {
    return new Response(
      JSON.stringify(ApiResponseFactory.error('API key required', 'UNAUTHORIZED', { requestId })),
      { status: HttpStatus.UNAUTHORIZED, headers }
    );
  }

  try {
    if (!env.PORTFOLIO_DO) {
      return new Response(
        JSON.stringify(ApiResponseFactory.error('Portfolio DO not available', 'SERVICE_UNAVAILABLE', { requestId })),
        { status: HttpStatus.SERVICE_UNAVAILABLE, headers }
      );
    }

    const doId = env.PORTFOLIO_DO.idFromName('default');
    const doStub = (env.PORTFOLIO_DO as any).get(doId);

    // GET /api/v1/portfolio/symbols - Get current portfolio
    if (path === '/api/v1/portfolio/symbols' && request.method === 'GET') {
      const doResponse = await doStub.fetch('https://portfolio.internal/symbols');
      const data = await doResponse.json() as any;

      if (data.success) {
        return new Response(
          JSON.stringify(ApiResponseFactory.success(data.data, {
            requestId,
            processingTime: timer.getElapsedMs()
          })),
          { status: HttpStatus.OK, headers }
        );
      }

      return new Response(
        JSON.stringify(ApiResponseFactory.error('Failed to fetch portfolio', 'INTERNAL_ERROR', { requestId })),
        { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
      );
    }

    // PUT /api/v1/portfolio/symbols - Update entire portfolio
    if (path === '/api/v1/portfolio/symbols' && request.method === 'PUT') {
      const body = await request.json() as { symbols: string[] };

      const doResponse = await doStub.fetch('https://portfolio.internal/symbols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: body.symbols })
      });

      const data = await doResponse.json() as any;

      if (data.success) {
        logger.info('Portfolio updated', { symbols: data.data.symbols, requestId });
        return new Response(
          JSON.stringify(ApiResponseFactory.success(data.data, {
            requestId,
            processingTime: timer.getElapsedMs()
          })),
          { status: HttpStatus.OK, headers }
        );
      }

      return new Response(
        JSON.stringify(ApiResponseFactory.error(data.error || 'Failed to update portfolio', 'BAD_REQUEST', { requestId })),
        { status: HttpStatus.BAD_REQUEST, headers }
      );
    }

    // POST /api/v1/portfolio/symbols/add - Add symbol(s) to portfolio
    if (path === '/api/v1/portfolio/symbols/add' && request.method === 'POST') {
      const body = await request.json() as { symbols: string | string[] };

      const doResponse = await doStub.fetch('https://portfolio.internal/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: body.symbols })
      });

      const data = await doResponse.json() as any;

      if (data.success) {
        logger.info('Symbols added to portfolio', { added: data.data.added, requestId });
        return new Response(
          JSON.stringify(ApiResponseFactory.success(data.data, {
            requestId,
            processingTime: timer.getElapsedMs()
          })),
          { status: HttpStatus.OK, headers }
        );
      }

      return new Response(
        JSON.stringify(ApiResponseFactory.error(data.error || 'Failed to add symbols', 'BAD_REQUEST', { requestId })),
        { status: HttpStatus.BAD_REQUEST, headers }
      );
    }

    // POST /api/v1/portfolio/symbols/remove - Remove symbol(s) from portfolio
    if (path === '/api/v1/portfolio/symbols/remove' && request.method === 'POST') {
      const body = await request.json() as { symbols: string | string[] };

      const doResponse = await doStub.fetch('https://portfolio.internal/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: body.symbols })
      });

      const data = await doResponse.json() as any;

      if (data.success) {
        logger.info('Symbols removed from portfolio', { removed: data.data.removed, requestId });
        return new Response(
          JSON.stringify(ApiResponseFactory.success(data.data, {
            requestId,
            processingTime: timer.getElapsedMs()
          })),
          { status: HttpStatus.OK, headers }
        );
      }

      return new Response(
        JSON.stringify(ApiResponseFactory.error(data.error || 'Failed to remove symbols', 'BAD_REQUEST', { requestId })),
        { status: HttpStatus.BAD_REQUEST, headers }
      );
    }

    // POST /api/v1/portfolio/symbols/reset - Reset to default portfolio
    if (path === '/api/v1/portfolio/symbols/reset' && request.method === 'POST') {
      const doResponse = await doStub.fetch('https://portfolio.internal/reset', {
        method: 'POST'
      });

      const data = await doResponse.json() as any;

      if (data.success) {
        logger.info('Portfolio reset to default', { symbols: data.data.symbols, requestId });
        return new Response(
          JSON.stringify(ApiResponseFactory.success(data.data, {
            requestId,
            processingTime: timer.getElapsedMs()
          })),
          { status: HttpStatus.OK, headers }
        );
      }

      return new Response(
        JSON.stringify(ApiResponseFactory.error(data.error || 'Failed to reset portfolio', 'INTERNAL_ERROR', { requestId })),
        { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
      );
    }

    return new Response(
      JSON.stringify(ApiResponseFactory.error('Portfolio endpoint not found', 'NOT_FOUND', { path })),
      { status: HttpStatus.NOT_FOUND, headers }
    );

  } catch (error) {
    logger.error('Portfolio route error', { error: (error as Error).message, path });
    return new Response(
      JSON.stringify(ApiResponseFactory.error('Internal server error', 'INTERNAL_ERROR', { requestId })),
      { status: HttpStatus.INTERNAL_SERVER_ERROR, headers }
    );
  }
}
