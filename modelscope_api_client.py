#!/usr/bin/env python3
"""
ModelScope API Client for TFT Primary + N-HITS Backup Cloud Integration
Connects local trading system to ModelScope deployed models
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
import warnings
warnings.filterwarnings('ignore')

class ModelScopeAPIClient:
    """
    Client for connecting to ModelScope deployed TFT + N-HITS models
    Handles API calls, error handling, and performance monitoring
    """
    
    def __init__(self, endpoint_url: str = None, api_key: str = None):
        # ModelScope endpoint (will be provided after activation)
        self.endpoint_url = endpoint_url or "https://your-modelscope-endpoint.com"
        self.api_key = api_key  # Optional API key for authentication
        
        # Configuration
        self.timeout = 10  # 10 second timeout
        self.max_retries = 3
        self.retry_delay = 1.0
        
        # Performance tracking
        self.api_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'avg_response_time': 0.0,
            'last_request_time': None
        }
        
        # Model info
        self.model_info = {
            'name': 'TFT Primary + N-HITS Backup',
            'deployment_url': 'https://www.modelscope.cn/models/yanggf2/tft-primary-nhits-backup-predictor',
            'version': '1.0.0',
            'capabilities': ['TFT Primary', 'N-HITS Backup', 'Automatic Fallback']
        }
        
        print(f"🌐 ModelScope API Client initialized")
        print(f"   Endpoint: {self.endpoint_url}")
        print(f"   Model: {self.model_info['name']}")
        print(f"   Deployment: {self.model_info['deployment_url']}")
    
    def _make_request(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Make HTTP request to ModelScope API with retry logic"""
        
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'TFT-Trading-System/1.0'
        }
        
        # Add API key if provided
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()
                
                print(f"🌐 Making API request to ModelScope (attempt {attempt + 1}/{self.max_retries})")
                
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
                    
                    print(f"   ✅ API success: {response_time:.1f}ms")
                    
                    # Add API metadata
                    result['api_response_time_ms'] = response_time
                    result['api_attempt'] = attempt + 1
                    result['api_endpoint'] = self.endpoint_url
                    
                    return result
                else:
                    raise requests.RequestException(f"HTTP {response.status_code}: {response.text}")
                    
            except requests.exceptions.Timeout:
                last_error = f"Request timeout ({self.timeout}s)"
                print(f"   ⏰ Timeout on attempt {attempt + 1}")
                
            except requests.exceptions.ConnectionError:
                last_error = f"Connection error to {self.endpoint_url}"
                print(f"   🔌 Connection error on attempt {attempt + 1}")
                
            except requests.exceptions.RequestException as e:
                last_error = f"Request error: {str(e)}"
                print(f"   ❌ Request error on attempt {attempt + 1}: {e}")
                
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                print(f"   💥 Unexpected error on attempt {attempt + 1}: {e}")
            
            # Wait before retry (except on last attempt)
            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay)
        
        # All attempts failed
        self.api_stats['failed_requests'] += 1
        
        return {
            'success': False,
            'error': f'All {self.max_retries} API attempts failed',
            'last_error': last_error,
            'api_endpoint': self.endpoint_url,
            'model_used': 'API_FAILED'
        }
    
    def predict_price(self, sequence_data: List[List[float]], symbol: str) -> Dict[str, Any]:
        """
        Make price prediction via ModelScope API
        
        Args:
            sequence_data: List of OHLCV data [[open, high, low, close, volume], ...]
            symbol: Stock symbol (e.g., 'AAPL')
        
        Returns:
            Dictionary with prediction results or error information
        """
        
        print(f"🔮 ModelScope API prediction for {symbol}")
        
        # Validate input
        if not sequence_data or len(sequence_data) < 2:
            return {
                'success': False,
                'error': 'Insufficient sequence data for API call',
                'required_minimum': 2,
                'provided': len(sequence_data) if sequence_data else 0,
                'symbol': symbol
            }
        
        # Prepare API payload
        payload = {
            'sequence_data': sequence_data,
            'symbol': symbol,
            'request_id': f"{symbol}_{int(time.time())}",
            'timestamp': datetime.now().isoformat(),
            'client_version': '1.0.0'
        }
        
        print(f"   📊 Payload: {len(sequence_data)} days of data for {symbol}")
        
        # Make API call
        result = self._make_request(payload)
        
        # Add local metadata
        result['symbol'] = symbol
        result['data_points'] = len(sequence_data)
        result['prediction_method'] = 'ModelScope Cloud API'
        result['local_timestamp'] = datetime.now().isoformat()
        
        if result.get('success'):
            print(f"   ✅ ModelScope prediction successful")
            print(f"      Model: {result.get('model_used', 'Unknown')}")
            print(f"      Current: ${result.get('current_price', 0):.2f}")
            print(f"      Predicted: ${result.get('predicted_price', 0):.2f}")
            print(f"      Confidence: {result.get('confidence', 0):.2f}")
        else:
            print(f"   ❌ ModelScope prediction failed: {result.get('error', 'Unknown error')}")
        
        return result
    
    def health_check(self) -> Dict[str, Any]:
        """Check API health with minimal test data"""
        
        print(f"🏥 ModelScope API health check")
        
        # Minimal test data
        test_data = [
            [100.0, 105.0, 99.0, 103.0, 1000000],
            [103.0, 106.0, 102.0, 105.0, 1100000]
        ]
        
        result = self.predict_price(test_data, "TEST")
        
        health_status = {
            'api_available': result.get('success', False),
            'response_time_ms': result.get('api_response_time_ms', 0),
            'model_responding': result.get('model_used', 'None') != 'API_FAILED',
            'timestamp': datetime.now().isoformat(),
            'endpoint': self.endpoint_url,
            'test_result': result
        }
        
        if health_status['api_available']:
            print(f"   ✅ API Health: GOOD ({health_status['response_time_ms']:.1f}ms)")
        else:
            print(f"   ❌ API Health: FAILED ({result.get('error', 'Unknown')})")
        
        return health_status
    
    def get_api_stats(self) -> Dict[str, Any]:
        """Get API performance statistics"""
        
        success_rate = 0.0
        if self.api_stats['total_requests'] > 0:
            success_rate = (self.api_stats['successful_requests'] / self.api_stats['total_requests']) * 100
        
        return {
            'total_requests': self.api_stats['total_requests'],
            'successful_requests': self.api_stats['successful_requests'],
            'failed_requests': self.api_stats['failed_requests'],
            'success_rate_percent': success_rate,
            'avg_response_time_ms': self.api_stats['avg_response_time'],
            'last_request_time': self.api_stats['last_request_time'],
            'endpoint': self.endpoint_url
        }
    
    def configure_endpoint(self, endpoint_url: str, api_key: str = None):
        """Update API endpoint configuration"""
        
        self.endpoint_url = endpoint_url
        if api_key:
            self.api_key = api_key
        
        print(f"🔧 ModelScope API endpoint updated: {endpoint_url}")
        
        # Reset stats for new endpoint
        self.api_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'avg_response_time': 0.0,
            'last_request_time': None
        }

class MockModelScopeAPI:
    """
    Mock ModelScope API for testing when real endpoint not available
    Simulates TFT Primary + N-HITS Backup responses
    """
    
    def __init__(self):
        self.model_info = {
            'name': 'Mock TFT + N-HITS',
            'mode': 'TESTING',
            'simulation': True
        }
        print(f"🧪 Mock ModelScope API initialized (for testing)")
    
    def predict_price(self, sequence_data: List[List[float]], symbol: str) -> Dict[str, Any]:
        """Simulate ModelScope API response"""
        
        print(f"🧪 Mock ModelScope prediction for {symbol}")
        
        if not sequence_data or len(sequence_data) < 2:
            return {
                'success': False,
                'error': 'Insufficient data',
                'symbol': symbol
            }
        
        # Simulate prediction based on data
        current_price = sequence_data[-1][3]  # Last close price
        
        # Simulate TFT vs N-HITS decision
        use_tft = len(sequence_data) >= 10  # TFT needs more data
        
        if use_tft:
            # Simulate TFT prediction
            trend = sum(d[3] - sequence_data[i-1][3] for i, d in enumerate(sequence_data[1:], 1)) / len(sequence_data)
            predicted_price = current_price + (trend * 1.2)  # TFT extrapolation
            model_used = "TFT (Primary)"
            confidence = 0.85
            inference_time = 75.0
        else:
            # Simulate N-HITS backup
            predicted_price = current_price * 1.002  # Small positive trend
            model_used = "N-HITS (Backup)"  
            confidence = 0.92
            inference_time = 5.0
        
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
            'api_response_time_ms': 150.0,  # Simulated network time
            'symbol': symbol,
            'deployment': 'Mock ModelScope',
            'system': 'TFT Primary + N-HITS Backup (Simulated)',
            'mock_mode': True
        }
    
    def health_check(self) -> Dict[str, Any]:
        """Mock health check"""
        return {
            'api_available': True,
            'response_time_ms': 50.0,
            'model_responding': True,
            'mock_mode': True,
            'status': 'Mock API Ready'
        }

def test_modelscope_api():
    """Test ModelScope API client with both real and mock endpoints"""
    
    print("🧪 Testing ModelScope API Client")
    print("=" * 60)
    
    # Test data
    test_sequence = [
        [220.0, 225.0, 218.0, 223.0, 50000000],
        [223.0, 227.0, 221.0, 226.0, 48000000],
        [226.0, 229.0, 224.0, 228.0, 52000000],
        [228.0, 231.0, 226.0, 230.0, 46000000],
        [230.0, 233.0, 228.0, 232.0, 49000000],
    ]
    
    print(f"\n1️⃣ Testing Mock API (for development)")
    mock_api = MockModelScopeAPI()
    mock_result = mock_api.predict_price(test_sequence, "AAPL")
    
    print(f"Mock Result:")
    print(f"   Success: {mock_result.get('success')}")
    print(f"   Model: {mock_result.get('model_used')}")
    print(f"   Prediction: ${mock_result.get('predicted_price', 0):.2f}")
    print(f"   Confidence: {mock_result.get('confidence', 0):.2f}")
    
    print(f"\n2️⃣ Testing Real API Client (needs endpoint)")
    real_api = ModelScopeAPIClient()  # Will use placeholder endpoint
    
    # Health check first
    health = real_api.health_check()
    print(f"Health Status: {health['api_available']}")
    
    if not health['api_available']:
        print(f"💡 Real API not available - configure endpoint first:")
        print(f"   api.configure_endpoint('https://your-real-modelscope-endpoint.com')")
    
    return mock_api, real_api

if __name__ == "__main__":
    mock_api, real_api = test_modelscope_api()
    
    print(f"\n✅ ModelScope API Client ready for integration!")
    print(f"   Use MockModelScopeAPI() for testing")
    print(f"   Use ModelScopeAPIClient(endpoint_url) for production")