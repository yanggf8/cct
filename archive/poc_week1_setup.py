#!/usr/bin/env python3
"""
POC Week 1: ModelScope Deployment Validation
Goal: Prove we can deploy custom LSTM model to ModelScope and make API calls
"""

import yfinance as yf
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
import pickle
import json
from datetime import datetime, timedelta

class POCModelScopeValidation:
    def __init__(self):
        self.symbol = "AAPL"  # Start with single stock
        self.days_data = 60   # Minimal data for proof-of-concept
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
        # Validation results
        self.validation_results = {
            'deployment_successful': None,
            'api_responds': None,
            'latency_ms': None,
            'cost_per_call': None,
            'error_messages': []
        }
    
    def step1_collect_data(self):
        """Step 1: Get minimal AAPL data from Yahoo Finance"""
        print("📊 Step 1: Collecting AAPL data...")
        
        try:
            # Get last 60 days of AAPL data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=self.days_data)
            
            data = yf.download(self.symbol, start=start_date, end=end_date)
            
            if data.empty:
                raise Exception("No data retrieved from Yahoo Finance")
            
            # Use only Close price for simplicity
            prices = data['Close'].values.reshape(-1, 1)
            
            # Scale the data
            scaled_data = self.scaler.fit_transform(prices)
            
            print(f"✅ Data collected: {len(prices)} days of {self.symbol} prices")
            print(f"   Latest price: ${prices[-1][0]:.2f}")
            
            return scaled_data, prices
            
        except Exception as e:
            error_msg = f"Data collection failed: {str(e)}"
            self.validation_results['error_messages'].append(error_msg)
            print(f"❌ {error_msg}")
            return None, None
    
    def step2_create_sequences(self, scaled_data):
        """Step 2: Create training sequences for LSTM"""
        print("🔧 Step 2: Creating training sequences...")
        
        try:
            sequence_length = 10  # Use 10 days to predict next day
            
            X, y = [], []
            for i in range(sequence_length, len(scaled_data)):
                X.append(scaled_data[i-sequence_length:i, 0])
                y.append(scaled_data[i, 0])
            
            X, y = np.array(X), np.array(y)
            X = np.reshape(X, (X.shape[0], X.shape[1], 1))
            
            print(f"✅ Sequences created: {X.shape[0]} training samples")
            print(f"   Input shape: {X.shape}")
            
            return X, y
            
        except Exception as e:
            error_msg = f"Sequence creation failed: {str(e)}"
            self.validation_results['error_messages'].append(error_msg)
            print(f"❌ {error_msg}")
            return None, None
    
    def step3_train_minimal_lstm(self, X, y):
        """Step 3: Train simplest possible LSTM model"""
        print("🧠 Step 3: Training minimal LSTM model...")
        
        try:
            # Create very simple LSTM model
            model = Sequential([
                LSTM(50, return_sequences=True, input_shape=(X.shape[1], 1)),
                Dropout(0.2),
                LSTM(50, return_sequences=False),
                Dropout(0.2),
                Dense(1)
            ])
            
            model.compile(optimizer='adam', loss='mean_squared_error')
            
            # Train with minimal epochs for POC
            print("   Training model (this may take a few minutes)...")
            history = model.fit(X, y, batch_size=1, epochs=10, verbose=0)
            
            self.model = model
            
            print(f"✅ Model trained successfully")
            print(f"   Final loss: {history.history['loss'][-1]:.6f}")
            
            return True
            
        except Exception as e:
            error_msg = f"Model training failed: {str(e)}"
            self.validation_results['error_messages'].append(error_msg)
            print(f"❌ {error_msg}")
            return False
    
    def step4_save_model_for_deployment(self):
        """Step 4: Save model in format suitable for ModelScope deployment"""
        print("💾 Step 4: Saving model for deployment...")
        
        try:
            # Save model
            model_path = "poc_lstm_model.h5"
            self.model.save(model_path)
            
            # Save scaler
            scaler_path = "poc_scaler.pkl"
            with open(scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            
            # Create model metadata
            metadata = {
                'model_type': 'LSTM',
                'symbol': self.symbol,
                'sequence_length': 10,
                'features': ['close_price'],
                'created_at': datetime.now().isoformat(),
                'poc_version': '1.0'
            }
            
            with open('model_metadata.json', 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"✅ Model saved successfully")
            print(f"   Model file: {model_path}")
            print(f"   Scaler file: {scaler_path}")
            print(f"   Metadata: model_metadata.json")
            
            return True
            
        except Exception as e:
            error_msg = f"Model saving failed: {str(e)}"
            self.validation_results['error_messages'].append(error_msg)
            print(f"❌ {error_msg}")
            return False
    
    def step5_test_local_prediction(self, scaled_data):
        """Step 5: Test model prediction locally before deployment"""
        print("🧪 Step 5: Testing local prediction...")
        
        try:
            # Get last 10 days for prediction
            last_sequence = scaled_data[-10:]
            last_sequence = np.reshape(last_sequence, (1, 10, 1))
            
            # Make prediction
            prediction_scaled = self.model.predict(last_sequence, verbose=0)
            
            # Inverse transform to get actual price
            prediction_price = self.scaler.inverse_transform(prediction_scaled)
            
            print(f"✅ Local prediction successful")
            print(f"   Predicted next price: ${prediction_price[0][0]:.2f}")
            
            return float(prediction_price[0][0])
            
        except Exception as e:
            error_msg = f"Local prediction failed: {str(e)}"
            self.validation_results['error_messages'].append(error_msg)
            print(f"❌ {error_msg}")
            return None
    
    def step6_prepare_modelscope_deployment(self):
        """Step 6: Create deployment files for ModelScope"""
        print("🚀 Step 6: Preparing ModelScope deployment files...")
        
        try:
            # Create inference script for ModelScope
            inference_code = '''
import tensorflow as tf
import numpy as np
import pickle
import json

class ModelPredictor:
    def __init__(self):
        self.model = tf.keras.models.load_model('poc_lstm_model.h5')
        with open('poc_scaler.pkl', 'rb') as f:
            self.scaler = pickle.load(f)
    
    def predict(self, sequence_data):
        """
        Predict next price given 10-day sequence
        sequence_data: list of 10 float values (daily prices)
        """
        # Convert to numpy and reshape
        sequence = np.array(sequence_data).reshape(-1, 1)
        scaled_sequence = self.scaler.transform(sequence)
        model_input = scaled_sequence.reshape(1, 10, 1)
        
        # Make prediction
        prediction_scaled = self.model.predict(model_input, verbose=0)
        prediction_price = self.scaler.inverse_transform(prediction_scaled)
        
        return {
            'predicted_price': float(prediction_price[0][0]),
            'confidence': 0.75,  # Placeholder for POC
            'model_version': 'poc_v1.0'
        }

# ModelScope deployment entry point
def model_fn(model_dir):
    return ModelPredictor()

def input_fn(request_body, content_type='application/json'):
    input_data = json.loads(request_body)
    return input_data['sequence_data']

def predict_fn(input_data, model):
    return model.predict(input_data)

def output_fn(prediction, accept='application/json'):
    return json.dumps(prediction)
'''
            
            with open('inference.py', 'w') as f:
                f.write(inference_code)
            
            # Create requirements file
            requirements = '''
tensorflow==2.13.0
numpy==1.24.3
scikit-learn==1.3.0
pandas==2.0.3
'''
            
            with open('requirements.txt', 'w') as f:
                f.write(requirements)
            
            print("✅ Deployment files created:")
            print("   - inference.py (ModelScope inference script)")
            print("   - requirements.txt (dependencies)")
            print("   - poc_lstm_model.h5 (trained model)")
            print("   - poc_scaler.pkl (data scaler)")
            print("   - model_metadata.json (model info)")
            
            return True
            
        except Exception as e:
            error_msg = f"Deployment preparation failed: {str(e)}"
            self.validation_results['error_messages'].append(error_msg)
            print(f"❌ {error_msg}")
            return False
    
    def run_week1_validation(self):
        """Run complete Week 1 validation process"""
        print("=" * 60)
        print("🔬 POC WEEK 1: ModelScope Deployment Validation")
        print("=" * 60)
        print(f"Target: Deploy custom LSTM for {self.symbol} to ModelScope")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Step 1: Collect data
        scaled_data, raw_prices = self.step1_collect_data()
        if scaled_data is None:
            return self.generate_final_report()
        
        # Step 2: Create sequences
        X, y = self.step2_create_sequences(scaled_data)
        if X is None:
            return self.generate_final_report()
        
        # Step 3: Train model
        if not self.step3_train_minimal_lstm(X, y):
            return self.generate_final_report()
        
        # Step 4: Save model
        if not self.step4_save_model_for_deployment():
            return self.generate_final_report()
        
        # Step 5: Test local prediction
        prediction = self.step5_test_local_prediction(scaled_data)
        if prediction is None:
            return self.generate_final_report()
        
        # Step 6: Prepare deployment files
        if not self.step6_prepare_modelscope_deployment():
            return self.generate_final_report()
        
        # Update validation results
        self.validation_results.update({
            'local_model_works': True,
            'deployment_files_ready': True,
            'sample_prediction': prediction,
            'next_steps': [
                'Manual: Create ModelScope account at https://modelscope.cn',
                'Manual: Upload model files via https://modelscope.cn/my/modelService/deploy',
                'Manual: Test deployed API endpoint',
                'Manual: Measure latency and cost per call'
            ]
        })
        
        return self.generate_final_report()
    
    def generate_final_report(self):
        """Generate Week 1 validation report"""
        print()
        print("=" * 60)
        print("📊 WEEK 1 VALIDATION REPORT")
        print("=" * 60)
        
        if self.validation_results['error_messages']:
            print("❌ VALIDATION FAILED")
            print("\nErrors encountered:")
            for error in self.validation_results['error_messages']:
                print(f"   • {error}")
            print("\n🔄 Recommendation: Fix errors and retry validation")
        else:
            print("✅ LOCAL MODEL PREPARATION SUCCESSFUL")
            print(f"\n📈 Sample prediction: ${self.validation_results.get('sample_prediction', 'N/A'):.2f}")
            
            print("\n📋 Next Steps (Manual):")
            for i, step in enumerate(self.validation_results.get('next_steps', []), 1):
                print(f"   {i}. {step}")
            
            print("\n🎯 Week 1 Goal: Complete ModelScope deployment and API testing")
        
        print(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Save report to file
        with open('week1_validation_report.json', 'w') as f:
            json.dump(self.validation_results, f, indent=2, default=str)
        
        return self.validation_results

if __name__ == "__main__":
    validator = POCModelScopeValidation()
    results = validator.run_week1_validation()