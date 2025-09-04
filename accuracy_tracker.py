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
                price_comp = signal.get("components", {}).get("price_prediction", {})
                dual_analytics = signal.get("components", {}).get("dual_model_analytics", {})
                
                prediction_entry = {
                    "current_price": signal.get("current_price"),
                    "predicted_price": price_comp.get("predicted_price"),
                    "direction": price_comp.get("direction"),
                    "action": signal.get("action"),
                    "confidence": signal.get("confidence"),
                    "signal_score": signal.get("signal_score"),
                    "sentiment": signal.get("components", {}).get("sentiment_analysis", {}).get("sentiment"),
                    "model_used": price_comp.get("model_used"),
                    "dual_model_active": dual_analytics.get("both_models_active", False)
                }
                
                # Add dual model comparison data if available
                if price_comp.get("model_comparison"):
                    comparison = price_comp["model_comparison"]
                    prediction_entry["dual_model_comparison"] = {
                        "tft": {
                            "price": comparison["tft_prediction"]["price"],
                            "direction": comparison["tft_prediction"]["direction"],
                            "confidence": comparison["tft_prediction"]["confidence"],
                            "source": comparison["tft_prediction"]["source"]
                        },
                        "nhits": {
                            "price": comparison["nhits_prediction"]["price"],
                            "direction": comparison["nhits_prediction"]["direction"],
                            "confidence": comparison["nhits_prediction"]["confidence"],
                            "source": comparison["nhits_prediction"]["source"]
                        },
                        "consensus": comparison["agreement"]["directional_consensus"],
                        "prediction_spread": comparison["agreement"]["prediction_spread"],
                        "confidence_boost": comparison["agreement"]["confidence_boost"]
                    }
                
                daily_prediction["predictions"][symbol] = prediction_entry
        
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
        
        # Dual model tracking
        tft_correct = 0
        nhits_correct = 0
        ensemble_correct = 0
        dual_active_count = 0
        consensus_correct = 0
        consensus_total = 0
        
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
                    if pred.get("model_used", "").startswith("TFT+N-HITS"):
                        ensemble_correct += 1
                
                # Track dual model performance if available
                dual_model_results = {}
                if pred.get("dual_model_comparison"):
                    dual_active_count += 1
                    comparison = pred["dual_model_comparison"]
                    
                    tft_direction_correct = comparison["tft"]["direction"] == actual_direction
                    nhits_direction_correct = comparison["nhits"]["direction"] == actual_direction
                    
                    if tft_direction_correct:
                        tft_correct += 1
                    if nhits_direction_correct:
                        nhits_correct += 1
                    
                    # Track consensus accuracy
                    if comparison["consensus"]:
                        consensus_total += 1
                        if direction_correct:
                            consensus_correct += 1
                    
                    dual_model_results = {
                        "tft_prediction": {
                            "price": comparison["tft"]["price"],
                            "direction": comparison["tft"]["direction"],
                            "direction_correct": tft_direction_correct
                        },
                        "nhits_prediction": {
                            "price": comparison["nhits"]["price"],
                            "direction": comparison["nhits"]["direction"], 
                            "direction_correct": nhits_direction_correct
                        },
                        "consensus_agreement": comparison["consensus"],
                        "prediction_spread": comparison["prediction_spread"],
                        "both_models_correct": tft_direction_correct and nhits_direction_correct,
                        "ensemble_vs_individuals": {
                            "ensemble_correct": direction_correct,
                            "tft_correct": tft_direction_correct,
                            "nhits_correct": nhits_direction_correct
                        }
                    }
                
                validation_results["results"][symbol] = {
                    "predicted_price": predicted_price,
                    "predicted_direction": predicted_direction,
                    "predicted_change_pct": predicted_change_pct,
                    "actual_start_price": actual_start,
                    "actual_end_price": actual_end,
                    "actual_direction": actual_direction,
                    "actual_change_pct": actual_change_pct,
                    "direction_correct": direction_correct,
                    "action_taken": pred.get("action", "UNKNOWN"),
                    "model_used": pred.get("model_used", "UNKNOWN"),
                    "dual_model_active": pred.get("dual_model_active", False),
                    "dual_model_results": dual_model_results
                }
                
                status_icon = '✅' if direction_correct else '❌'
                model_info = f"({pred.get('model_used', 'Unknown')})"
                print(f"   {symbol}: {predicted_direction} pred vs {actual_direction} actual {status_icon} {model_info}")
                
                # Show dual model breakdown if available
                if dual_model_results:
                    tft_icon = '✅' if dual_model_results['tft_prediction']['direction_correct'] else '❌'
                    nhits_icon = '✅' if dual_model_results['nhits_prediction']['direction_correct'] else '❌'
                    consensus_note = ' (consensus)' if dual_model_results['consensus_agreement'] else ' (disagreement)'
                    print(f"      TFT: {dual_model_results['tft_prediction']['direction']} {tft_icon}, N-HITS: {dual_model_results['nhits_prediction']['direction']} {nhits_icon}{consensus_note}")
                
                total_symbols += 1
        
        # Calculate accuracy
        if total_symbols > 0:
            validation_results["directional_accuracy"] = (correct_directions / total_symbols) * 100
            validation_results["overall_accuracy"] = validation_results["directional_accuracy"]  # For now, same as directional
            
            # Add dual model analytics
            validation_results["dual_model_analytics"] = {
                "dual_active_symbols": dual_active_count,
                "dual_active_percentage": (dual_active_count / total_symbols) * 100 if total_symbols > 0 else 0,
                "model_accuracies": {
                    "ensemble": (ensemble_correct / dual_active_count) * 100 if dual_active_count > 0 else 0,
                    "tft_individual": (tft_correct / dual_active_count) * 100 if dual_active_count > 0 else 0,
                    "nhits_individual": (nhits_correct / dual_active_count) * 100 if dual_active_count > 0 else 0
                },
                "consensus_performance": {
                    "consensus_cases": consensus_total,
                    "consensus_accuracy": (consensus_correct / consensus_total) * 100 if consensus_total > 0 else 0,
                    "consensus_vs_disagreement": {
                        "when_agree": (consensus_correct / consensus_total) * 100 if consensus_total > 0 else 0,
                        "when_disagree": ((correct_directions - consensus_correct) / (total_symbols - consensus_total)) * 100 if (total_symbols - consensus_total) > 0 else 0
                    }
                }
            }
        
        # Store validation results
        self.tracking_data["accuracy_history"].append(validation_results)
        self.save_tracking_data()
        
        print(f"📊 Validation Results:")
        print(f"   Overall Directional Accuracy: {validation_results['directional_accuracy']:.1f}% ({correct_directions}/{total_symbols})")
        
        # Show dual model analytics if available
        if dual_active_count > 0:
            dual_analytics = validation_results["dual_model_analytics"]
            print(f"   Dual Model Performance:")
            print(f"      Ensemble (TFT+N-HITS): {dual_analytics['model_accuracies']['ensemble']:.1f}%")
            print(f"      TFT Individual: {dual_analytics['model_accuracies']['tft_individual']:.1f}%")
            print(f"      N-HITS Individual: {dual_analytics['model_accuracies']['nhits_individual']:.1f}%")
            print(f"      Consensus Cases: {consensus_total}/{dual_active_count} ({(consensus_total/dual_active_count)*100:.1f}%)")
            if consensus_total > 0:
                print(f"      Consensus Accuracy: {dual_analytics['consensus_performance']['consensus_accuracy']:.1f}%")
        
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