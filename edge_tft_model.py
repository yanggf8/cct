#!/usr/bin/env python3
"""
Edge-Optimized TFT Model for Cloudflare Workers AI Deployment
Lightweight Temporal Fusion Transformer focused on financial time series
"""

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib
import json
import os
from datetime import datetime, timedelta

class EdgeTFTBlock(nn.Module):
    """
    Simplified TFT block optimized for edge deployment
    Reduced complexity while maintaining core temporal fusion capabilities
    """
    
    def __init__(self, input_size, hidden_size, dropout=0.1):
        super(EdgeTFTBlock, self).__init__()
        
        self.hidden_size = hidden_size
        
        # Variable Selection Network (simplified)
        self.variable_selection = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, input_size),
            nn.Sigmoid()
        )
        
        # LSTM for temporal processing
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=1,  # Single layer for edge optimization
            batch_first=True,
            dropout=0
        )
        
        # Gated Residual Network (simplified)
        self.grn = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size)
        )
        
        # Gate for residual connection
        self.gate = nn.Linear(hidden_size, hidden_size)
        
    def forward(self, x):
        # Variable selection
        selection_weights = self.variable_selection(x)
        selected_features = x * selection_weights
        
        # Temporal processing
        lstm_out, _ = self.lstm(selected_features)
        
        # Gated residual network
        grn_out = self.grn(lstm_out)
        gate_weights = torch.sigmoid(self.gate(lstm_out))
        
        # Gated residual connection
        output = lstm_out + gate_weights * grn_out
        
        return output

class EdgeTFTModel(nn.Module):
    """
    Edge-optimized Temporal Fusion Transformer
    Designed for <1MB model size and <10ms inference
    """
    
    def __init__(self, input_size=5, hidden_size=32, num_blocks=2, sequence_length=30, dropout=0.1):
        super(EdgeTFTModel, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.sequence_length = sequence_length
        
        # Input embedding
        self.input_embedding = nn.Linear(input_size, hidden_size)
        
        # Positional encoding (learnable)
        self.positional_encoding = nn.Parameter(torch.randn(sequence_length, hidden_size))
        
        # TFT blocks
        self.tft_blocks = nn.ModuleList([
            EdgeTFTBlock(hidden_size, hidden_size, dropout) 
            for _ in range(num_blocks)
        ])
        
        # Simple attention mechanism (ONNX compatible)
        self.attention_weights = nn.Linear(hidden_size, hidden_size)
        self.attention_softmax = nn.Softmax(dim=1)
        
        # Output layers
        self.dropout = nn.Dropout(dropout)
        self.output_projection = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, 1)
        )
        
    def forward(self, x):
        batch_size, seq_len, _ = x.shape
        
        # Input embedding
        embedded = self.input_embedding(x)
        
        # Add positional encoding
        embedded = embedded + self.positional_encoding[:seq_len].unsqueeze(0)
        
        # Apply TFT blocks
        tft_output = embedded
        for tft_block in self.tft_blocks:
            tft_output = tft_block(tft_output)
        
        # Simple attention mechanism
        attention_scores = self.attention_weights(tft_output)
        attention_weights = self.attention_softmax(attention_scores)
        attended_output = tft_output * attention_weights
        
        # Take last timestep for prediction
        final_hidden = attended_output[:, -1, :]
        
        # Output projection
        output = self.dropout(final_hidden)
        output = self.output_projection(output)
        
        return output

class FinancialTFTPredictor:
    """
    Complete financial TFT prediction system optimized for edge deployment
    """
    
    def __init__(self, sequence_length=30):
        self.sequence_length = sequence_length
        self.model = None
        self.scaler = MinMaxScaler()
        self.feature_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        
    def prepare_data(self, data, target_column='Close'):
        """
        Prepare time series data for TFT training
        """
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
        """Create the edge-optimized TFT model"""
        self.model = EdgeTFTModel(
            input_size=input_size,
            hidden_size=32,  # Small for edge deployment
            num_blocks=2,    # Reduced blocks
            sequence_length=self.sequence_length,
            dropout=0.1
        )
        return self.model
        
    def train_model(self, X_train, y_train, epochs=100, learning_rate=0.001):
        """
        Train the TFT model
        """
        if self.model is None:
            self.create_model(input_size=X_train.shape[2])
            
        criterion = nn.MSELoss()
        optimizer = torch.optim.AdamW(self.model.parameters(), lr=learning_rate, weight_decay=0.01)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10)
        
        self.model.train()
        train_losses = []
        
        for epoch in range(epochs):
            optimizer.zero_grad()
            
            # Forward pass
            outputs = self.model(X_train)
            loss = criterion(outputs, y_train)
            
            # Backward pass
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            optimizer.step()
            
            train_losses.append(loss.item())
            scheduler.step(loss)
            
            if epoch % 20 == 0:
                print(f'Epoch [{epoch}/{epochs}], Loss: {loss.item():.6f}')
        
        return train_losses
    
    def predict(self, X_test):
        """Make predictions"""
        self.model.eval()
        with torch.no_grad():
            predictions = self.model(X_test)
            
        # Inverse transform predictions
        dummy_features = np.zeros((len(predictions), len(self.feature_columns)))
        dummy_features[:, self.feature_columns.index('Close')] = predictions.numpy().flatten()
        
        inverse_scaled = self.scaler.inverse_transform(dummy_features)
        actual_predictions = inverse_scaled[:, self.feature_columns.index('Close')]
        
        return actual_predictions
    
    def export_to_onnx(self, filepath='edge_tft_financial.onnx'):
        """
        Export model to ONNX format for Cloudflare Workers AI
        """
        if self.model is None:
            raise ValueError("Model not trained yet")
            
        self.model.eval()
        
        # Create dummy input
        dummy_input = torch.randn(1, self.sequence_length, len(self.feature_columns))
        
        # Export to ONNX
        torch.onnx.export(
            self.model,
            dummy_input,
            filepath,
            export_params=True,
            opset_version=13,
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
        
        print(f"Edge TFT model exported to ONNX: {filepath}")
        
        # Check model size
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        print(f"ONNX model size: {size_mb:.2f} MB")
        
        return filepath
    
    def save_model_artifacts(self, model_path='edge_tft_artifacts'):
        """Save all model artifacts for deployment"""
        os.makedirs(model_path, exist_ok=True)
        
        # Save scaler
        joblib.dump(self.scaler, f'{model_path}/scaler.pkl')
        
        # Save model configuration
        config = {
            'sequence_length': self.sequence_length,
            'feature_columns': self.feature_columns,
            'model_type': 'EdgeTFT',
            'model_params': {
                'input_size': len(self.feature_columns),
                'hidden_size': 32,
                'num_blocks': 2,
                'sequence_length': self.sequence_length
            }
        }
        
        with open(f'{model_path}/config.json', 'w') as f:
            json.dump(config, f, indent=2)
            
        # Save PyTorch model
        torch.save(self.model.state_dict(), f'{model_path}/model_weights.pth')
        
        print(f"Edge TFT artifacts saved to: {model_path}")

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
    Main function to train and export the edge TFT model
    """
    print("🚀 Edge-Optimized TFT Financial Predictor - Cloudflare Workers AI")
    print("=" * 70)
    
    # Generate sample data
    print("📊 Generating sample financial data...")
    data = generate_sample_data(days=500)
    
    # Initialize predictor
    predictor = FinancialTFTPredictor(sequence_length=30)
    
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
    print("\n🤖 Training Edge TFT model...")
    predictor.create_model(input_size=X.shape[2])
    
    # Count parameters
    total_params = sum(p.numel() for p in predictor.model.parameters())
    print(f"📊 Model parameters: {total_params:,}")
    
    train_losses = predictor.train_model(X_train, y_train, epochs=50)
    
    # Make predictions
    print("\n📊 Making predictions...")
    predictions = predictor.predict(X_test)
    
    # Calculate metrics
    from sklearn.metrics import mean_squared_error, mean_absolute_error
    actual_test_prices = predictor.predict(X_test)
    
    # For metrics, we need actual test targets in original scale
    dummy_test = np.zeros((len(y_test), len(predictor.feature_columns)))
    dummy_test[:, predictor.feature_columns.index('Close')] = y_test.numpy().flatten()
    actual_test_targets = predictor.scaler.inverse_transform(dummy_test)[:, predictor.feature_columns.index('Close')]
    
    mse = mean_squared_error(actual_test_targets, predictions)
    mae = mean_absolute_error(actual_test_targets, predictions)
    
    print(f"\n📈 Edge TFT Performance:")
    print(f"   Parameters: {total_params:,}")
    print(f"   MSE: {mse:.4f}")
    print(f"   MAE: {mae:.4f}")
    print(f"   RMSE: {np.sqrt(mse):.4f}")
    
    # Export to ONNX
    print("\n🔄 Exporting to ONNX...")
    onnx_path = predictor.export_to_onnx('edge_tft_financial.onnx')
    
    # Save artifacts
    print("\n💾 Saving model artifacts...")
    predictor.save_model_artifacts('edge_tft_artifacts')
    
    print(f"\n✅ Edge TFT Model Complete!")
    print(f"   📁 ONNX Model: edge_tft_financial.onnx")
    print(f"   📁 Artifacts: edge_tft_artifacts/")
    print(f"   ⚡ Ready for Cloudflare Workers AI BYOM")
    
    return predictor, onnx_path

if __name__ == "__main__":
    predictor, onnx_path = main()