#!/usr/bin/env python3
"""
Prediction Tracker - Daily Validation System
Track our predictions vs actual market performance for POC validation
"""

import json
import time
import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List

class PredictionTracker:
    def __init__(self):
        self.predictions_file = 'daily_predictions.json'
        self.validation_file = 'prediction_validation.json'
    
    def save_today_predictions(self, predictions: Dict):
        """Save today's predictions for tomorrow's validation"""
        
        # Load existing predictions
        try:
            with open(self.predictions_file, 'r') as f:
                all_predictions = json.load(f)
        except FileNotFoundError:
            all_predictions = {}
        
        # Add today's predictions
        today = datetime.now().strftime('%Y-%m-%d')
        all_predictions[today] = {
            'timestamp': datetime.now().isoformat(),
            'predictions': predictions,
            'validation_date': (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
            'status': 'pending'
        }
        
        # Save updated predictions
        with open(self.predictions_file, 'w') as f:
            json.dump(all_predictions, f, indent=2)
        
        print(f"💾 Today's predictions saved for validation tomorrow")
        return all_predictions
    
    def get_current_prices(self, symbols: List[str]) -> Dict:
        """Get current market prices for validation"""
        current_prices = {}
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                hist = ticker.history(period="1d")
                if not hist.empty:
                    current_prices[symbol] = {
                        'price': float(hist['Close'].iloc[-1]),
                        'timestamp': hist.index[-1].isoformat(),
                        'success': True
                    }
                else:
                    current_prices[symbol] = {'success': False, 'error': 'No data'}
            except Exception as e:
                current_prices[symbol] = {'success': False, 'error': str(e)}
        
        return current_prices
    
    def validate_predictions(self, date: str = None):
        """Validate predictions for a specific date (or yesterday if None)"""
        
        if date is None:
            # Default to yesterday's predictions
            date = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Load predictions
        try:
            with open(self.predictions_file, 'r') as f:
                all_predictions = json.load(f)
        except FileNotFoundError:
            print("❌ No predictions file found")
            return None
        
        if date not in all_predictions:
            print(f"❌ No predictions found for {date}")
            return None
        
        prediction_data = all_predictions[date]
        predictions = prediction_data['predictions']
        
        print(f"🔍 Validating predictions from {date}")
        print("=" * 60)
        
        # Get current prices for validation
        symbols = list(predictions.keys())
        current_prices = self.get_current_prices(symbols)
        
        validation_results = {}
        
        for symbol in symbols:
            if symbol not in current_prices or not current_prices[symbol]['success']:
                print(f"❌ {symbol}: Could not get current price")
                continue
            
            pred_data = predictions[symbol]
            current_price = current_prices[symbol]['price']
            
            # Extract prediction details
            if 'components' in pred_data and 'price_prediction' in pred_data['components']:
                predicted_price = pred_data['components']['price_prediction']['predicted_price']
                original_price = pred_data['current_price']
                predicted_change_pct = pred_data['components']['price_prediction']['change_pct']
                
                # Calculate actual change
                actual_change = current_price - original_price
                actual_change_pct = (actual_change / original_price) * 100
                
                # Calculate prediction accuracy
                price_error = abs(predicted_price - current_price)
                price_error_pct = (price_error / current_price) * 100
                
                # Direction accuracy
                predicted_direction = 'UP' if predicted_change_pct > 0 else 'DOWN' if predicted_change_pct < 0 else 'FLAT'
                actual_direction = 'UP' if actual_change_pct > 0 else 'DOWN' if actual_change_pct < 0 else 'FLAT'
                direction_correct = predicted_direction == actual_direction
                
                validation_results[symbol] = {
                    'original_price': original_price,
                    'predicted_price': predicted_price,
                    'actual_price': current_price,
                    'predicted_change_pct': predicted_change_pct,
                    'actual_change_pct': actual_change_pct,
                    'price_error': price_error,
                    'price_error_pct': price_error_pct,
                    'direction_correct': direction_correct,
                    'predicted_direction': predicted_direction,
                    'actual_direction': actual_direction,
                    'trading_signal': pred_data.get('trading_signal', {}),
                    'success': True
                }
                
                # Display results
                print(f"📊 {symbol}:")
                print(f"   Original: ${original_price:.2f}")
                print(f"   Predicted: ${predicted_price:.2f} ({predicted_change_pct:+.1f}%)")
                print(f"   Actual: ${current_price:.2f} ({actual_change_pct:+.1f}%)")
                print(f"   Price Error: ${price_error:.2f} ({price_error_pct:.1f}%)")
                print(f"   Direction: {predicted_direction} → {actual_direction} {'✅' if direction_correct else '❌'}")
                
                signal = pred_data.get('trading_signal', {})
                if signal:
                    print(f"   Our Signal: {signal.get('action', 'N/A')} {signal.get('strength', '')}")
                print()
        
        # Calculate overall accuracy
        if validation_results:
            successful_validations = len([r for r in validation_results.values() if r['success']])
            avg_price_error = sum(r['price_error_pct'] for r in validation_results.values()) / len(validation_results)
            direction_accuracy = sum(1 for r in validation_results.values() if r['direction_correct']) / len(validation_results) * 100
            
            print(f"📈 VALIDATION SUMMARY:")
            print(f"   Stocks validated: {successful_validations}/{len(symbols)}")
            print(f"   Average price error: {avg_price_error:.1f}%")
            print(f"   Direction accuracy: {direction_accuracy:.0f}%")
            
            # Save validation results
            validation_data = {
                'date': date,
                'validation_timestamp': datetime.now().isoformat(),
                'results': validation_results,
                'summary': {
                    'stocks_validated': successful_validations,
                    'total_stocks': len(symbols),
                    'avg_price_error_pct': avg_price_error,
                    'direction_accuracy_pct': direction_accuracy
                }
            }
            
            # Load and update validation history
            try:
                with open(self.validation_file, 'r') as f:
                    validation_history = json.load(f)
            except FileNotFoundError:
                validation_history = {}
            
            validation_history[date] = validation_data
            
            with open(self.validation_file, 'w') as f:
                json.dump(validation_history, f, indent=2)
            
            print(f"💾 Validation results saved to {self.validation_file}")
            
            # Update prediction status
            all_predictions[date]['status'] = 'validated'
            all_predictions[date]['validation_results'] = validation_data
            
            with open(self.predictions_file, 'w') as f:
                json.dump(all_predictions, f, indent=2)
            
            return validation_data
        
        return None

def save_todays_predictions():
    """Extract and save today's predictions from the complete POC results"""
    
    print("📋 Extracting Today's Predictions for Tomorrow's Validation")
    print("=" * 60)
    
    try:
        # Load the complete POC results
        with open('complete_poc_results.json', 'r') as f:
            poc_results = json.load(f)
        
        # Extract predictions from individual results
        predictions = {}
        for symbol, result in poc_results['individual_results'].items():
            if result['success']:
                predictions[symbol] = {
                    'symbol': symbol,
                    'timestamp': result['timestamp'],
                    'current_price': result['current_price'],
                    'trading_signal': result['trading_signal'],
                    'components': result['components']
                }
        
        # Save predictions
        tracker = PredictionTracker()
        tracker.save_today_predictions(predictions)
        
        print(f"✅ Saved predictions for {len(predictions)} stocks:")
        for symbol, pred in predictions.items():
            price_pred = pred['components']['price_prediction']
            signal = pred['trading_signal']
            
            print(f"   {symbol}: ${pred['current_price']:.2f} → ${price_pred['predicted_price']:.2f}")
            print(f"           Change: {price_pred['change_pct']:+.1f}% | Signal: {signal['action']} {signal['strength']}")
        
        print(f"\n💡 Run 'python prediction_tracker.py validate' tomorrow to check accuracy!")
        
    except FileNotFoundError:
        print("❌ complete_poc_results.json not found")
        print("   Run the integrated trading system first")

def main():
    """Main function for prediction tracking"""
    import sys
    
    tracker = PredictionTracker()
    
    if len(sys.argv) > 1 and sys.argv[1] == 'validate':
        # Validate yesterday's predictions
        if len(sys.argv) > 2:
            date = sys.argv[2]
            tracker.validate_predictions(date)
        else:
            tracker.validate_predictions()
    else:
        # Save today's predictions
        save_todays_predictions()

if __name__ == "__main__":
    main()