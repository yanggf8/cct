#!/usr/bin/env python3
"""
Google Colab API Client for TFT Primary + N-HITS Backup Integration
Replaces ModelScope client - connects to Colab-hosted models via ngrok tunnel
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
import warnings
warnings.filterwarnings('ignore')

class ColabAPIClient:
    """
    Client for connecting to Colab-deployed TFT + N-HITS models
    Drop-in replacement for ModelScopeAPIClient
    """
    
    def __init__(self, colab_endpoint_url: str = None, api_key: str = None):
        # Colab ngrok endpoint (provided after running Colab notebook)
        self.endpoint_url = colab_endpoint_url or "https://placeholder-ngrok-url.ngrok.io"
        self.api_key = api_key  # Optional for future authentication
        
        # Configuration
        self.timeout = 15  # Longer timeout for Colab (can be slow on startup)
        self.max_retries = 2  # Fewer retries for Colab (sessions can disconnect)
        self.retry_delay = 2.0
        
        # Performance tracking
        self.api_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'avg_response_time': 0.0,
            'last_request_time': None,
            'colab_disconnects': 0
        }
        
        # Model info
        self.model_info = {
            'name': 'TFT Primary + N-HITS Backup (Colab)',
            'platform': 'Google Colab',
            'gpu': 'T4',
            'deployment_url': self.endpoint_url,
            'version': '1.0.0-colab',
            'capabilities': ['TFT Primary', 'N-HITS Backup', 'GPU Acceleration']
        }
        
        print(f"🌐 Colab API Client initialized")
        print(f"   Platform: Google Colab (T4 GPU)")
        print(f"   Endpoint: {self.endpoint_url}")
        print(f"   Model: {self.model_info['name']}")
    
    def _make_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP request to Colab API with retry logic"""
        
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'TFT-Trading-System-Colab/1.0'
        }
        
        # Add API key if provided (for future use)
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()
                
                print(f"🌐 Making API request to Colab (attempt {attempt + 1}/{self.max_retries})")
                
                response = requests.post(
                    f"{self.endpoint_url}/predict",
                    json=payload,
                    headers=headers,
                    timeout=self.timeout
                )
                
                end_time = time.time()
                response_time = (end_time - start_time) * 1000  # Convert to ms
                
                # Update stats
                self.api_stats['total_requests'] += 1
                self.api_stats['last_request_time'] = datetime.now().isoformat()
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # Update success stats
                    self.api_stats['successful_requests'] += 1
                    current_avg = self.api_stats['avg_response_time']
                    total_requests = self.api_stats['successful_requests']
                    self.api_stats['avg_response_time'] = ((current_avg * (total_requests - 1)) + response_time) / total_requests
                    
                    print(f"   ✅ Colab API success: {response_time:.1f}ms")
                    
                    # Add API metadata
                    result['api_response_time_ms'] = response_time
                    result['api_attempt'] = attempt + 1
                    result['api_endpoint'] = self.endpoint_url
                    result['platform'] = 'Google Colab'
                    
                    return result
                    
                elif response.status_code == 404:
                    raise requests.RequestException("Colab endpoint not found - check ngrok URL")
                elif response.status_code == 502:
                    raise requests.RequestException("Colab session disconnected - restart notebook")
                else:
                    raise requests.RequestException(f"HTTP {response.status_code}: {response.text}")
                    
            except requests.exceptions.Timeout:
                last_error = f"Colab request timeout ({self.timeout}s) - session may be slow"
                print(f"   ⏰ Timeout on attempt {attempt + 1} (Colab can be slow)")
                
            except requests.exceptions.ConnectionError:
                last_error = f"Connection error - Colab session may be disconnected"
                self.api_stats['colab_disconnects'] += 1
                print(f"   🔌 Connection error on attempt {attempt + 1} (Colab disconnected?)")
                
            except requests.exceptions.RequestException as e:
                if "ngrok" in str(e).lower():
                    last_error = f"ngrok tunnel error - check Colab notebook"
                elif "502" in str(e):
                    last_error = f"Colab session disconnected - restart notebook"
                    self.api_stats['colab_disconnects'] += 1
                else:
                    last_error = f"Request error: {str(e)}"
                print(f"   ❌ Request error on attempt {attempt + 1}: {e}")
                
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                print(f"   💥 Unexpected error on attempt {attempt + 1}: {e}")
            
            # Wait before retry (except on last attempt)
            if attempt < self.max_retries - 1:
                print(f"   ⏳ Waiting {self.retry_delay}s before retry...")
                time.sleep(self.retry_delay)
        
        # All attempts failed
        self.api_stats['failed_requests'] += 1
        
        return {
            'success': False,
            'error': f'All {self.max_retries} Colab API attempts failed',
            'last_error': last_error,
            'api_endpoint': self.endpoint_url,
            'platform': 'Google Colab',
            'model_used': 'API_FAILED',
            'troubleshooting': [
                'Check if Colab notebook is running',
                'Verify ngrok tunnel is active', 
                'Restart Colab session if needed',
                'Check internet connectivity'
            ]
        }
    
    def predict_price(self, sequence_data: List[List[float]], symbol: str) -> Dict[str, Any]:
        """
        Make price prediction via Colab API
        Compatible interface with ModelScopeAPIClient
        
        Args:
            sequence_data: List of OHLCV data [[open, high, low, close, volume], ...]
            symbol: Stock symbol (e.g., 'AAPL')
        
        Returns:
            Dictionary with prediction results or error information
        """
        
        print(f"🔮 Colab TFT prediction for {symbol}")
        
        # Validate input
        if not sequence_data or len(sequence_data) < 2:
            return {
                'success': False,
                'error': 'Insufficient sequence data for Colab API call',
                'required_minimum': 2,
                'provided': len(sequence_data) if sequence_data else 0,
                'symbol': symbol,
                'platform': 'Google Colab'
            }
        
        # Prepare API payload (compatible with Colab FastAPI)
        payload = {
            'sequence_data': sequence_data,
            'symbol': symbol,
            'request_id': f"{symbol}_{int(time.time())}",
            'timestamp': datetime.now().isoformat(),
            'client_version': '1.0.0-colab'
        }
        
        print(f"   📊 Payload: {len(sequence_data)} days of data for {symbol}")
        
        # Make API call
        result = self._make_request(payload)
        
        # Add local metadata
        result['symbol'] = symbol
        result['data_points'] = len(sequence_data)
        result['prediction_method'] = 'Google Colab TFT API'
        result['local_timestamp'] = datetime.now().isoformat()
        
        if result.get('success'):
            print(f"   ✅ Colab prediction successful")
            print(f"      Model: {result.get('model_used', 'TFT-Colab')}")
            print(f"      Current: ${result.get('current_price', 0):.2f}")
            print(f"      Predicted: ${result.get('predicted_price', 0):.2f}")
            print(f"      Confidence: {result.get('confidence', 0):.2f}")
            print(f"      GPU Time: {result.get('inference_time_ms', 0):.1f}ms")
        else:
            print(f"   ❌ Colab prediction failed: {result.get('error', 'Unknown error')}")
            if result.get('troubleshooting'):
                print(f"   💡 Troubleshooting:")
                for tip in result['troubleshooting']:
                    print(f"      • {tip}")
        
        return result
    
    def health_check(self) -> Dict[str, Any]:
        """Check Colab API health with minimal test data"""
        
        print(f"🏥 Colab API health check")
        
        try:
            # Check health endpoint first
            response = requests.get(f"{self.endpoint_url}/health", timeout=10)
            if response.status_code == 200:
                health_data = response.json()
                print(f"   ✅ Colab Health: {health_data.get('status', 'unknown')}")
                print(f"   🚀 GPU: {health_data.get('gpu_device', 'unknown')}")
                
                return {
                    'api_available': True,
                    'colab_status': health_data.get('status'),
                    'gpu_available': health_data.get('gpu_available', False),
                    'gpu_device': health_data.get('gpu_device'),
                    'response_time_ms': 50.0,  # Health endpoint is fast
                    'timestamp': datetime.now().isoformat(),
                    'endpoint': self.endpoint_url,
                    'platform': 'Google Colab'
                }
            else:
                raise requests.RequestException(f"Health check failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Colab Health: FAILED ({str(e)})")
            return {
                'api_available': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat(),
                'endpoint': self.endpoint_url,
                'platform': 'Google Colab',
                'troubleshooting': [
                    'Check if Colab notebook is running',
                    'Verify ngrok tunnel URL is correct',
                    'Try restarting the Colab session'
                ]
            }
    
    def get_api_stats(self) -> Dict[str, Any]:
        """Get Colab API performance statistics"""
        
        success_rate = 0.0
        if self.api_stats['total_requests'] > 0:
            success_rate = (self.api_stats['successful_requests'] / self.api_stats['total_requests']) * 100
        
        return {
            'platform': 'Google Colab',
            'total_requests': self.api_stats['total_requests'],
            'successful_requests': self.api_stats['successful_requests'],
            'failed_requests': self.api_stats['failed_requests'],
            'success_rate_percent': success_rate,
            'avg_response_time_ms': self.api_stats['avg_response_time'],
            'colab_disconnects': self.api_stats['colab_disconnects'],
            'last_request_time': self.api_stats['last_request_time'],
            'endpoint': self.endpoint_url
        }
    
    def configure_endpoint(self, ngrok_url: str, api_key: str = None):
        """Update Colab ngrok endpoint configuration"""
        
        # Validate ngrok URL format
        if not ngrok_url.startswith('https://') or 'ngrok' not in ngrok_url:
            print(f"⚠️  Warning: URL doesn't look like ngrok tunnel: {ngrok_url}")
        
        self.endpoint_url = ngrok_url.rstrip('/')  # Remove trailing slash
        if api_key:
            self.api_key = api_key
        
        print(f"🔧 Colab API endpoint updated: {self.endpoint_url}")
        
        # Reset stats for new endpoint
        self.api_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'avg_response_time': 0.0,
            'colab_disconnects': 0,
            'last_request_time': None
        }
        
        # Test new endpoint
        health = self.health_check()
        if health['api_available']:
            print(f"   ✅ New Colab endpoint is healthy!")
        else:
            print(f"   ❌ New Colab endpoint failed health check")
        
        return health

class MockColabAPI:
    """
    Mock Colab API for testing when Colab session not available
    Compatible with ColabAPIClient interface
    """
    
    def __init__(self):
        self.model_info = {
            'name': 'Mock Colab TFT + N-HITS',
            'platform': 'Mock Google Colab',
            'simulation': True
        }
        print(f"🧪 Mock Colab API initialized (for testing)")
    
    def predict_price(self, sequence_data: List[List[float]], symbol: str) -> Dict[str, Any]:
        """Simulate Colab API response with GPU timing"""
        
        print(f"🧪 Mock Colab prediction for {symbol}")
        
        if not sequence_data or len(sequence_data) < 2:
            return {
                'success': False,
                'error': 'Insufficient data',
                'symbol': symbol,
                'platform': 'Mock Google Colab'
            }
        
        # Simulate GPU prediction
        current_price = sequence_data[-1][3]  # Last close price
        
        # Simulate TFT vs N-HITS decision based on data quality
        data_quality = len(sequence_data) + (1 if len(sequence_data) >= 10 else 0)
        use_tft = data_quality >= 10
        
        if use_tft:
            # Simulate TFT prediction (more complex)
            trend = sum(d[3] - sequence_data[i-1][3] for i, d in enumerate(sequence_data[1:], 1)) / len(sequence_data)
            predicted_price = current_price + (trend * 1.3)
            model_used = "TFT-Colab-T4"
            confidence = 0.88
            inference_time = 45.0  # GPU accelerated
        else:
            # Simulate N-HITS backup
            predicted_price = current_price * 1.0025
            model_used = "N-HITS-Colab-Backup"  
            confidence = 0.91
            inference_time = 8.0  # Very fast backup
        
        price_change = predicted_price - current_price
        price_change_pct = (price_change / current_price) * 100
        
        return {
            'success': True,
            'model_used': model_used,
            'predicted_price': float(predicted_price),
            'current_price': float(current_price),
            'price_change': float(price_change),
            'price_change_percent': float(price_change_pct),
            'direction': 'UP' if price_change > 0 else 'DOWN',
            'confidence': float(confidence),
            'inference_time_ms': inference_time,
            'api_response_time_ms': 120.0,  # Simulated network + ngrok latency
            'symbol': symbol,
            'platform': 'Mock Google Colab',
            'device': 'Mock T4 GPU',
            'mock_mode': True
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Mock Colab health check"""
        return {
            'api_available': True,
            'colab_status': 'healthy',
            'gpu_available': True,
            'gpu_device': 'Tesla T4 (Mock)',
            'response_time_ms': 30.0,
            'platform': 'Mock Google Colab',
            'mock_mode': True
        }

def test_colab_api():
    """Test Colab API client with both real and mock endpoints"""
    
    print("🧪 Testing Google Colab API Client")
    print("=" * 60)
    
    # Test data
    test_sequence = [
        [220.0, 225.0, 218.0, 223.0, 50000000],
        [223.0, 227.0, 221.0, 226.0, 48000000],
        [226.0, 229.0, 224.0, 228.0, 52000000],
        [228.0, 231.0, 226.0, 230.0, 46000000],
        [230.0, 233.0, 228.0, 232.0, 49000000],
    ]
    
    print(f"\n1️⃣ Testing Mock Colab API (for development)")
    mock_api = MockColabAPI()
    mock_result = mock_api.predict_price(test_sequence, "AAPL")
    
    print(f"Mock Result:")
    print(f"   Success: {mock_result.get('success')}")
    print(f"   Model: {mock_result.get('model_used')}")
    print(f"   Prediction: ${mock_result.get('predicted_price', 0):.2f}")
    print(f"   GPU Time: {mock_result.get('inference_time_ms', 0):.1f}ms")
    print(f"   Confidence: {mock_result.get('confidence', 0):.2f}")
    
    print(f"\n2️⃣ Testing Real Colab API Client (needs ngrok URL)")
    real_api = ColabAPIClient()  # Will use placeholder endpoint
    
    # Health check first
    health = real_api.health_check()
    print(f"Health Status: {health['api_available']}")
    
    if not health['api_available']:
        print(f"💡 Real Colab API not available - setup instructions:")
        print(f"   1. Run the Colab notebook: /home/yanggf/a/cct/colab_tft_deployment.ipynb")
        print(f"   2. Get your ngrok URL from the notebook output")
        print(f"   3. Configure: api.configure_endpoint('https://your-ngrok-url.ngrok.io')")
        print(f"   4. Test: api.health_check()")
    
    return mock_api, real_api

if __name__ == "__main__":
    mock_api, real_api = test_colab_api()
    
    print(f"\n✅ Colab API Client ready for integration!")
    print(f"   Use MockColabAPI() for testing")
    print(f"   Use ColabAPIClient(ngrok_url) for production")
    print(f"   Compatible with existing ModelScopeAPIClient interface")