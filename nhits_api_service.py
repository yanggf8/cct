#!/usr/bin/env python3
"""
N-HITS API Service
Local API service that provides real N-HITS predictions
Can be called from Cloudflare Worker as backup when ModelScope TFT fails
"""

from flask import Flask, request, jsonify
import numpy as np
from real_nhits_model import RealNHITSModel
import yfinance as yf
from datetime import datetime
import threading
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global models cache
models_cache = {}
cache_lock = threading.Lock()

app = Flask(__name__)

class NHITSAPIService:
    def __init__(self, port=5000):
        self.port = port
        self.app = app
        self.setup_routes()
        
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'service': 'N-HITS API Service',
                'version': '1.0',
                'timestamp': datetime.now().isoformat(),
                'cached_models': list(models_cache.keys())
            })
        
        @self.app.route('/predict', methods=['POST'])
        def predict():
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'error': 'No JSON data provided'}), 400
                
                symbol = data.get('symbol')
                if not symbol:
                    return jsonify({'error': 'Symbol is required'}), 400
                
                # Get or create model for symbol
                model = self.get_or_create_model(symbol)
                
                # Get current market data
                current_price, recent_prices = self.get_market_data(symbol)
                if current_price is None:
                    return jsonify({'error': f'Could not fetch market data for {symbol}'}), 400
                
                # Make prediction
                prediction = model.predict(current_price, recent_prices)
                
                # Add API metadata
                prediction.update({
                    'api_version': '1.0',
                    'service': 'N-HITS API',
                    'symbol': symbol,
                    'prediction_time': datetime.now().isoformat()
                })
                
                return jsonify(prediction)
                
            except Exception as e:
                logger.error(f"Prediction error: {str(e)}")
                return jsonify({
                    'error': str(e),
                    'service': 'N-HITS API',
                    'timestamp': datetime.now().isoformat()
                }), 500
        
        @self.app.route('/train', methods=['POST'])
        def train_model():
            try:
                data = request.get_json()
                if not data:
                    return jsonify({'error': 'No JSON data provided'}), 400
                
                symbol = data.get('symbol')
                period = data.get('period', '1y')
                
                if not symbol:
                    return jsonify({'error': 'Symbol is required'}), 400
                
                # Create and train new model
                model = RealNHITSModel(
                    sequence_length=30,  # Optimize for API speed
                    horizon=5,
                    max_steps=100
                )
                
                success = model.train(symbol, period)
                
                if success:
                    # Cache the trained model
                    with cache_lock:
                        models_cache[symbol] = model
                    
                    return jsonify({
                        'success': True,
                        'symbol': symbol,
                        'period': period,
                        'model_type': model.model_type,
                        'is_neural': hasattr(model, 'nf') and model.nf is not None,
                        'timestamp': datetime.now().isoformat()
                    })
                else:
                    return jsonify({
                        'success': False,
                        'symbol': symbol,
                        'error': 'Training failed',
                        'timestamp': datetime.now().isoformat()
                    }), 500
                    
            except Exception as e:
                logger.error(f"Training error: {str(e)}")
                return jsonify({
                    'error': str(e),
                    'service': 'N-HITS API',
                    'timestamp': datetime.now().isoformat()
                }), 500
        
        @self.app.route('/models', methods=['GET'])
        def list_models():
            """List all cached models"""
            with cache_lock:
                model_info = {}
                for symbol, model in models_cache.items():
                    model_info[symbol] = {
                        'symbol': model.symbol,
                        'is_trained': model.is_trained,
                        'model_type': model.model_type,
                        'is_neural': hasattr(model, 'nf') and model.nf is not None,
                        'sequence_length': model.sequence_length,
                        'horizon': model.horizon
                    }
            
            return jsonify({
                'cached_models': model_info,
                'total_models': len(models_cache),
                'timestamp': datetime.now().isoformat()
            })
    
    def get_or_create_model(self, symbol: str) -> RealNHITSModel:
        """Get cached model or create new one"""
        with cache_lock:
            if symbol in models_cache:
                return models_cache[symbol]
            
            # Create new model
            logger.info(f"Creating new N-HITS model for {symbol}")
            model = RealNHITSModel(
                sequence_length=30,  # Optimized for speed
                horizon=5,
                max_steps=50  # Quick training for API
            )
            
            # Train the model
            success = model.train(symbol, period="6mo")
            if success:
                models_cache[symbol] = model
                logger.info(f"Model for {symbol} trained and cached")
            else:
                logger.warning(f"Training failed for {symbol}, using untrained model")
                models_cache[symbol] = model
            
            return model
    
    def get_market_data(self, symbol: str):
        """Get current market data for prediction"""
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="30d")  # Last 30 days
            
            if hist.empty:
                return None, None
            
            current_price = hist['Close'].iloc[-1]
            recent_prices = hist['Close'].values.tolist()[-20:]  # Last 20 days
            
            return float(current_price), recent_prices
            
        except Exception as e:
            logger.error(f"Failed to get market data for {symbol}: {e}")
            return None, None
    
    def run(self, debug=False, threaded=True):
        """Run the API service"""
        logger.info(f"🚀 Starting N-HITS API Service on port {self.port}")
        logger.info(f"   Service URL: http://localhost:{self.port}")
        logger.info(f"   Health check: http://localhost:{self.port}/health")
        logger.info(f"   Prediction endpoint: POST http://localhost:{self.port}/predict")
        
        self.app.run(
            host='0.0.0.0',
            port=self.port,
            debug=debug,
            threaded=threaded,
            use_reloader=False  # Avoid reloading issues with threading
        )

def test_nhits_api():
    """Test the N-HITS API service"""
    import requests
    import json
    
    base_url = "http://localhost:5000"
    
    print("🧪 Testing N-HITS API Service")
    print("=" * 40)
    
    # Test health check
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            health_data = response.json()
            print("✅ Health check passed")
            print(f"   Status: {health_data['status']}")
            print(f"   Service: {health_data['service']}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Could not connect to API: {e}")
        return
    
    # Test prediction
    test_symbols = ['AAPL', 'TSLA']
    
    for symbol in test_symbols:
        print(f"\n📈 Testing prediction for {symbol}")
        
        try:
            response = requests.post(
                f"{base_url}/predict",
                json={'symbol': symbol},
                timeout=30
            )
            
            if response.status_code == 200:
                pred_data = response.json()
                print("✅ Prediction successful")
                print(f"   Current: ${pred_data.get('current_price', 0):.2f}")
                print(f"   Predicted: ${pred_data.get('predicted_price', 0):.2f}")
                print(f"   Direction: {pred_data.get('direction', 'N/A')}")
                print(f"   Confidence: {pred_data.get('confidence', 0):.3f}")
                print(f"   Model: {pred_data.get('model_used', 'N/A')}")
                print(f"   Neural: {pred_data.get('is_neural', False)}")
                print(f"   Inference: {pred_data.get('inference_time_ms', 0):.1f}ms")
            else:
                print(f"❌ Prediction failed: {response.status_code}")
                print(f"   Error: {response.text}")
                
        except Exception as e:
            print(f"❌ Prediction request failed: {e}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        # Run API in background and test it
        import threading
        import time
        
        # Start API service in background thread
        service = NHITSAPIService(port=5000)
        api_thread = threading.Thread(target=service.run, daemon=True)
        api_thread.start()
        
        # Wait for service to start
        time.sleep(3)
        
        # Run tests
        test_nhits_api()
        
    else:
        # Run API service normally
        service = NHITSAPIService(port=5000)
        service.run(debug=False)