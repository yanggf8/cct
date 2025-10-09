/**
 * API v1 Router
 * RESTful API endpoints following DAC patterns
 * Simplified JavaScript version
 */

/**
 * Main v1 API Router
 */
export async function handleApiV1Request(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Add request ID to headers for tracking
  const headers = {
    'X-Request-ID': generateRequestId(),
    'X-API-Version': 'v1',
    'Content-Type': 'application/json',
  };

  try {
    // Route to appropriate handler based on path
    if (path.startsWith('/api/v1/sentiment/')) {
      return await handleSentimentRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/reports/')) {
      return await handleReportRoutes(request, env, path, headers);
    } else if (path.startsWith('/api/v1/data/')) {
      return await handleDataRoutes(request, env, path, headers);
    } else if (path === '/api/v1') {
      // API v1 root - return available endpoints
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            title: 'CCT API v1',
            version: '1.0.0',
            description: 'RESTful API for dual AI sentiment analysis',
            available_endpoints: {
              sentiment: {
                analysis: 'GET /api/v1/sentiment/analysis',
                symbol: 'GET /api/v1/sentiment/symbols/:symbol',
                market: 'GET /api/v1/sentiment/market',
                sectors: 'GET /api/v1/sentiment/sectors',
              },
              reports: {
                daily: 'GET /api/v1/reports/daily/:date',
                weekly: 'GET /api/v1/reports/weekly/:week',
                pre_market: 'GET /api/v1/reports/pre-market',
                intraday: 'GET /api/v1/reports/intraday',
                end_of_day: 'GET /api/v1/reports/end-of-day',
              },
              data: {
                symbols: 'GET /api/v1/data/symbols',
                history: 'GET /api/v1/data/history/:symbol',
                health: 'GET /api/v1/data/health',
              },
            },
            documentation: 'https://github.com/yanggf8/cct',
            status: 'operational',
          },
          timestamp: new Date().toISOString(),
          metadata: {
            requestId: headers['X-Request-ID'],
            version: 'v1',
          },
        }),
        { status: 200, headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Endpoint not found',
          requested_path: path,
          timestamp: new Date().toISOString(),
        }),
        { status: 404, headers }
      );
    }
  } catch (error) {
    console.error('API v1 Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers,
      }
    );
  }
}

/**
 * CORS preflight handler for API v1
 */
export function handleApiV1CORS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Helper functions
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateApiKey(request) {
  const apiKey = request.headers.get('X-API-Key');
  const validKeys = ['yanggf', 'demo', 'test'];
  return { valid: validKeys.includes(apiKey), key: apiKey };
}

// Placeholder handlers - these will be expanded later
async function handleSentimentRoutes(request, env, path, headers) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid or missing API key',
      }),
      { status: 401, headers }
    );
  }

  // Simple mock responses for now
  if (path === '/api/v1/sentiment/analysis') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          symbols: ['AAPL', 'MSFT', 'GOOGL'],
          analysis: {
            timestamp: new Date().toISOString(),
            market_sentiment: {
              overall_sentiment: 0.15,
              sentiment_label: 'BULLISH',
              confidence: 0.72,
            },
            signals: [
              { symbol: 'AAPL', signal: 'BUY', confidence: 0.75 },
              { symbol: 'MSFT', signal: 'HOLD', confidence: 0.60 },
              { symbol: 'GOOGL', signal: 'BUY', confidence: 0.68 }
            ]
          }
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path.startsWith('/api/v1/sentiment/symbols/')) {
    const symbol = path.split('/').pop();
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          symbol,
          analysis: {
            gpt_analysis: {
              sentiment: 'bullish',
              confidence: 0.75,
              reasoning: 'Positive market indicators',
            },
            agreement: {
              type: 'AGREE',
              recommendation: 'BUY',
            }
          }
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path === '/api/v1/sentiment/market') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          overall_sentiment: 0.15,
          sentiment_label: 'BULLISH',
          confidence: 0.72,
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path === '/api/v1/sentiment/sectors') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          sectors: [
            { symbol: 'XLK', name: 'Technology', sentiment: 0.25, sentiment_label: 'BULLISH' },
            { symbol: 'XLE', name: 'Energy', sentiment: -0.10, sentiment_label: 'BEARISH' }
          ],
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Endpoint not implemented yet',
    }),
    { status: 501, headers }
  );
}

async function handleReportRoutes(request, env, path, headers) {
  const auth = validateApiKey(request);
  if (!auth.valid) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid or missing API key',
      }),
      { status: 401, headers }
    );
  }

  if (path === '/api/v1/reports/daily' || path.startsWith('/api/v1/reports/daily/')) {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          date: new Date().toISOString().split('T')[0],
          report: {
            market_overview: {
              sentiment: 'bullish',
              confidence: 0.72,
              key_factors: ['Positive market sentiment', 'Strong tech sector'],
            },
            recommendations: [
              { symbol: 'AAPL', action: 'BUY', reason: 'Strong momentum' }
            ]
          }
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path === '/api/v1/reports/pre-market') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          type: 'pre_market_briefing',
          timestamp: new Date().toISOString(),
          market_status: 'pre_market',
          key_insights: ['Market opening positive', 'Tech sector leading'],
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path === '/api/v1/reports/intraday') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          type: 'intraday_check',
          timestamp: new Date().toISOString(),
          market_status: isMarketOpen() ? 'open' : 'closed',
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path === '/api/v1/reports/end-of-day') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          type: 'end_of_day_summary',
          date: new Date().toISOString().split('T')[0],
          market_status: 'closed',
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Report endpoint not implemented yet',
    }),
    { status: 501, headers }
  );
}

async function handleDataRoutes(request, env, path, headers) {
  // Some data endpoints are public
  if (path === '/api/v1/data/symbols') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          symbols: [
            { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 175.50 },
            { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', price: 345.20 },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', price: 142.80 }
          ],
          metadata: {
            total_count: 3,
            last_updated: new Date().toISOString(),
            data_source: 'CCT Configuration',
          }
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  const auth = validateApiKey(request);
  if (!auth.valid) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid or missing API key',
      }),
      { status: 401, headers }
    );
  }

  if (path.startsWith('/api/v1/data/history/')) {
    const symbol = path.split('/').pop();
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          symbol,
          period: '30 days',
          data_points: 20,
          data: generateMockHistoricalData(symbol),
          summary: {
            current_price: 175.50,
            period_change: '+2.3%',
            period_high: 180.25,
            period_low: 165.10,
          }
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  if (path === '/api/v1/data/health') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            ai_models: {
              gpt_oss_120b: 'healthy',
              distilbert: 'healthy',
            },
            data_sources: {
              yahoo_finance: 'healthy',
            },
            storage: {
              kv_storage: 'healthy',
            },
          },
          metrics: {
            uptime_percentage: 99.9,
            average_response_time_ms: 150,
            error_rate_percentage: 0.1,
          },
        },
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Data endpoint not implemented yet',
    }),
    { status: 501, headers }
  );
}

// Helper functions
function generateMockHistoricalData(symbol) {
  const data = [];
  let currentPrice = 175.50;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  for (let i = 0; i < 20; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const change = (Math.random() - 0.5) * 10;
    currentPrice = Math.max(currentPrice + change, 10);

    data.push({
      date: date.toISOString().split('T')[0],
      open: currentPrice,
      high: currentPrice * (1 + Math.random() * 0.02),
      low: currentPrice * (1 - Math.random() * 0.02),
      close: currentPrice,
      volume: Math.floor(Math.random() * 10000000) + 1000000,
    });
  }

  return data;
}

function isMarketOpen() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // Weekend check
  if (day === 0 || day === 6) return false;

  // Market hours (9:30 AM - 4:00 PM EST)
  if (hour < 10 || hour > 16) return false;
  if (hour === 10 && now.getMinutes() < 30) return false;

  return true;
}