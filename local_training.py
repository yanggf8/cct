#!/usr/bin/env python3
"""
Local Tree-Based Model Training for Trading Predictions
No GPU required - runs efficiently on CPU
"""

import yfinance as yf
import pandas as pd
import numpy as np
import pandas_ta as ta
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import lightgbm as lgb
import json
import pickle
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Configuration
SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
PREDICTION_THRESHOLD = 0.005  # 0.5% for UP/DOWN classification
TARGET_ACCURACY = 0.65  # 65% direction accuracy target

def fetch_stock_data(symbols, period="2y"):
    """Fetch stock data locally"""
    print("📊 Fetching market data...")

    data = {}
    for symbol in symbols:
        print(f"   📈 Downloading {symbol}...")
        ticker = yf.Ticker(symbol)
        stock_data = ticker.history(period=period)

        if len(stock_data) > 0:
            data[symbol] = stock_data
            print(f"      ✅ {len(stock_data)} data points")
        else:
            print(f"      ❌ No data for {symbol}")

    return data

def create_technical_features(df):
    """Create comprehensive technical indicators"""
    data = df.copy()

    # Trend Indicators
    data['SMA_5'] = ta.sma(data['Close'], length=5)
    data['SMA_20'] = ta.sma(data['Close'], length=20)
    data['SMA_50'] = ta.sma(data['Close'], length=50)
    data['EMA_12'] = ta.ema(data['Close'], length=12)
    data['EMA_26'] = ta.ema(data['Close'], length=26)

    # MACD
    macd = ta.macd(data['Close'])
    data['MACD'] = macd['MACD_12_26_9']
    data['MACD_Signal'] = macd['MACDs_12_26_9']
    data['MACD_Histogram'] = macd['MACDh_12_26_9']

    # Momentum Indicators
    data['RSI_14'] = ta.rsi(data['Close'], length=14)
    data['RSI_30'] = ta.rsi(data['Close'], length=30)

    # Stochastic
    stoch = ta.stoch(data['High'], data['Low'], data['Close'])
    data['Stoch_K'] = stoch['STOCHk_14_3_3']
    data['Stoch_D'] = stoch['STOCHd_14_3_3']

    # Williams %R
    data['Williams_R'] = ta.willr(data['High'], data['Low'], data['Close'])

    # Volatility Indicators
    bb = ta.bbands(data['Close'])
    data['BB_Upper'] = bb['BBU_20_2.0']
    data['BB_Lower'] = bb['BBL_20_2.0']
    data['BB_Width'] = (bb['BBU_20_2.0'] - bb['BBL_20_2.0']) / bb['BBM_20_2.0']
    data['BB_Position'] = (data['Close'] - bb['BBL_20_2.0']) / (bb['BBU_20_2.0'] - bb['BBL_20_2.0'])

    # ATR
    data['ATR'] = ta.atr(data['High'], data['Low'], data['Close'])

    # Volume Indicators
    data['Volume_SMA'] = ta.sma(data['Volume'], length=20)
    data['Volume_Ratio'] = data['Volume'] / data['Volume_SMA']
    data['OBV'] = ta.obv(data['Close'], data['Volume'])

    # Price Action Features
    data['Return_1d'] = data['Close'].pct_change(1)
    data['Return_3d'] = data['Close'].pct_change(3)
    data['Return_5d'] = data['Close'].pct_change(5)
    data['Return_10d'] = data['Close'].pct_change(10)

    # Price position in daily range
    data['Price_Position'] = (data['Close'] - data['Low']) / (data['High'] - data['Low'])

    # Gap analysis
    data['Gap'] = (data['Open'] - data['Close'].shift(1)) / data['Close'].shift(1)

    # Relative strength
    data['Price_vs_SMA20'] = data['Close'] / data['SMA_20'] - 1
    data['Price_vs_SMA50'] = data['Close'] / data['SMA_50'] - 1

    # Moving average slopes
    data['SMA20_Slope'] = data['SMA_20'].pct_change(5)
    data['SMA50_Slope'] = data['SMA_50'].pct_change(10)

    return data

def create_classification_targets(data, threshold=0.005):
    """Create UP/DOWN/HOLD classification targets"""

    # Calculate next day return
    future_return = data['Close'].shift(-1) / data['Close'] - 1

    # Create labels
    conditions = [
        future_return > threshold,    # UP
        future_return < -threshold,   # DOWN
    ]
    choices = [1, -1]  # UP=1, DOWN=-1, HOLD=0 (default)

    labels = np.select(conditions, choices, default=0)

    return labels, future_return

def prepare_training_data(stock_data):
    """Prepare complete training dataset"""

    all_features = []
    all_targets = []
    metadata = []

    print("\n🔧 Creating features and targets...")

    for symbol, data in stock_data.items():
        print(f"   📊 Processing {symbol}...")

        # Create technical features
        enhanced_data = create_technical_features(data)

        # Create classification targets
        targets, future_returns = create_classification_targets(enhanced_data, PREDICTION_THRESHOLD)

        # Select feature columns (exclude OHLCV)
        feature_cols = [col for col in enhanced_data.columns
                       if col not in ['Open', 'High', 'Low', 'Close', 'Volume']]

        features = enhanced_data[feature_cols].copy()

        # Remove NaN values
        valid_mask = ~(features.isna().any(axis=1) | np.isnan(targets))
        features_clean = features[valid_mask]
        targets_clean = targets[valid_mask]

        # Add to dataset
        all_features.append(features_clean)
        all_targets.extend(targets_clean)

        # Class distribution
        unique, counts = np.unique(targets_clean, return_counts=True)
        class_dist = dict(zip(unique, counts))
        total = sum(counts)

        print(f"      DOWN: {class_dist.get(-1, 0):3d} ({class_dist.get(-1, 0)/total:.1%})")
        print(f"      HOLD: {class_dist.get(0, 0):3d} ({class_dist.get(0, 0)/total:.1%})")
        print(f"      UP:   {class_dist.get(1, 0):3d} ({class_dist.get(1, 0)/total:.1%})")

    # Combine all data
    X = pd.concat(all_features, ignore_index=True)
    y = np.array(all_targets)

    print(f"\n📊 Complete dataset: {X.shape[0]} samples, {X.shape[1]} features")

    return X, y

def train_models(X, y):
    """Train tree-based models locally"""

    print("\n🏋️ Training tree-based models locally (CPU only)...")

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"   Training: {len(X_train)} samples")
    print(f"   Testing: {len(X_test)} samples")

    # Scale features for consistency
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Define models
    models = {
        'RandomForest': RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1  # Use all CPU cores
        ),
        'XGBoost': xgb.XGBClassifier(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.1,
            random_state=42,
            n_jobs=-1  # Use all CPU cores
        ),
        'LightGBM': lgb.LGBMClassifier(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.1,
            random_state=42,
            n_jobs=-1,  # Use all CPU cores
            verbose=-1
        )
    }

    results = {}

    for name, model in models.items():
        print(f"\n🔄 Training {name}...")

        # Train model
        if name == 'RandomForest':
            model.fit(X_train, y_train)
        else:
            model.fit(X_train_scaled, y_train)

        # Make predictions
        if name == 'RandomForest':
            predictions = model.predict(X_test)
            probabilities = model.predict_proba(X_test)
        else:
            predictions = model.predict(X_test_scaled)
            probabilities = model.predict_proba(X_test_scaled)

        # Calculate metrics
        overall_accuracy = accuracy_score(y_test, predictions)

        # Direction accuracy (UP/DOWN only, excluding HOLD)
        direction_mask = (y_test != 0) & (predictions != 0)
        direction_accuracy = accuracy_score(
            y_test[direction_mask],
            predictions[direction_mask]
        ) if np.sum(direction_mask) > 0 else 0

        # Cross-validation
        cv_scores = cross_val_score(model, X_train_scaled if name != 'RandomForest' else X_train, y_train, cv=5)

        results[name] = {
            'model': model,
            'overall_accuracy': overall_accuracy,
            'direction_accuracy': direction_accuracy,
            'cv_mean': cv_scores.mean(),
            'cv_std': cv_scores.std(),
            'predictions': predictions,
            'probabilities': probabilities
        }

        print(f"   ✅ {name} Results:")
        print(f"      Overall Accuracy: {overall_accuracy:.1%}")
        print(f"      Direction Accuracy: {direction_accuracy:.1%}")
        print(f"      CV Score: {cv_scores.mean():.1%} ± {cv_scores.std():.1%}")

        # Check if meets target
        if direction_accuracy >= TARGET_ACCURACY:
            print(f"      🎯 EXCEEDS {TARGET_ACCURACY:.0%} TARGET!")
        else:
            print(f"      ⚠️  Below {TARGET_ACCURACY:.0%} target")

    return results, scaler, X_test, y_test

def save_best_model(results, scaler, feature_names):
    """Save the best performing model"""

    # Find best model by direction accuracy
    best_name = max(results.keys(), key=lambda k: results[k]['direction_accuracy'])
    best_result = results[best_name]
    best_model = best_result['model']

    print(f"\n🏆 Best Model: {best_name}")
    print(f"   Direction Accuracy: {best_result['direction_accuracy']:.1%}")

    # Save model
    model_package = {
        'model': best_model,
        'scaler': scaler,
        'feature_names': feature_names,
        'model_type': best_name,
        'performance': {
            'overall_accuracy': best_result['overall_accuracy'],
            'direction_accuracy': best_result['direction_accuracy'],
            'cv_mean': best_result['cv_mean'],
            'cv_std': best_result['cv_std']
        },
        'metadata': {
            'training_date': datetime.now().isoformat(),
            'symbols': SYMBOLS,
            'threshold': PREDICTION_THRESHOLD,
            'target_accuracy': TARGET_ACCURACY,
            'meets_target': best_result['direction_accuracy'] >= TARGET_ACCURACY
        }
    }

    # Save to file
    with open('best_trading_model.pkl', 'wb') as f:
        pickle.dump(model_package, f)

    # Save metadata as JSON
    json_metadata = {
        'model_type': best_name,
        'performance': model_package['performance'],
        'metadata': model_package['metadata'],
        'features': feature_names
    }

    with open('model_metadata.json', 'w') as f:
        json.dump(json_metadata, f, indent=2)

    print(f"   💾 Saved: best_trading_model.pkl")
    print(f"   💾 Saved: model_metadata.json")

    return model_package

def main():
    """Main training pipeline"""

    print("🚀 Local Tree-Based Model Training Pipeline")
    print("=" * 50)

    # 1. Fetch data
    stock_data = fetch_stock_data(SYMBOLS)

    if not stock_data:
        print("❌ No data fetched. Exiting.")
        return

    # 2. Prepare training data
    X, y = prepare_training_data(stock_data)

    # 3. Train models
    results, scaler, X_test, y_test = train_models(X, y)

    # 4. Save best model
    model_package = save_best_model(results, scaler, X.columns.tolist())

    # 5. Final summary
    print(f"\n🎉 Training Complete!")
    print(f"   🏆 Best Model: {model_package['model_type']}")
    print(f"   🎯 Direction Accuracy: {model_package['performance']['direction_accuracy']:.1%}")

    if model_package['metadata']['meets_target']:
        print(f"   ✅ READY FOR DEPLOYMENT!")
    else:
        print(f"   ⚠️  Needs improvement (target: {TARGET_ACCURACY:.0%})")
        print(f"   💡 Consider: More data, feature engineering, or ensemble methods")

    print(f"\n📁 Output files:")
    print(f"   📦 best_trading_model.pkl - Complete model package")
    print(f"   📊 model_metadata.json - Performance metadata")

if __name__ == "__main__":
    main()