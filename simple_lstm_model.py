#!/usr/bin/env python3
"""
Simple LSTM Model for Financial Time Series Prediction (POC)
Designed for ONNX export and potential Cloudflare Workers AI deployment
"""

import numpy as np
import torch
import torch.nn as nn
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
import joblib
import json
from datetime import datetime, timedelta

class SimpleLSTM(nn.Module):
    """
    Lightweight LSTM model optimized for ONNX conversion and edge deployment
    - Small parameter count (<1M parameters)
    - Simple architecture for reliable ONNX export
    - Financial time series focus
    """
    
    def __init__(self, input_size=5, hidden_size=64, num_layers=2, output_size=1, dropout=0.1):
        super(SimpleLSTM, self).__init__()
        
        # Keep model small for edge deployment
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size, 
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        
        # Output layers
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size, output_size)
        
    def forward(self, x):
        # x shape: (batch_size, seq_len, input_size)
        
        # Initialize hidden state
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        # LSTM forward pass
        lstm_out, _ = self.lstm(x, (h0, c0))
        
        # Take the last output
        last_output = lstm_out[:, -1, :]
        
        # Apply dropout and final linear layer
        output = self.dropout(last_output)
        output = self.fc(output)
        
        return output

class FinancialLSTMPredictor:
    """
    Complete financial LSTM prediction system with data preprocessing
    """
    
    def __init__(self, sequence_length=30):
        self.sequence_length = sequence_length
        self.model = None
        self.scaler = MinMaxScaler()
        self.feature_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        
    def prepare_data(self, data, target_column='Close'):
        """
        Prepare time series data for LSTM training
        
        Args:
            data: DataFrame with OHLCV columns
            target_column: Column to predict
            
        Returns:
            X, y tensors ready for training
        """
        # Ensure we have the required columns
        if not all(col in data.columns for col in self.feature_columns):
            raise ValueError(f"Data must contain columns: {self.feature_columns}")
        
        # Scale the features
        scaled_data = self.scaler.fit_transform(data[self.feature_columns])
        
        # Create sequences
        X, y = [], []
        for i in range(self.sequence_length, len(scaled_data)):
            X.append(scaled_data[i-self.sequence_length:i])
            y.append(scaled_data[i, self.feature_columns.index(target_column)])
            
        X = np.array(X)
        y = np.array(y)
        
        return torch.FloatTensor(X), torch.FloatTensor(y.reshape(-1, 1))
    
    def create_model(self, input_size=5):
        """Create the LSTM model"""
        self.model = SimpleLSTM(
            input_size=input_size,
            hidden_size=64,  # Keep small for edge deployment
            num_layers=2,
            output_size=1,
            dropout=0.1
        )
        return self.model
        
    def train_model(self, X_train, y_train, epochs=100, learning_rate=0.001):
        """
        Train the LSTM model
        
        Args:
            X_train: Training sequences
            y_train: Training targets
            epochs: Number of training epochs
            learning_rate: Learning rate
        """
        if self.model is None:
            self.create_model(input_size=X_train.shape[2])
            
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)
        
        # Training loop
        self.model.train()
        train_losses = []
        
        for epoch in range(epochs):
            optimizer.zero_grad()
            
            # Forward pass
            outputs = self.model(X_train)
            loss = criterion(outputs, y_train)
            
            # Backward pass
            loss.backward()
            optimizer.step()
            
            train_losses.append(loss.item())
            
            if epoch % 20 == 0:
                print(f'Epoch [{epoch}/{epochs}], Loss: {loss.item():.6f}')
        
        return train_losses
    
    def predict(self, X_test):
        """Make predictions"""
        self.model.eval()
        with torch.no_grad():
            predictions = self.model(X_test)
            
        # Inverse transform predictions
        # Create dummy array for inverse transform
        dummy_features = np.zeros((len(predictions), len(self.feature_columns)))
        dummy_features[:, self.feature_columns.index('Close')] = predictions.numpy().flatten()
        
        # Inverse transform to get actual prices
        inverse_scaled = self.scaler.inverse_transform(dummy_features)
        actual_predictions = inverse_scaled[:, self.feature_columns.index('Close')]
        
        return actual_predictions
    
    def export_to_onnx(self, filepath='simple_lstm.onnx'):
        """
        Export model to ONNX format for edge deployment
        
        Args:
            filepath: Output ONNX file path
        """
        if self.model is None:
            raise ValueError("Model not trained yet")
            
        # Set model to evaluation mode
        self.model.eval()
        
        # Create dummy input for ONNX export
        dummy_input = torch.randn(1, self.sequence_length, len(self.feature_columns))
        
        # Export to ONNX
        torch.onnx.export(
            self.model,
            dummy_input,
            filepath,
            export_params=True,
            opset_version=11,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
        
        print(f"Model exported to ONNX: {filepath}")
        
        # Check model size
        import os
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"ONNX model size: {size_mb:.2f} MB")
        
        return filepath
    
    def save_model_artifacts(self, model_path='lstm_artifacts'):
        """Save all model artifacts for deployment"""
        import os
        os.makedirs(model_path, exist_ok=True)
        
        # Save scaler
        joblib.dump(self.scaler, f'{model_path}/scaler.pkl')
        
        # Save model configuration
        config = {
            'sequence_length': self.sequence_length,
            'feature_columns': self.feature_columns,
            'model_params': {
                'input_size': len(self.feature_columns),
                'hidden_size': 64,
                'num_layers': 2,
                'output_size': 1
            }
        }
        
        with open(f'{model_path}/config.json', 'w') as f:
            json.dump(config, f, indent=2)
            
        # Save PyTorch model
        torch.save(self.model.state_dict(), f'{model_path}/model_weights.pth')
        
        print(f"Model artifacts saved to: {model_path}")

def generate_sample_data(days=365):
    """
    Generate sample financial data for testing
    """
    dates = pd.date_range(start='2023-01-01', periods=days, freq='D')
    
    # Simulate realistic stock price movements
    np.random.seed(42)
    close_prices = []
    initial_price = 100.0
    
    for i in range(days):
        if i == 0:
            price = initial_price
        else:
            # Random walk with slight upward trend
            change = np.random.normal(0.001, 0.02)  # 0.1% daily drift, 2% volatility
            price = close_prices[-1] * (1 + change)
        
        close_prices.append(price)
    
    # Generate OHLCV data
    data = []
    for i, (date, close) in enumerate(zip(dates, close_prices)):
        high = close * np.random.uniform(1.0, 1.05)
        low = close * np.random.uniform(0.95, 1.0)
        open_price = close_prices[i-1] if i > 0 else close
        volume = np.random.randint(100000, 1000000)
        
        data.append({
            'Date': date,
            'Open': open_price,
            'High': high,
            'Low': low,
            'Close': close,
            'Volume': volume
        })
    
    return pd.DataFrame(data)

def main():
    """
    Main function to train and export the simple LSTM model
    """
    print("🚀 Simple LSTM Financial Predictor - POC for Cloudflare Workers AI")
    print("=" * 70)
    
    # Generate sample data
    print("📊 Generating sample financial data...")
    data = generate_sample_data(days=500)
    
    # Initialize predictor
    predictor = FinancialLSTMPredictor(sequence_length=30)
    
    # Prepare data
    print("🔄 Preparing training data...")
    X, y = predictor.prepare_data(data)
    
    # Split data
    train_size = int(0.8 * len(X))
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]
    
    print(f"📈 Training data shape: {X_train.shape}")
    print(f"📈 Test data shape: {X_test.shape}")
    
    # Train model
    print("\n🤖 Training LSTM model...")
    predictor.create_model(input_size=X.shape[2])
    train_losses = predictor.train_model(X_train, y_train, epochs=50)
    
    # Make predictions
    print("\n📊 Making predictions...")
    predictions = predictor.predict(X_test)
    
    # Calculate metrics
    actual_test_prices = predictor.predict(X_test)  # This will inverse transform
    # For metrics, we need the actual test targets in original scale
    dummy_test = np.zeros((len(y_test), len(predictor.feature_columns)))
    dummy_test[:, predictor.feature_columns.index('Close')] = y_test.numpy().flatten()
    actual_test_targets = predictor.scaler.inverse_transform(dummy_test)[:, predictor.feature_columns.index('Close')]
    
    mse = mean_squared_error(actual_test_targets, predictions)
    mae = mean_absolute_error(actual_test_targets, predictions)
    
    print(f"\n📈 Model Performance:")
    print(f"   MSE: {mse:.4f}")
    print(f"   MAE: {mae:.4f}")
    print(f"   RMSE: {np.sqrt(mse):.4f}")
    
    # Export to ONNX
    print("\n🔄 Exporting to ONNX...")
    onnx_path = predictor.export_to_onnx('simple_lstm_financial.onnx')
    
    # Save artifacts
    print("\n💾 Saving model artifacts...")
    predictor.save_model_artifacts('lstm_financial_artifacts')
    
    print(f"\n✅ POC Model Complete!")
    print(f"   📁 ONNX Model: simple_lstm_financial.onnx")
    print(f"   📁 Artifacts: lstm_financial_artifacts/")
    print(f"\n🎯 Next Steps:")
    print(f"   1. Test ONNX model locally with onnxruntime")
    print(f"   2. Submit Custom Requirements Form to Cloudflare")
    print(f"   3. Negotiate enterprise BYOM deployment")
    
    return predictor, onnx_path

if __name__ == "__main__":
    predictor, onnx_path = main()