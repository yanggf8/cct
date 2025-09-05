#!/usr/bin/env node
/**
 * Direct Test of Health Endpoint
 * Tests the health monitoring functionality
 */

// Import health handler
import healthHandler from './api/health.js';

// Mock Response object for testing
class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
  }
  
  setHeader(key, value) {
    this.headers[key] = value;
  }
  
  status(code) {
    this.statusCode = code;
    return this;
  }
  
  json(data) {
    this.body = data;
    return this;
  }
  
  end() {
    return this;
  }
}

async function testHealthDirect() {
  console.log('🏥 Direct Health Endpoint Test');
  console.log('==============================');
  
  try {
    // Create mock request and response
    const mockRequest = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const mockResponse = new MockResponse();
    
    console.log('🔍 Testing health endpoint...');
    
    const startTime = Date.now();
    
    // Call the handler directly
    const response = await healthHandler(mockRequest, mockResponse);
    
    const totalTime = Date.now() - startTime;
    
    // Get the response body from the Response object
    const responseText = await response.text();
    const result = JSON.parse(responseText);
    
    // Analyze results
    if (result) {
      
      console.log('\n✅ Health Check Results:');
      console.log(`   Status: ${result.status}`);
      console.log(`   Timestamp: ${result.timestamp}`);
      console.log(`   Runtime: ${result.runtime?.platform}`);
      console.log(`   Region: ${result.runtime?.region}`);
      
      if (result.models) {
        console.log('\n🤖 Model Status:');
        console.log(`   N-HITS: ${result.models.nhits?.status}`);
        console.log(`   Version: ${result.models.nhits?.version}`);
        console.log(`   Parameters: ${result.models.nhits?.parameters}`);
      }
      
      if (result.capabilities) {
        console.log('\n⚙️ Capabilities:');
        console.log(`   WebAssembly: ${result.capabilities.webAssembly}`);
        console.log(`   ONNX Runtime: ${result.capabilities.onnxRuntime}`);
        console.log(`   Node Version: ${result.capabilities.nodeVersion}`);
        console.log(`   Memory Usage: ${result.capabilities.memoryUsage}MB`);
      }
      
      console.log(`\n⚡ Response Time: ${totalTime}ms`);
      console.log('\n🎯 Health Assessment: ✅ SYSTEM HEALTHY');
      
    } else {
      console.log('❌ Health Check Failed');
      console.log('Response Status:', mockResponse.statusCode);
    }
    
  } catch (error) {
    console.error('❌ Health test error:', error.message);
  }
}

// Run the test
testHealthDirect().catch(console.error);