#!/usr/bin/env python3
"""
Real N-HITS (Neural Hierarchical Interpolation for Time Series) Model
Production implementation for financial time series prediction
Uses NeuralForecast library for authentic N-HITS architecture
"""

import numpy as np
import pandas as pd
import torch
import warnings
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import yfinance as yf
import joblib
import os

warnings.filterwarnings('ignore')

try:
    from neuralforecast import NeuralForecast
    from neuralforecast.models import NHITS
    NEURALFORECAST_AVAILABLE = True
except ImportError:
    print("⚠️ NeuralForecast not available. Install with: pip install neuralforecast")
    NEURALFORECAST_AVAILABLE = False

class RealNHITSModel:
    """
    Real N-HITS (Neural Hierarchical Interpolation for Time Series) model
    
    Architecture:
    - Hierarchical stacks with multi-rate signal decomposition
    - MaxPooling downsampling and linear interpolation upsampling
    - MLP blocks with residual connections
    - Optimized for financial time series prediction
    """
    
    def __init__(self, 
                 sequence_length: int = 60,     # 60 trading days input
                 horizon: int = 5,              # 5-day prediction horizon
                 hidden_size: int = 512,        # Hidden layer size
                 n_blocks: int = 5,             # Number of N-HITS blocks
                 max_steps: int = 200,          # Training steps
                 batch_size: int = 32):
        
        self.sequence_length = sequence_length
        self.horizon = horizon
        self.hidden_size = hidden_size
        self.n_blocks = n_blocks
        self.max_steps = max_steps
        self.batch_size = batch_size
        
        self.model = None
        self.nf = None
        self.is_trained = False
        self.symbol = None
        
        # Model metadata
        self.model_type = "Neural Hierarchical Interpolation for Time Series"
        self.version = "1.0-Production"
        self.architecture = "Multi-rate hierarchical neural network"
        
        if not NEURALFORECAST_AVAILABLE:
            self._create_mock_model()
        else:
            self._create_nhits_model()
    
    def _create_nhits_model(self):
        """Create real N-HITS model using NeuralForecast"""
        try:
            self.model = NHITS(
                h=self.horizon,                    # Forecast horizon
                input_size=self.sequence_length,   # Input sequence length  
                max_steps=self.max_steps,          # Training steps
                batch_size=self.batch_size,        # Batch size
                n_blocks=self.n_blocks,            # N-HITS blocks
                mlp_units=[[self.hidden_size, self.hidden_size // 2]] * self.n_blocks,
                n_pool_kernel_size=[2, 2, 1],     # Hierarchical pooling
                n_freq_downsample=[2, 1, 1],      # Frequency downsampling
                interpolation_mode='linear',       # Linear interpolation
                dropout_prob_theta=0.1,           # Dropout for regularization
                activation='ReLU',                # Activation function
                scaler_type='robust',             # Robust scaling for financial data
                loss=torch.nn.MSELoss(),          # Mean squared error
                learning_rate=1e-3,               # Learning rate
                weight_decay=1e-5,                # L2 regularization
                val_check_steps=10,               # Validation frequency
            )
            
            print(f"✅ Real N-HITS model created:")
            print(f"   Architecture: {self.n_blocks} hierarchical blocks")
            print(f"   Input size: {self.sequence_length} days")
            print(f"   Forecast horizon: {self.horizon} days")
            print(f"   Hidden size: {self.hidden_size}")
            print(f"   Model parameters: ~{self._estimate_parameters()}K")
            
        except Exception as e:
            print(f"❌ Failed to create N-HITS model: {e}")
            self._create_mock_model()
    
    def _create_mock_model(self):
        """Create mock N-HITS for fallback (better than moving average)"""
        print("⚠️ Using mock N-HITS model (statistical approximation)")
        self.model = None
        self.is_mock = True
    
    def _estimate_parameters(self) -> int:
        """Estimate model parameters"""
        # Rough estimate based on architecture
        params = (
            self.sequence_length * self.hidden_size +  # Input layer
            self.hidden_size * self.hidden_size * self.n_blocks * 2 +  # MLP blocks
            self.hidden_size * self.horizon  # Output layer
        )
        return params // 1000
    
    def prepare_financial_data(self, symbol: str, period: str = "1y") -> pd.DataFrame:
        """
        Prepare financial data for N-HITS training
        
        Format: NeuralForecast expects ['unique_id', 'ds', 'y'] columns
        """
        try:
            # Get market data
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period)
            
            if hist.empty:
                raise ValueError(f"No data available for {symbol}")
            
            # Prepare for NeuralForecast format
            df = pd.DataFrame({
                'unique_id': symbol,
                'ds': hist.index,
                'y': hist['Close'].values
            })
            
            # Add additional features as exogenous variables
            df['volume'] = hist['Volume'].values
            df['high'] = hist['High'].values
            df['low'] = hist['Low'].values
            df['volatility'] = hist['Close'].pct_change().rolling(5).std()
            
            # Remove NaN values
            df = df.dropna()
            
            print(f"📊 Data prepared for {symbol}:")
            print(f"   Samples: {len(df)}")
            print(f"   Date range: {df['ds'].min().date()} to {df['ds'].max().date()}")
            print(f"   Features: {list(df.columns)}")
            
            return df
            
        except Exception as e:
            print(f"❌ Data preparation failed: {e}")
            return None
    
    def train(self, symbol: str, period: str = "2y") -> bool:
        """
        Train N-HITS model on financial data
        """
        try:
            if not NEURALFORECAST_AVAILABLE:
                return self._train_mock_model(symbol)
            
            print(f"🏋️ Training N-HITS model for {symbol}...")
            
            # Prepare data
            df = self.prepare_financial_data(symbol, period)
            if df is None:
                return False
            
            # Create NeuralForecast object
            self.nf = NeuralForecast(
                models=[self.model],
                freq='D'  # Daily frequency
            )
            
            # Train the model
            start_time = datetime.now()
            self.nf.fit(df)
            training_time = (datetime.now() - start_time).total_seconds()
            
            self.is_trained = True
            self.symbol = symbol
            
            print(f"✅ N-HITS training completed:")
            print(f"   Symbol: {symbol}")
            print(f"   Training time: {training_time:.1f}s")
            print(f"   Model ready for inference")
            
            return True
            
        except Exception as e:
            print(f"❌ N-HITS training failed: {e}")
            return self._train_mock_model(symbol)
    
    def _train_mock_model(self, symbol: str) -> bool:
        """Train mock statistical model as fallback"""
        print(f"⚠️ Training mock N-HITS for {symbol} (statistical approximation)")
        
        # Get recent data for statistical parameters
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="60d")
            
            if not hist.empty:
                # Store statistical parameters
                self.mock_params = {
                    'mean_return': hist['Close'].pct_change().mean(),
                    'volatility': hist['Close'].pct_change().std(),
                    'trend': (hist['Close'].iloc[-1] / hist['Close'].iloc[0]) ** (1/len(hist)) - 1,
                    'recent_prices': hist['Close'].values[-10:].tolist()
                }
                
                self.is_trained = True
                self.symbol = symbol
                print(f"✅ Mock N-HITS trained with statistical parameters")
                return True
        except:
            pass
        
        return False
    
    def predict(self, current_price: float, recent_prices: List[float] = None) -> Dict:
        """
        Generate N-HITS prediction
        
        Returns:
        - Predicted prices for horizon
        - Direction and confidence
        - Model metadata
        """
        try:
            start_time = datetime.now()
            
            if not self.is_trained:
                raise ValueError("Model not trained. Call train() first.")
            
            if NEURALFORECAST_AVAILABLE and self.nf is not None:
                result = self._predict_real_nhits(current_price, recent_prices)
            else:
                result = self._predict_mock_nhits(current_price, recent_prices)
            
            # Add timing and metadata
            inference_time = (datetime.now() - start_time).total_seconds() * 1000
            result.update({
                'inference_time_ms': round(inference_time, 2),
                'model_type': self.model_type,
                'model_version': self.version,
                'architecture': self.architecture,
                'symbol': self.symbol,
                'timestamp': datetime.now().isoformat()
            })
            
            return result
            
        except Exception as e:
            print(f"❌ N-HITS prediction failed: {e}")
            return self._fallback_prediction(current_price)
    
    def _predict_real_nhits(self, current_price: float, recent_prices: List[float]) -> Dict:
        """Real N-HITS neural network prediction"""
        
        # Create future dataframe for prediction
        future_df = pd.DataFrame({
            'unique_id': [self.symbol] * self.horizon,
            'ds': pd.date_range(
                start=datetime.now().date(), 
                periods=self.horizon, 
                freq='D'
            )
        })
        
        # Generate predictions
        forecasts = self.nf.predict(futr_df=future_df)
        
        # Extract prediction results
        predicted_prices = forecasts['NHITS'].values
        current_to_predicted = predicted_prices[0] if len(predicted_prices) > 0 else current_price
        
        # Calculate direction and confidence
        direction = 'UP' if current_to_predicted > current_price else 'DOWN'
        price_change = abs(current_to_predicted - current_price) / current_price
        confidence = min(0.85, 0.6 + price_change * 2)  # Higher confidence for bigger moves
        
        return {
            'predicted_price': float(current_to_predicted),
            'predicted_prices': predicted_prices.tolist(),
            'current_price': current_price,
            'direction': direction,
            'confidence': confidence,
            'signal_score': 0.7 if direction == 'UP' else -0.7,
            'model_used': 'Real-NHITS-Neural',
            'is_neural': True
        }
    
    def _predict_mock_nhits(self, current_price: float, recent_prices: List[float]) -> Dict:
        """Statistical N-HITS approximation using trend analysis"""
        
        params = getattr(self, 'mock_params', {})
        
        # Enhanced statistical prediction (better than simple moving averages)
        trend = params.get('trend', 0.001)
        volatility = params.get('volatility', 0.02)
        mean_return = params.get('mean_return', 0.001)
        
        # Multi-scale trend analysis (mimics N-HITS hierarchy)
        if recent_prices and len(recent_prices) >= 10:
            # Short-term trend (5 days)
            short_trend = (recent_prices[-1] - recent_prices[-5]) / recent_prices[-5] if len(recent_prices) >= 5 else 0
            # Medium-term trend (10 days)  
            medium_trend = (recent_prices[-1] - recent_prices[-10]) / recent_prices[-10]
            # Combined hierarchical trend
            combined_trend = 0.5 * short_trend + 0.3 * medium_trend + 0.2 * trend
        else:
            combined_trend = trend
        
        # Predict next price using hierarchical trend
        predicted_change = combined_trend + np.random.normal(mean_return, volatility * 0.5)
        predicted_price = current_price * (1 + predicted_change)
        
        # Direction and confidence
        direction = 'UP' if predicted_price > current_price else 'DOWN'
        confidence = min(0.75, 0.5 + abs(predicted_change) * 5)
        
        return {
            'predicted_price': float(predicted_price),
            'current_price': current_price,
            'direction': direction,
            'confidence': confidence,
            'signal_score': 0.6 if direction == 'UP' else -0.6,
            'model_used': 'Statistical-NHITS-Approximation',
            'is_neural': False,
            'note': 'Enhanced statistical model with hierarchical trend analysis'
        }
    
    def _fallback_prediction(self, current_price: float) -> Dict:
        """Ultimate fallback prediction"""
        return {
            'predicted_price': current_price,
            'current_price': current_price,
            'direction': 'NEUTRAL',
            'confidence': 0.5,
            'signal_score': 0.0,
            'model_used': 'Fallback',
            'error': 'Prediction failed',
            'is_neural': False
        }
    
    def save_model(self, filepath: str) -> bool:
        """Save trained model"""
        try:
            model_data = {
                'nf': self.nf,
                'symbol': self.symbol,
                'is_trained': self.is_trained,
                'model_params': {
                    'sequence_length': self.sequence_length,
                    'horizon': self.horizon,
                    'hidden_size': self.hidden_size,
                    'n_blocks': self.n_blocks
                },
                'mock_params': getattr(self, 'mock_params', {})
            }
            
            joblib.dump(model_data, filepath)
            print(f"✅ N-HITS model saved to {filepath}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to save model: {e}")
            return False
    
    def load_model(self, filepath: str) -> bool:
        """Load trained model"""
        try:
            if not os.path.exists(filepath):
                print(f"❌ Model file not found: {filepath}")
                return False
            
            model_data = joblib.load(filepath)
            self.nf = model_data.get('nf')
            self.symbol = model_data.get('symbol')
            self.is_trained = model_data.get('is_trained', False)
            self.mock_params = model_data.get('mock_params', {})
            
            print(f"✅ N-HITS model loaded from {filepath}")
            print(f"   Symbol: {self.symbol}")
            print(f"   Trained: {self.is_trained}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            return False

def test_real_nhits():
    """Test real N-HITS implementation"""
    
    print("🧪 Testing Real N-HITS Implementation")
    print("=" * 50)
    
    # Test symbols
    symbols = ['AAPL', 'TSLA', 'MSFT']
    
    for symbol in symbols:
        print(f"\n📈 Testing N-HITS for {symbol}")
        
        # Create and train model
        nhits = RealNHITSModel(
            sequence_length=30,  # Shorter for testing
            horizon=5,
            max_steps=50        # Fewer steps for testing
        )
        
        # Train model
        training_success = nhits.train(symbol, period="6mo")
        
        if training_success:
            # Get recent price for prediction
            ticker = yf.Ticker(symbol)
            recent = ticker.history(period="10d")
            current_price = recent['Close'].iloc[-1]
            recent_prices = recent['Close'].values.tolist()
            
            # Make prediction
            prediction = nhits.predict(current_price, recent_prices)
            
            print(f"📊 Prediction Results:")
            print(f"   Current: ${current_price:.2f}")
            print(f"   Predicted: ${prediction['predicted_price']:.2f}")
            print(f"   Direction: {prediction['direction']}")
            print(f"   Confidence: {prediction['confidence']:.3f}")
            print(f"   Signal: {prediction['signal_score']:.2f}")
            print(f"   Model: {prediction['model_used']}")
            print(f"   Neural: {prediction.get('is_neural', False)}")
            print(f"   Inference: {prediction.get('inference_time_ms', 0):.1f}ms")
        else:
            print(f"❌ Training failed for {symbol}")
    
    print(f"\n✅ N-HITS testing completed")

if __name__ == "__main__":
    test_real_nhits()