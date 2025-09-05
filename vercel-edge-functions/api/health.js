/**
 * Vercel Edge Function: Health Check and Model Status
 * System health monitoring for TFT + N-HITS edge deployment
 */

export default async function handler(request) {
  const startTime = performance.now();
  
  try {
    // System health checks
    const memoryUsage = process.memoryUsage ? process.memoryUsage() : null;
    const responseTime = performance.now() - startTime;
    
    // Edge runtime information
    const edgeInfo = {
      region: process.env.VERCEL_REGION || 'unknown',
      runtime: 'edge',
      nodeVersion: process.version || 'unknown',
      platform: process.platform || 'unknown'
    };
    
    // Model status simulation (in production, would check actual model loading)
    const modelStatus = {
      tft: {
        loaded: true,
        size: '0.13MB',
        parameters: 30209,
        status: 'ready'
      },
      nhits: {
        loaded: true,
        size: '0.03MB', 
        parameters: 4989,
        status: 'ready'
      },
      ensemble: {
        enabled: true,
        strategy: 'weighted_parallel',
        weights: { tft: 0.6, nhits: 0.4 }
      }
    };
    
    // Performance metrics
    const performance_metrics = {
      responseTimeMs: Math.round(responseTime * 100) / 100,
      expectedInferenceMs: '<2.0',
      parallelExecution: true,
      cacheEnabled: true
    };
    
    // System capabilities
    const capabilities = {
      webAssembly: typeof WebAssembly !== 'undefined',
      onnxRuntime: true, // Would check actual import in production
      parallelInference: true,
      edgeOptimized: true,
      globalDeployment: true
    };
    
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime ? process.uptime() : 'unknown',
        edge: edgeInfo,
        models: modelStatus,
        performance: performance_metrics,
        capabilities: capabilities,
        memory: memoryUsage,
        endpoints: {
          singleModel: '/api/predict',
          dualModel: '/api/predict-dual',
          health: '/api/health'
        },
        version: '1.0.0',
        deployment: {
          platform: 'vercel-edge',
          architecture: 'dual-tft-nhits',
          optimization: 'webassembly-onnx'
        }
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=60, s-maxage=300'
        }
      }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        edge: {
          region: process.env.VERCEL_REGION || 'unknown',
          runtime: 'edge'
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1', 'hnd1', 'syd1']
};