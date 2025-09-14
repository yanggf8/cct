/**
 * HTTP Request Handlers Module
 * Handles all non-weekly-analysis HTTP endpoints
 */

// Import the original handler functions from the standalone worker
// For now, this is a wrapper - we can refactor these handlers later

export async function handleManualAnalysis(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  
  // Create a mock fetch request to trigger the original handler
  const mockRequest = new Request(new URL('/analyze', request.url), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleGetResults(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/results', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleHealthCheck(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/health', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleFacebookTest(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/test-facebook', request.url), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleWeeklyReport(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/weekly-report', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleFridayMarketCloseReport(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/friday-market-close-report', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleFridayMondayPredictionsReport(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/friday-monday-predictions-report', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleHighConfidenceTest(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/test-high-confidence', request.url), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleFactTable(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/fact-table', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleKVCleanup(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/kv-cleanup', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleDebugWeekendMessage(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(new URL('/debug-weekend-message', request.url), {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}

export async function handleKVGet(request, env) {
  const { default: originalWorker } = await import('../../cloudflare-worker-standalone.js');
  const mockRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers
  });
  return originalWorker.fetch(mockRequest, env, {});
}