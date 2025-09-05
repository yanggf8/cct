# ModelScope Custom Model Deployment Specification

## TFT + N-HITS Model Deployment Architecture

### Directory Structure
```
tft-nhits-predictor/
├── model.py                 # TFT + N-HITS model classes
├── pipeline.py              # Custom inference pipeline
├── configuration.json       # ModelScope configuration
├── requirements.txt         # Python dependencies
├── models/
│   ├── tft_model.onnx       # Optimized TFT model
│   └── nhits_model.onnx     # Optimized N-HITS model
└── utils/
    ├── preprocessing.py     # Data preprocessing utilities
    └── ensemble.py          # Ensemble logic for dual models
```

### Configuration File (configuration.json)
```json
{
    "framework": "pytorch",
    "task": "time-series-forecasting",
    "model-revision": "v1.0",
    "pipeline": {
        "type": "time-series-forecasting"
    },
    "model": {
        "type": "DualModelPredictor",
        "file": "model.py"
    },
    "preprocessor": {
        "type": "TimeSeriesPreprocessor", 
        "file": "pipeline.py"
    },
    "inference": {
        "max_batch_size": 5,
        "timeout": 30,
        "gpu_memory": "2GB"
    },
    "endpoints": {
        "predict": "/predict",
        "health": "/health",
        "metrics": "/metrics"
    }
}
```

### Model Implementation (model.py)
```python
import torch
import torch.nn as nn
import onnxruntime as ort
import numpy as np
from typing import Dict, List, Tuple, Optional

class DualModelPredictor(nn.Module):
    """Dual TFT + N-HITS predictor with ensemble logic"""
    
    def __init__(self, model_dir: str = "./models"):
        super().__init__()
        self.model_dir = model_dir
        self.tft_session = None
        self.nhits_session = None
        self.load_models()
    
    def load_models(self):
        """Load ONNX models for GPU inference"""
        providers = [
            ('CUDAExecutionProvider', {'device_id': 0}),
            'CPUExecutionProvider'
        ]
        
        # Load TFT model
        tft_path = f"{self.model_dir}/tft_model.onnx"
        self.tft_session = ort.InferenceSession(tft_path, providers=providers)
        
        # Load N-HITS model
        nhits_path = f"{self.model_dir}/nhits_model.onnx"
        self.nhits_session = ort.InferenceSession(nhits_path, providers=providers)
    
    def forward(self, input_data: Dict) -> Dict:
        """
        Run dual model prediction with ensemble
        
        Args:
            input_data: {
                "ohlcv": np.array(shape=[batch, sequence, features]),
                "symbol": str,
                "current_price": float
            }
            
        Returns:
            {
                "tft_prediction": float,
                "nhits_prediction": float, 
                "ensemble_prediction": float,
                "confidence": float,
                "model_weights": {"tft": float, "nhits": float},
                "metadata": dict
            }
        """
        
        try:
            # Prepare inputs for both models
            ohlcv_data = input_data["ohlcv"]
            current_price = input_data["current_price"]
            
            # TFT Prediction
            tft_inputs = {self.tft_session.get_inputs()[0].name: ohlcv_data}
            tft_output = self.tft_session.run(None, tft_inputs)[0]
            tft_prediction = current_price * (1 + tft_output[0])
            
            # N-HITS Prediction
            nhits_inputs = {self.nhits_session.get_inputs()[0].name: ohlcv_data}
            nhits_output = self.nhits_session.run(None, nhits_inputs)[0]
            nhits_prediction = current_price * (1 + nhits_output[0])
            
            # Ensemble Logic (55% TFT, 45% N-HITS with consensus bonus)
            tft_weight = 0.55
            nhits_weight = 0.45
            
            # Check directional consensus
            tft_direction = 1 if tft_output[0] > 0 else -1
            nhits_direction = 1 if nhits_output[0] > 0 else -1
            consensus = tft_direction == nhits_direction
            
            if consensus:
                # Boost confidence by 10% for consensus
                confidence_boost = 0.1
                tft_weight += confidence_boost * 0.5
                nhits_weight += confidence_boost * 0.5
            
            ensemble_prediction = (
                tft_prediction * tft_weight + 
                nhits_prediction * nhits_weight
            )
            
            # Calculate confidence based on model agreement
            prediction_spread = abs(tft_prediction - nhits_prediction) / current_price
            confidence = max(0.1, min(0.99, 1.0 - prediction_spread * 10))
            
            if consensus:
                confidence = min(0.99, confidence + 0.1)
            
            return {
                "tft_prediction": float(tft_prediction),
                "nhits_prediction": float(nhits_prediction),
                "ensemble_prediction": float(ensemble_prediction),
                "confidence": float(confidence),
                "model_weights": {
                    "tft": float(tft_weight),
                    "nhits": float(nhits_weight)
                },
                "metadata": {
                    "consensus": consensus,
                    "prediction_spread": float(prediction_spread),
                    "tft_change": float(tft_output[0]),
                    "nhits_change": float(nhits_output[0]),
                    "current_price": float(current_price),
                    "model_latency_ms": 0  # Will be measured in pipeline
                }
            }
            
        except Exception as e:
            raise RuntimeError(f"Prediction failed: {str(e)}")

class TimeSeriesPreprocessor:
    """Preprocessor for OHLCV time series data"""
    
    def __init__(self):
        self.sequence_length = 20
        self.feature_count = 7  # OHLCV + VWAP + Volume SMA + Volatility
    
    def preprocess(self, raw_data: List[Dict]) -> np.ndarray:
        """
        Convert raw OHLCV data to model input format
        
        Args:
            raw_data: List of {open, high, low, close, volume, date} dicts
            
        Returns:
            np.ndarray: Preprocessed features [1, sequence_length, feature_count]
        """
        
        if len(raw_data) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} data points")
        
        # Take last sequence_length points
        data = raw_data[-self.sequence_length:]
        
        features = []
        for i, point in enumerate(data):
            # Basic OHLCV
            feature_row = [
                float(point['open']),
                float(point['high']),
                float(point['low']),
                float(point['close']),
                float(point['volume'])
            ]
            
            # Calculate VWAP (Volume Weighted Average Price)
            if i >= 4:  # Need at least 5 points for VWAP
                recent_data = data[i-4:i+1]
                total_value = sum(d['close'] * d['volume'] for d in recent_data)
                total_volume = sum(d['volume'] for d in recent_data)
                vwap = total_value / total_volume if total_volume > 0 else point['close']
            else:
                vwap = point['close']
            
            feature_row.append(float(vwap))
            
            # Calculate 5-day volume SMA
            if i >= 4:
                volume_sma = sum(d['volume'] for d in data[i-4:i+1]) / 5
            else:
                volume_sma = point['volume']
            
            feature_row.append(float(volume_sma))
            
            features.append(feature_row)
        
        # Convert to numpy array and normalize
        features = np.array(features, dtype=np.float32)
        
        # Simple min-max normalization per feature
        for i in range(features.shape[1]):
            col = features[:, i]
            if col.max() != col.min():
                features[:, i] = (col - col.min()) / (col.max() - col.min())
        
        # Add batch dimension
        return features.reshape(1, self.sequence_length, self.feature_count)
```

### Custom Pipeline (pipeline.py)
```python
import time
import logging
from typing import Dict, Any, List
from .model import DualModelPredictor, TimeSeriesPreprocessor

logger = logging.getLogger(__name__)

class TimeSeriesForecastingPipeline:
    """ModelScope pipeline for TFT + N-HITS prediction"""
    
    def __init__(self, model_dir: str):
        self.model = DualModelPredictor(model_dir)
        self.preprocessor = TimeSeriesPreprocessor()
        
    def __call__(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main pipeline inference method
        
        Args:
            inputs: {
                "symbols": ["AAPL", "MSFT", ...],  # List of symbols to predict
                "ohlcv_data": {
                    "AAPL": [{"open": 150.0, "high": 152.0, ...}, ...],
                    "MSFT": [{"open": 300.0, "high": 305.0, ...}, ...],
                    ...
                },
                "current_prices": {
                    "AAPL": 151.25,
                    "MSFT": 302.50,
                    ...
                }
            }
            
        Returns:
            {
                "predictions": {
                    "AAPL": {
                        "tft_prediction": 152.1,
                        "nhits_prediction": 151.8,
                        "ensemble_prediction": 151.95,
                        "confidence": 0.87,
                        ...
                    },
                    ...
                },
                "metadata": {
                    "total_latency_ms": 450,
                    "models_loaded": True,
                    "batch_size": 5
                }
            }
        """
        
        start_time = time.time()
        
        try:
            symbols = inputs["symbols"]
            ohlcv_data = inputs["ohlcv_data"]
            current_prices = inputs["current_prices"]
            
            predictions = {}
            
            for symbol in symbols:
                try:
                    # Preprocess OHLCV data
                    preprocessed_data = self.preprocessor.preprocess(ohlcv_data[symbol])
                    
                    # Prepare model input
                    model_input = {
                        "ohlcv": preprocessed_data,
                        "symbol": symbol,
                        "current_price": current_prices[symbol]
                    }
                    
                    # Get prediction
                    prediction = self.model.forward(model_input)
                    predictions[symbol] = prediction
                    
                except Exception as e:
                    logger.error(f"Prediction failed for {symbol}: {str(e)}")
                    predictions[symbol] = {
                        "error": str(e),
                        "tft_prediction": current_prices[symbol],
                        "nhits_prediction": current_prices[symbol], 
                        "ensemble_prediction": current_prices[symbol],
                        "confidence": 0.1
                    }
            
            total_latency = int((time.time() - start_time) * 1000)
            
            return {
                "predictions": predictions,
                "metadata": {
                    "total_latency_ms": total_latency,
                    "models_loaded": True,
                    "batch_size": len(symbols),
                    "timestamp": int(time.time())
                }
            }
            
        except Exception as e:
            logger.error(f"Pipeline failed: {str(e)}")
            return {
                "error": str(e),
                "predictions": {},
                "metadata": {
                    "total_latency_ms": int((time.time() - start_time) * 1000),
                    "models_loaded": False
                }
            }
```

### Requirements File (requirements.txt)
```
torch>=1.11.0
onnxruntime-gpu>=1.12.0
numpy>=1.21.0
scikit-learn>=1.0.0
pandas>=1.3.0
modelscope>=1.4.0
```

### Deployment Commands
```bash
# 1. Prepare model files (convert PyTorch to ONNX)
python convert_models_to_onnx.py

# 2. Upload to ModelScope
modelscope upload --model-id yanggf/tft-nhits-predictor --model-dir ./tft-nhits-predictor

# 3. Create deployment
modelscope deploy --model-id yanggf/tft-nhits-predictor --instance-type ecs.gn6i-c4g1.xlarge

# 4. Test endpoint
curl -X POST "https://deployment-endpoint.modelscope.cn/predict" \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["AAPL", "MSFT"],
    "ohlcv_data": {...},
    "current_prices": {"AAPL": 151.25, "MSFT": 302.50}
  }'
```