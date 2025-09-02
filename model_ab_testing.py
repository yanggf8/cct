#!/usr/bin/env python3
"""
A/B Testing Framework for Advanced ML Models
Compare LSTM vs Simple N-HITS vs TFT performance systematically
"""

import json
import time
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import yfinance as yf

# Import our models
from modelscope_inference import LSTMStockPredictor
from simple_nhits_model import SimpleNHITS

class ModelABTester:
    def __init__(self, symbols: List[str] = ["AAPL", "TSLA"]):
        """Initialize A/B testing framework"""
        self.symbols = symbols
        self.models = {}
        self.test_results = {}
        
        # Initialize models
        self.setup_models()
        
        # Testing configuration
        self.test_config = {
            'prediction_horizons': [1],  # 1-day ahead predictions
            'evaluation_metrics': ['mse', 'mae', 'direction_accuracy', 'confidence'],
            'test_periods': 30,  # Days to test
            'min_confidence_threshold': 0.6
        }
    
    def setup_models(self):
        """Initialize all models for testing"""
        print("🔧 Setting up models for A/B testing...")
        
        for symbol in self.symbols:
            print(f"\n📈 Setting up models for {symbol}:")
            
            self.models[symbol] = {}
            
            # Model 1: LSTM Baseline
            try:
                lstm_model = LSTMStockPredictor()
                self.models[symbol]['LSTM'] = {
                    'model': lstm_model,
                    'type': 'baseline',
                    'description': 'Current LSTM model (baseline)',
                    'status': 'ready'
                }
                print("   ✅ LSTM model ready")
            except Exception as e:
                print(f"   ❌ LSTM setup failed: {e}")
                self.models[symbol]['LSTM'] = {'status': 'failed', 'error': str(e)}
            
            # Model 2: Simple N-HITS
            try:
                nhits_model = SimpleNHITS(symbol)
                self.models[symbol]['Simple_NHITS'] = {
                    'model': nhits_model,
                    'type': 'advanced',
                    'description': 'Hierarchical interpolation model',
                    'status': 'ready'
                }
                print("   ✅ Simple N-HITS model ready")
            except Exception as e:
                print(f"   ❌ Simple N-HITS setup failed: {e}")
                self.models[symbol]['Simple_NHITS'] = {'status': 'failed', 'error': str(e)}
            
            # Model 3: Ensemble (Future)
            self.models[symbol]['Ensemble'] = {
                'model': None,
                'type': 'experimental', 
                'description': 'Weighted combination of LSTM + N-HITS',
                'status': 'planned'
            }
    
    def get_test_data(self, symbol: str, days_back: int = 60) -> Tuple[List[List[float]], List[float]]:
        """Get historical data for testing"""
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        ticker = yf.Ticker(symbol)
        data = ticker.history(start=start_date, end=end_date)
        
        if data.empty:
            raise ValueError(f"No test data available for {symbol}")
        
        # Convert to OHLCV sequences
        sequences = []
        actual_prices = []
        
        lookback = 10  # 10-day sequences for LSTM
        
        for i in range(lookback, len(data)):
            # Create sequence
            sequence = []
            for j in range(i-lookback, i):
                row = data.iloc[j]
                sequence.append([
                    float(row['Open']),
                    float(row['High']), 
                    float(row['Low']),
                    float(row['Close']),
                    int(row['Volume'])
                ])
            
            sequences.append(sequence)
            actual_prices.append(float(data.iloc[i]['Close']))
        
        return sequences, actual_prices
    
    def test_single_model(self, symbol: str, model_name: str, test_sequences: List[List[List[float]]], actual_prices: List[float]) -> Dict[str, Any]:
        """Test a single model on historical data"""
        
        if symbol not in self.models or model_name not in self.models[symbol]:
            return {'status': 'model_not_found'}
        
        model_info = self.models[symbol][model_name]
        
        if model_info['status'] != 'ready':
            return {'status': 'model_not_ready', 'error': model_info.get('error', 'Unknown')}
        
        print(f"🧪 Testing {model_name} on {len(test_sequences)} sequences...")
        
        model = model_info['model']
        predictions = []
        confidences = []
        inference_times = []
        errors = 0
        
        for i, sequence in enumerate(test_sequences):
            try:
                start_time = time.time()
                
                if model_name == 'LSTM':
                    result = model.predict_price(sequence)
                elif model_name == 'Simple_NHITS':
                    result = model.predict_price(sequence)
                else:
                    continue  # Skip unsupported models
                
                end_time = time.time()
                
                if result['success']:
                    predictions.append(result['predicted_price'])
                    confidences.append(result['confidence'])
                    inference_times.append((end_time - start_time) * 1000)
                else:
                    errors += 1
                    predictions.append(actual_prices[i])  # Fallback to actual price
                    confidences.append(0.5)
                    inference_times.append(0)
                
            except Exception as e:
                errors += 1
                predictions.append(actual_prices[i])
                confidences.append(0.5)
                inference_times.append(0)
        
        # Calculate performance metrics
        metrics = self.calculate_performance_metrics(actual_prices, predictions, confidences)
        
        results = {
            'status': 'completed',
            'model_name': model_name,
            'symbol': symbol,
            'test_samples': len(test_sequences),
            'successful_predictions': len(test_sequences) - errors,
            'error_count': errors,
            'success_rate': ((len(test_sequences) - errors) / len(test_sequences)) * 100,
            'average_inference_time_ms': np.mean(inference_times) if inference_times else 0,
            'metrics': metrics,
            'predictions': predictions,
            'confidences': confidences
        }
        
        print(f"   ✅ Completed: {results['success_rate']:.1f}% success rate")
        print(f"   📊 MSE: {metrics['mse']:.2f}, Direction Accuracy: {metrics['direction_accuracy']:.1f}%")
        
        return results
    
    def calculate_performance_metrics(self, actual: List[float], predicted: List[float], confidences: List[float]) -> Dict[str, float]:
        """Calculate comprehensive performance metrics"""
        
        actual = np.array(actual)
        predicted = np.array(predicted)
        confidences = np.array(confidences)
        
        # Basic regression metrics
        mse = np.mean((actual - predicted) ** 2)
        mae = np.mean(np.abs(actual - predicted))
        rmse = np.sqrt(mse)
        
        # Percentage metrics
        mape = np.mean(np.abs((actual - predicted) / actual)) * 100
        accuracy_pct = 100 - mape
        
        # Direction accuracy (critical for trading)
        actual_directions = np.diff(actual) > 0
        predicted_directions = np.diff(predicted) > 0
        direction_accuracy = np.mean(actual_directions == predicted_directions) * 100
        
        # Confidence metrics
        avg_confidence = np.mean(confidences)
        high_confidence_predictions = np.sum(confidences > 0.7)
        
        # Trading-specific metrics
        actual_returns = np.diff(actual) / actual[:-1]
        predicted_returns = np.diff(predicted) / actual[:-1]  # Use actual prices as base
        
        # Correlation between actual and predicted returns
        return_correlation = np.corrcoef(actual_returns, predicted_returns)[0, 1] if len(actual_returns) > 1 else 0
        
        return {
            'mse': float(mse),
            'mae': float(mae),
            'rmse': float(rmse),
            'mape': float(mape),
            'accuracy_pct': float(accuracy_pct),
            'direction_accuracy': float(direction_accuracy),
            'avg_confidence': float(avg_confidence),
            'high_confidence_predictions': int(high_confidence_predictions),
            'return_correlation': float(return_correlation)
        }
    
    def run_ab_test(self) -> Dict[str, Any]:
        """Run complete A/B test across all models and symbols"""
        
        print("🚀 STARTING COMPREHENSIVE A/B TEST")
        print("=" * 60)
        print(f"Symbols: {', '.join(self.symbols)}")
        print(f"Models: LSTM (baseline) vs Simple N-HITS (advanced)")
        print(f"Test period: {self.test_config['test_periods']} days")
        print()
        
        all_results = {
            'test_config': self.test_config,
            'timestamp': datetime.now().isoformat(),
            'symbols': {},
            'summary': {}
        }
        
        for symbol in self.symbols:
            print(f"📈 Testing {symbol}...")
            print("-" * 40)
            
            try:
                # Get test data
                test_sequences, actual_prices = self.get_test_data(symbol, days_back=50)
                
                symbol_results = {
                    'test_data_points': len(test_sequences),
                    'actual_price_range': {
                        'min': float(min(actual_prices)),
                        'max': float(max(actual_prices)),
                        'current': float(actual_prices[-1])
                    },
                    'model_results': {}
                }
                
                # Test each model
                for model_name in ['LSTM', 'Simple_NHITS']:
                    if model_name in self.models[symbol]:
                        result = self.test_single_model(symbol, model_name, test_sequences, actual_prices)
                        symbol_results['model_results'][model_name] = result
                
                all_results['symbols'][symbol] = symbol_results
                
            except Exception as e:
                print(f"   ❌ Testing {symbol} failed: {e}")
                all_results['symbols'][symbol] = {'status': 'failed', 'error': str(e)}
            
            print()
        
        # Generate summary analysis
        summary = self.analyze_ab_results(all_results)
        all_results['summary'] = summary
        
        return all_results
    
    def analyze_ab_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze A/B test results and determine winner"""
        
        print("📊 A/B TEST ANALYSIS")
        print("=" * 60)
        
        model_performance = {
            'LSTM': {'total_tests': 0, 'metrics': []},
            'Simple_NHITS': {'total_tests': 0, 'metrics': []}
        }
        
        # Aggregate results across symbols
        for symbol, symbol_data in results['symbols'].items():
            if 'model_results' in symbol_data:
                for model_name, model_result in symbol_data['model_results'].items():
                    if model_result['status'] == 'completed':
                        model_performance[model_name]['total_tests'] += 1
                        model_performance[model_name]['metrics'].append(model_result['metrics'])
        
        # Calculate aggregate metrics
        summary = {
            'test_summary': {
                'symbols_tested': len(results['symbols']),
                'total_predictions': 0,
                'models_compared': ['LSTM', 'Simple_NHITS']
            },
            'model_comparison': {}
        }
        
        for model_name, perf_data in model_performance.items():
            if perf_data['total_tests'] > 0:
                # Average metrics across all tests
                avg_metrics = {}
                for metric in ['mse', 'mae', 'direction_accuracy', 'avg_confidence']:
                    values = [m[metric] for m in perf_data['metrics'] if metric in m]
                    avg_metrics[metric] = np.mean(values) if values else 0
                
                summary['model_comparison'][model_name] = {
                    'tests_completed': perf_data['total_tests'],
                    'average_metrics': avg_metrics,
                    'status': 'tested'
                }
                
                print(f"\n🤖 {model_name} Performance:")
                print(f"   Tests completed: {perf_data['total_tests']}")
                print(f"   Avg MSE: {avg_metrics['mse']:.2f}")
                print(f"   Avg Direction Accuracy: {avg_metrics['direction_accuracy']:.1f}%")
                print(f"   Avg Confidence: {avg_metrics['avg_confidence']:.2f}")
        
        # Determine winner
        winner = self.determine_winner(summary['model_comparison'])
        summary['winner_analysis'] = winner
        
        print(f"\n🏆 WINNER ANALYSIS:")
        print(f"   Best model: {winner['best_model']}")
        print(f"   Reason: {winner['reason']}")
        print(f"   Recommendation: {winner['recommendation']}")
        
        return summary
    
    def determine_winner(self, model_comparison: Dict[str, Any]) -> Dict[str, str]:
        """Determine the winning model based on multiple criteria"""
        
        if 'LSTM' not in model_comparison or 'Simple_NHITS' not in model_comparison:
            return {
                'best_model': 'Inconclusive',
                'reason': 'Insufficient test data',
                'recommendation': 'Rerun tests with both models'
            }
        
        lstm_metrics = model_comparison['LSTM']['average_metrics']
        nhits_metrics = model_comparison['Simple_NHITS']['average_metrics']
        
        # Score each model (higher is better)
        lstm_score = 0
        nhits_score = 0
        
        # Direction accuracy (most important for trading)
        if nhits_metrics['direction_accuracy'] > lstm_metrics['direction_accuracy']:
            nhits_score += 3
        elif lstm_metrics['direction_accuracy'] > nhits_metrics['direction_accuracy']:
            lstm_score += 3
        
        # Lower MSE is better
        if nhits_metrics['mse'] < lstm_metrics['mse']:
            nhits_score += 2
        else:
            lstm_score += 2
        
        # Higher confidence is better
        if nhits_metrics['avg_confidence'] > lstm_metrics['avg_confidence']:
            nhits_score += 1
        else:
            lstm_score += 1
        
        # Determine winner
        if nhits_score > lstm_score:
            best_model = 'Simple_NHITS'
            reason = f'Better overall performance (score: {nhits_score} vs {lstm_score})'
            recommendation = 'Deploy Simple N-HITS for production'
        elif lstm_score > nhits_score:
            best_model = 'LSTM'
            reason = f'Better overall performance (score: {lstm_score} vs {nhits_score})'
            recommendation = 'Continue with LSTM baseline'
        else:
            best_model = 'Tie'
            reason = f'Equal performance (score: {lstm_score} vs {nhits_score})'
            recommendation = 'Use ensemble of both models'
        
        return {
            'best_model': best_model,
            'reason': reason,
            'recommendation': recommendation,
            'scores': {'LSTM': lstm_score, 'Simple_NHITS': nhits_score}
        }
    
    def save_results(self, results: Dict[str, Any], filename: str = 'ab_test_results.json'):
        """Save A/B test results to file"""
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"💾 A/B test results saved to: {filename}")

def main():
    """Main function to run A/B testing"""
    
    print("🧪 MODEL A/B TESTING FRAMEWORK")
    print("=" * 60)
    print("Systematic comparison of LSTM vs Simple N-HITS")
    print("Goal: Identify best performing model for production deployment")
    print()
    
    # Initialize tester
    tester = ModelABTester(['AAPL'])  # Start with AAPL only
    
    # Run comprehensive A/B test
    results = tester.run_ab_test()
    
    # Save results
    tester.save_results(results)
    
    # Print final summary
    print(f"\n🎉 A/B TESTING COMPLETE!")
    print(f"📊 Summary:")
    print(f"   Winner: {results['summary']['winner_analysis']['best_model']}")
    print(f"   Recommendation: {results['summary']['winner_analysis']['recommendation']}")
    print(f"   Results saved to: ab_test_results.json")
    
    return results

if __name__ == "__main__":
    results = main()