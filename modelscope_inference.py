
import json
import numpy as np
import pickle

class LSTMStockPredictor:
    def __init__(self):
        # Load model weights
        with open('lstm_model_weights.json', 'r') as f:
            model_data = json.load(f)
        
        self.W1 = np.array(model_data['W1'])
        self.b1 = np.array(model_data['b1'])
        self.W2 = np.array(model_data['W2'])
        self.b2 = np.array(model_data['b2'])
        self.input_size = model_data['input_size']
        self.hidden_size = model_data['hidden_size']
        self.sequence_length = model_data['sequence_length']
        
        # Load scaler
        with open('scaler.pkl', 'rb') as f:
            self.scaler = pickle.load(f)
        
        self.features = ['Open', 'High', 'Low', 'Close', 'Volume']
    
    def sigmoid(self, x):
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))
    
    def predict_price(self, sequence_data):
        """
        Predict stock price from sequence data
        sequence_data: list of lists with OHLCV data for last 10 days
        Format: [[open, high, low, close, volume], ...]
        """
        try:
            # Convert to numpy array
            sequence = np.array(sequence_data)
            
            if sequence.shape != (10, 5):
                raise ValueError(f"Expected shape (10, 5), got {sequence.shape}")
            
            # Scale the input data
            scaled_sequence = self.scaler.transform(sequence)
            
            # Prepare for model input
            X_flat = scaled_sequence.reshape(1, -1)
            
            # Forward pass
            z1 = np.dot(X_flat, self.W1) + self.b1
            a1 = self.sigmoid(z1)
            z2 = np.dot(a1, self.W2) + self.b2
            prediction_scaled = z2[0, 0]
            
            # Reconstruct full feature vector for inverse transform
            last_features = scaled_sequence[-1].copy()
            last_features[3] = prediction_scaled  # Update close price
            
            # Inverse transform
            prediction_full = self.scaler.inverse_transform(last_features.reshape(1, -1))
            predicted_close = float(prediction_full[0, 3])
            
            # Calculate confidence based on recent volatility
            recent_prices = [day[3] for day in sequence_data[-5:]]  # Last 5 close prices
            volatility = np.std(recent_prices) / np.mean(recent_prices)
            confidence = max(0.5, min(0.95, 0.8 - volatility * 2))
            
            return {
                'predicted_price': round(predicted_close, 2),
                'confidence': round(confidence, 2),
                'model_type': 'LSTM',
                'version': '2.0',
                'features_used': self.features
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'predicted_price': None,
                'confidence': 0.0
            }

# ModelScope deployment interface
predictor_instance = None

def model_fn(model_dir):
    global predictor_instance
    if predictor_instance is None:
        predictor_instance = LSTMStockPredictor()
    return predictor_instance

def input_fn(request_body, content_type='application/json'):
    data = json.loads(request_body)
    return data.get('sequence_data', [])

def predict_fn(input_data, model):
    return model.predict_price(input_data)

def output_fn(prediction, accept='application/json'):
    return json.dumps(prediction)

# Local testing
if __name__ == "__main__":
    predictor = LSTMStockPredictor()
    
    # Test with sample data (OHLCV format)
    sample_data = [
        [150.0, 152.0, 149.5, 151.0, 1000000],
        [151.0, 153.0, 150.5, 152.5, 1100000],
        [152.5, 154.0, 151.0, 153.0, 950000],
        [153.0, 154.5, 152.0, 153.5, 1200000],
        [153.5, 155.0, 152.5, 154.0, 980000],
        [154.0, 155.5, 153.0, 154.5, 1050000],
        [154.5, 156.0, 153.5, 155.0, 1100000],
        [155.0, 156.5, 154.0, 155.5, 990000],
        [155.5, 157.0, 154.5, 156.0, 1150000],
        [156.0, 157.5, 155.0, 156.5, 1000000]
    ]
    
    result = predictor.predict_price(sample_data)
    print("Test result:", json.dumps(result, indent=2))
