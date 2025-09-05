#!/usr/bin/env node
/**
 * Local Test Server for Vercel Edge Functions
 * Simulates Edge Function behavior for local development
 */

const http = require('http');
const url = require('url');
const path = require('path');

// Import our Edge Function handlers (real versions)
const predict = require('./api/predict.js');
const predictTft = require('./api/predict-tft.js');
const predictDual = require('./api/predict-dual.js');
const health = require('./api/health.js');

const PORT = process.env.PORT || 3000;

// Simulate Vercel Edge environment
process.env.VERCEL_REGION = 'dev1';

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`${req.method} ${pathname}`);
  
  try {
    // Create a Request-like object for our handlers
    let body = '';
    if (req.method === 'POST') {
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
    }
    
    const mockRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      json: async () => body ? JSON.parse(body) : {}
    };
    
    let response;
    
    // Route to appropriate handler
    switch (pathname) {
      case '/api/health':
        response = await health.default(mockRequest);
        break;
      case '/api/predict':
        response = await predict.default(mockRequest);
        break;
      case '/api/predict-tft':
        response = await predictTft.default(mockRequest);
        break;
      case '/api/predict-dual':
        response = await predictDual.default(mockRequest);
        break;
      default:
        response = new Response(JSON.stringify({ error: 'Not Found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Send response
    const responseText = await response.text();
    const headers = response.headers || new Map();
    
    res.statusCode = response.status || 200;
    
    // Set response headers
    if (headers.get) {
      headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
    } else {
      res.setHeader('Content-Type', 'application/json');
    }
    
    res.end(responseText);
    
  } catch (error) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      error: 'Internal Server Error',
      message: error.message 
    }));
  }
});

server.listen(PORT, () => {
  console.log('🚀 Local Vercel Edge Functions Server');
  console.log('=====================================');
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log('');
  console.log('📍 Available Endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   POST http://localhost:${PORT}/api/predict`);
  console.log(`   POST http://localhost:${PORT}/api/predict-tft`);
  console.log(`   POST http://localhost:${PORT}/api/predict-dual`);
  console.log('');
  console.log('🧪 To test, run:');
  console.log(`   node test/test-client.js http://localhost:${PORT}`);
  console.log('');
  console.log('⏹️  Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});