/**
 * Health Check API for Real TFT and N-HITS Model Endpoints
 * Tests both models with real OHLCV data and returns comprehensive status
 */

// Vercel Edge Function for Health Check

export default async function handler(req, res) {
  try {
    const startTime = Date.now();

    // Test data for health check
    const testOHLCV = [
      [100, 105, 99, 103, 1000000],  // Day 1
      [103, 108, 102, 106, 1200000], // Day 2
      [106, 110, 104, 108, 1100000], // Day 3
      [108, 112, 107, 110, 1300000], // Day 4
      [110, 115, 109, 113, 1150000], // Day 5
      [113, 118, 112, 116, 1400000], // Day 6
      [116, 120, 115, 118, 1250000], // Day 7
      [118, 122, 117, 120, 1350000], // Day 8
      [120, 125, 119, 123, 1450000], // Day 9
      [123, 127, 122, 125, 1300000], // Day 10
    ];

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      models: {
        tft: null,
        nhits: null
      },
      performance: {
        response_time_ms: null,
        tft_inference_time: null,
        nhits_inference_time: null
      },
      system: {
        version: '1.0.0',
        architecture: 'TFT + N-HITS Ensemble',
        runtime: 'Vercel Edge Functions'
      }
    };

    // Test TFT model
    try {
      const tftResponse = await fetch(
        `${req.url.replace('/api/health', '/api/predict-tft')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'AAPL',
            ohlcv: testOHLCV
          })
        }
      );

      if (tftResponse.ok) {
        const tftData = await tftResponse.json();
        healthStatus.models.tft = {
          status: 'healthy',
          test_prediction: tftData.prediction?.predicted_price,
          inference_time: tftData.metadata?.inference_time_ms,
          confidence: tftData.prediction?.confidence,
          direction: tftData.prediction?.direction,
          model_version: tftData.metadata?.model_version
        };
        healthStatus.performance.tft_inference_time = tftData.metadata?.inference_time_ms;
      } else {
        healthStatus.models.tft = {
          status: 'error',
          error: `HTTP ${tftResponse.status}`
        };
      }
    } catch (error) {
      healthStatus.models.tft = {
        status: 'error',
        error: error.message
      };
    }

    // Test N-HITS model
    try {
      const nhitsResponse = await fetch(
        `${req.url.replace('/api/health', '/api/predict-nhits')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'AAPL',
            ohlcv: testOHLCV
          })
        }
      );

      if (nhitsResponse.ok) {
        const nhitsData = await nhitsResponse.json();
        healthStatus.models.nhits = {
          status: 'healthy',
          test_prediction: nhitsData.prediction?.predicted_price,
          inference_time: nhitsData.metadata?.inference_time_ms,
          confidence: nhitsData.prediction?.confidence,
          direction: nhitsData.prediction?.direction,
          hierarchical_features: nhitsData.prediction?.hierarchical_features,
          model_version: nhitsData.metadata?.model_version,
          stacks: nhitsData.metadata?.stacks,
          pooling_rates: nhitsData.metadata?.pooling_rates
        };
        healthStatus.performance.nhits_inference_time = nhitsData.metadata?.inference_time_ms;
      } else {
        healthStatus.models.nhits = {
          status: 'error',
          error: `HTTP ${nhitsResponse.status}`
        };
      }
    } catch (error) {
      healthStatus.models.nhits = {
        status: 'error',
        error: error.message
      };
    }

    const totalTime = Date.now() - startTime;
    healthStatus.performance.response_time_ms = totalTime;

    // Determine overall status and add ensemble analysis
    const tftHealthy = healthStatus.models.tft?.status === 'healthy';
    const nhitsHealthy = healthStatus.models.nhits?.status === 'healthy';
    const hasErrors = !tftHealthy || !nhitsHealthy;

    if (hasErrors) {
      healthStatus.status = tftHealthy && !nhitsHealthy ? 'degraded-tft-only' :
                           !tftHealthy && nhitsHealthy ? 'degraded-nhits-only' : 'degraded';
    }

    // Add ensemble capability status
    healthStatus.ensemble = {
      available: tftHealthy && nhitsHealthy,
      mode: tftHealthy && nhitsHealthy ? 'dual-model' :
            tftHealthy ? 'tft-fallback' :
            nhitsHealthy ? 'nhits-fallback' : 'unavailable'
    };

    const httpStatus = hasErrors ? 503 : 200;

    return res.status(httpStatus).json(healthStatus);

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

