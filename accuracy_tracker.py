#!/usr/bin/env python3
"""
Trading Prediction Accuracy Tracker
Stores daily predictions and tracks accuracy vs actual market movements
"""

import requests
import json
import yfinance as yf
from datetime import datetime, timedelta
import os

class AccuracyTracker:
    def __init__(self):
        self.worker_url = "https://tft-trading-system.yanggf.workers.dev"
        self.data_file = "prediction_tracking.json"
        self.tracking_data = self.load_tracking_data()
    
    def load_tracking_data(self):
        """Load existing tracking data"""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r') as f:
                    return json.load(f)
            except:
                return {"predictions": [], "accuracy_history": []}
        return {"predictions": [], "accuracy_history": []}
    
    def save_tracking_data(self):
        """Save tracking data to file"""
        with open(self.data_file, 'w') as f:
            json.dump(self.tracking_data, f, indent=2)
        print(f"💾 Data saved to {self.data_file}")
    
    def get_current_prediction(self):
        """Get current trading prediction from production system"""
        try:
            response = requests.get(f"{self.worker_url}/analyze", timeout=30)
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Failed to get prediction: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error getting prediction: {e}")
            return None
    
    def store_daily_prediction(self):
        """Store today's prediction for future validation"""
        
        print(f"📊 Getting daily prediction for {datetime.now().strftime('%Y-%m-%d')}")
        
        prediction_data = self.get_current_prediction()
        if not prediction_data:
            return False
        
        # Extract key prediction info
        daily_prediction = {
            "date": datetime.now().strftime('%Y-%m-%d'),
            "timestamp": datetime.now().isoformat(),
            "run_id": prediction_data.get("run_id"),
            "predictions": {},
            "system_version": prediction_data.get("worker_version", "unknown")
        }
        
        for symbol, signal in prediction_data.get("trading_signals", {}).items():
            if signal.get("success"):
                daily_prediction["predictions"][symbol] = {
                    "current_price": signal.get("current_price"),
                    "predicted_price": signal.get("components", {}).get("price_prediction", {}).get("predicted_price"),
                    "direction": signal.get("components", {}).get("price_prediction", {}).get("direction"),
                    "action": signal.get("action"),
                    "confidence": signal.get("confidence"),
                    "signal_score": signal.get("signal_score"),
                    "sentiment": signal.get("components", {}).get("sentiment_analysis", {}).get("sentiment")
                }
        
        # Store prediction
        self.tracking_data["predictions"].append(daily_prediction)
        self.save_tracking_data()
        
        print(f"✅ Stored predictions for {len(daily_prediction['predictions'])} symbols")
        return True
    
    def get_actual_price_data(self, symbol, start_date, end_date):
        """Get actual price data from Yahoo Finance"""
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(start=start_date, end=end_date)
            
            if len(data) > 0:
                return {
                    "start_price": float(data['Close'].iloc[0]),
                    "end_price": float(data['Close'].iloc[-1]),
                    "high": float(data['High'].max()),
                    "low": float(data['Low'].min()),
                    "volume": int(data['Volume'].sum())
                }
            return None
        except Exception as e:
            print(f"❌ Error getting actual data for {symbol}: {e}")
            return None
    
    def validate_old_predictions(self, days_back=7):
        """Validate predictions from N days ago against actual market data"""
        
        validation_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')
        print(f"🔍 Validating predictions from {validation_date} ({days_back} days ago)")
        
        # Find predictions from validation date
        old_predictions = [p for p in self.tracking_data["predictions"] if p["date"] == validation_date]
        
        if not old_predictions:
            print(f"📭 No predictions found for {validation_date}")
            return None
        
        prediction = old_predictions[0]
        validation_results = {
            "validation_date": validation_date,
            "prediction_date": prediction["date"],
            "days_elapsed": days_back,
            "results": {},
            "overall_accuracy": 0,
            "directional_accuracy": 0
        }
        
        correct_directions = 0
        total_symbols = 0
        
        print(f"📈 Validating {len(prediction['predictions'])} symbols...")
        
        for symbol, pred in prediction["predictions"].items():
            start_date = datetime.strptime(validation_date, '%Y-%m-%d')
            end_date = start_date + timedelta(days=days_back + 1)
            
            actual_data = self.get_actual_price_data(symbol, start_date, end_date)
            
            if actual_data:
                predicted_price = pred.get("predicted_price", pred.get("current_price"))
                actual_start = actual_data["start_price"]
                actual_end = actual_data["end_price"]
                
                predicted_direction = pred.get("direction", "UNKNOWN")
                actual_direction = "UP" if actual_end > actual_start else "DOWN"
                
                predicted_change_pct = ((predicted_price - pred["current_price"]) / pred["current_price"]) * 100
                actual_change_pct = ((actual_end - actual_start) / actual_start) * 100
                
                direction_correct = predicted_direction == actual_direction
                
                if direction_correct:
                    correct_directions += 1
                
                validation_results["results"][symbol] = {
                    "predicted_price": predicted_price,
                    "predicted_direction": predicted_direction,
                    "predicted_change_pct": predicted_change_pct,
                    "actual_start_price": actual_start,
                    "actual_end_price": actual_end,
                    "actual_direction": actual_direction,
                    "actual_change_pct": actual_change_pct,
                    "direction_correct": direction_correct,
                    "action_taken": pred.get("action", "UNKNOWN")
                }
                
                print(f"   {symbol}: {predicted_direction} pred vs {actual_direction} actual - {'✅' if direction_correct else '❌'}")
                
                total_symbols += 1
        
        # Calculate accuracy
        if total_symbols > 0:
            validation_results["directional_accuracy"] = (correct_directions / total_symbols) * 100
            validation_results["overall_accuracy"] = validation_results["directional_accuracy"]  # For now, same as directional
        
        # Store validation results
        self.tracking_data["accuracy_history"].append(validation_results)
        self.save_tracking_data()
        
        print(f"📊 Validation Results:")
        print(f"   Directional Accuracy: {validation_results['directional_accuracy']:.1f}% ({correct_directions}/{total_symbols})")
        
        return validation_results
    
    def get_accuracy_summary(self):
        """Get summary of prediction accuracy"""
        
        if not self.tracking_data["accuracy_history"]:
            print("📭 No accuracy history available yet")
            return None
        
        history = self.tracking_data["accuracy_history"]
        
        # Calculate averages
        avg_directional = sum(h["directional_accuracy"] for h in history) / len(history)
        
        recent_accuracy = history[-1]["directional_accuracy"] if history else 0
        
        print(f"📈 ACCURACY SUMMARY")
        print(f"{'=' * 50}")
        print(f"Total Validations: {len(history)}")
        print(f"Average Directional Accuracy: {avg_directional:.1f}%")
        print(f"Most Recent Accuracy: {recent_accuracy:.1f}%")
        print(f"Total Predictions Stored: {len(self.tracking_data['predictions'])}")
        
        # Show recent validation details
        if history:
            recent = history[-1]
            print(f"\\nLast Validation ({recent['validation_date']}):")
            for symbol, result in recent["results"].items():
                status = "✅" if result["direction_correct"] else "❌"
                print(f"   {symbol}: {result['predicted_direction']} → {result['actual_direction']} {status}")
        
        return {
            "total_validations": len(history),
            "average_accuracy": avg_directional,
            "recent_accuracy": recent_accuracy,
            "total_predictions": len(self.tracking_data["predictions"])
        }

def main():
    """Main tracking function"""
    tracker = AccuracyTracker()
    
    if len(os.sys.argv) > 1:
        command = os.sys.argv[1]
        
        if command == "store":
            tracker.store_daily_prediction()
        elif command == "validate":
            days = int(os.sys.argv[2]) if len(os.sys.argv) > 2 else 7
            tracker.validate_old_predictions(days)
        elif command == "summary":
            tracker.get_accuracy_summary()
        else:
            print("Usage: python accuracy_tracker.py [store|validate|summary] [days]")
    else:
        # Default: store today's prediction
        print("🎯 TFT Trading System - Accuracy Tracker")
        print("=" * 50)
        tracker.store_daily_prediction()
        print()
        tracker.get_accuracy_summary()

if __name__ == "__main__":
    main()