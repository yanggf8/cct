#!/usr/bin/env python3
"""
TFT vs N-HITS Performance Comparison Framework
Compare TFT (primary) with N-HITS (backup) performance
"""

import json
import time
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import warnings
warnings.filterwarnings('ignore')

from lightweight_tft import LightweightTFTModel
from simple_nhits_model import SimpleNHITS

class TFTNHITSComparison:
    """Compare TFT and N-HITS models performance"""
    
    def __init__(self, symbols: List[str] = None):
        self.symbols = symbols or ["AAPL", "TSLA"]
        self.results = {}
        
        print(f"🔬 TFT vs N-HITS Comparison Framework")
        print(f"📊 Testing symbols: {', '.join(self.symbols)}")
    
    def train_both_models(self, symbol: str, days: int = 150) -> Dict[str, Any]:
        """Train both TFT and N-HITS models for comparison"""
        
        print(f"\n🚀 Training models for {symbol}")
        print("=" * 50)
        
        results = {
            'symbol': symbol,
            'training_days': days,
            'timestamp': datetime.now().isoformat(),
            'models': {}
        }
        
        # Train TFT (with N-HITS backup)
        print(f"1️⃣ Training TFT (Primary) for {symbol}...")
        tft_start = time.time()
        
        try:
            tft_model = LightweightTFTModel(symbol)
            tft_result = tft_model.train(days=days)
            tft_time = time.time() - tft_start
            
            results['models']['TFT'] = {
                **tft_result,
                'total_training_time_seconds': tft_time,
                'model_object': tft_model
            }
            
            print(f"✅ TFT training completed in {tft_time:.1f}s")
            
        except Exception as e:
            print(f"❌ TFT training failed: {e}")
            results['models']['TFT'] = {'error': str(e), 'success': False}
        
        # Train pure N-HITS for comparison
        print(f"\n2️⃣ Training Pure N-HITS for {symbol}...")
        nhits_start = time.time()
        
        try:
            nhits_model = SimpleNHITS(symbol)
            X, y = nhits_model.get_training_data(days=120)
            nhits_result = nhits_model.train(X, y, epochs=20)
            nhits_time = time.time() - nhits_start
            
            results['models']['N-HITS'] = {
                **nhits_result,
                'total_training_time_seconds': nhits_time,
                'model_object': nhits_model
            }
            
            print(f"✅ N-HITS training completed in {nhits_time:.1f}s")
            
        except Exception as e:
            print(f"❌ N-HITS training failed: {e}")
            results['models']['N-HITS'] = {'error': str(e), 'success': False}
        
        return results
    
    def generate_test_predictions(self, models_data: Dict[str, Any], num_tests: int = 5) -> Dict[str, Any]:
        """Generate predictions from both models for comparison"""
        
        symbol = models_data['symbol']
        print(f"\n🎯 Generating test predictions for {symbol} ({num_tests} tests)")
        
        # Generate test data
        test_cases = self._create_test_cases(symbol, num_tests)
        
        prediction_results = {
            'symbol': symbol,
            'test_cases': len(test_cases),
            'predictions': {
                'TFT': [],
                'N-HITS': []
            },
            'performance_metrics': {}
        }
        
        tft_model = models_data['models'].get('TFT', {}).get('model_object')
        nhits_model = models_data['models'].get('N-HITS', {}).get('model_object')
        
        # Test predictions
        for i, test_case in enumerate(test_cases):
            print(f"   Test {i+1}/{num_tests}: {len(test_case)} days of data")
            
            # TFT predictions
            if tft_model and hasattr(tft_model, 'predict_price'):
                try:
                    tft_start = time.time()
                    tft_pred = tft_model.predict_price(test_case)
                    tft_time = (time.time() - tft_start) * 1000  # ms
                    
                    tft_pred['inference_time_ms'] = tft_time
                    tft_pred['test_case'] = i + 1
                    prediction_results['predictions']['TFT'].append(tft_pred)
                    
                except Exception as e:
                    print(f"      ❌ TFT prediction {i+1} failed: {e}")
                    prediction_results['predictions']['TFT'].append({'error': str(e), 'test_case': i + 1})
            
            # N-HITS predictions  
            if nhits_model and hasattr(nhits_model, 'predict_price'):
                try:
                    nhits_start = time.time()
                    nhits_pred = nhits_model.predict_price(test_case)
                    nhits_time = (time.time() - nhits_start) * 1000  # ms
                    
                    nhits_pred['inference_time_ms'] = nhits_time
                    nhits_pred['test_case'] = i + 1
                    prediction_results['predictions']['N-HITS'].append(nhits_pred)
                    
                except Exception as e:
                    print(f"      ❌ N-HITS prediction {i+1} failed: {e}")
                    prediction_results['predictions']['N-HITS'].append({'error': str(e), 'test_case': i + 1})
        
        # Calculate performance metrics
        prediction_results['performance_metrics'] = self._calculate_prediction_metrics(prediction_results['predictions'])
        
        return prediction_results
    
    def _create_test_cases(self, symbol: str, num_cases: int) -> List[List[List[float]]]:
        """Create test cases with realistic market data patterns"""
        
        # Base case - realistic OHLCV data
        base_price = 200.0  # Starting price
        test_cases = []
        
        for case in range(num_cases):
            sequence = []
            current_price = base_price + (case * 10)  # Vary starting price
            
            # Generate 60 days of realistic data
            for day in range(60):
                # Add some randomness and trends
                trend = 0.002 * (case - 2)  # Different trends per case
                volatility = 0.02 + (case * 0.005)  # Different volatility
                
                daily_change = np.random.normal(trend, volatility)
                new_price = current_price * (1 + daily_change)
                
                # Generate OHLCV
                high = new_price * (1 + abs(np.random.normal(0, 0.01)))
                low = new_price * (1 - abs(np.random.normal(0, 0.01)))
                open_price = current_price + np.random.normal(0, current_price * 0.005)
                volume = int(np.random.normal(50000000, 10000000))
                
                sequence.append([open_price, high, low, new_price, volume])
                current_price = new_price
            
            test_cases.append(sequence)
        
        return test_cases
    
    def _calculate_prediction_metrics(self, predictions: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """Calculate performance metrics for both models"""
        
        metrics = {}
        
        for model_name, preds in predictions.items():
            if not preds:
                continue
                
            successful_preds = [p for p in preds if p.get('success', False)]
            
            if not successful_preds:
                metrics[model_name] = {'success_rate': 0.0}
                continue
            
            # Calculate metrics
            confidences = [p.get('confidence', 0) for p in successful_preds]
            inference_times = [p.get('inference_time_ms', 0) for p in successful_preds]
            price_changes = [abs(p.get('price_change_percent', 0)) for p in successful_preds]
            
            metrics[model_name] = {
                'success_rate': len(successful_preds) / len(preds),
                'avg_confidence': np.mean(confidences) if confidences else 0,
                'avg_inference_time_ms': np.mean(inference_times) if inference_times else 0,
                'avg_price_change_pct': np.mean(price_changes) if price_changes else 0,
                'total_predictions': len(preds),
                'successful_predictions': len(successful_preds),
                'failed_predictions': len(preds) - len(successful_preds)
            }
        
        return metrics
    
    def compare_models(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive model comparison"""
        
        symbol = results['symbol']
        print(f"\n📊 Comparing TFT vs N-HITS for {symbol}")
        print("=" * 60)
        
        comparison = {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'training_comparison': {},
            'prediction_comparison': {},
            'overall_winner': None,
            'recommendation': None
        }
        
        # Training comparison
        tft_training = results['models'].get('TFT', {})
        nhits_training = results['models'].get('N-HITS', {})
        
        if tft_training.get('success') and nhits_training.get('success'):
            comparison['training_comparison'] = {
                'TFT': {
                    'model_type': tft_training.get('model_type', 'Unknown'),
                    'training_time': tft_training.get('total_training_time_seconds', 0),
                    'direction_accuracy': tft_training.get('direction_accuracy', 0),
                    'confidence': tft_training.get('confidence', 0),
                    'fallback_used': tft_training.get('fallback_used', False)
                },
                'N-HITS': {
                    'model_type': nhits_training.get('model_type', 'Simple-NHITS'),
                    'training_time': nhits_training.get('total_training_time_seconds', 0),
                    'direction_accuracy': nhits_training.get('validation_metrics', {}).get('direction_accuracy_pct', 0) / 100,
                    'confidence': 0.58,  # N-HITS baseline
                    'fallback_used': False
                }
            }
        
        # Prediction comparison
        if 'predictions' in results:
            pred_metrics = results['predictions']['performance_metrics']
            comparison['prediction_comparison'] = pred_metrics
        
        # Determine winner
        winner_score = self._calculate_winner_score(comparison)
        comparison['winner_scores'] = winner_score
        comparison['overall_winner'] = max(winner_score.keys(), key=lambda k: winner_score[k])
        
        # Generate recommendation
        comparison['recommendation'] = self._generate_recommendation(comparison)
        
        # Print comparison
        self._print_comparison_results(comparison)
        
        return comparison
    
    def _calculate_winner_score(self, comparison: Dict[str, Any]) -> Dict[str, float]:
        """Calculate winner scores based on multiple metrics"""
        
        scores = {'TFT': 0.0, 'N-HITS': 0.0}
        
        # Training metrics (40% weight)
        training = comparison.get('training_comparison', {})
        if 'TFT' in training and 'N-HITS' in training:
            # Accuracy score (20%)
            tft_acc = training['TFT'].get('direction_accuracy', 0)
            nhits_acc = training['N-HITS'].get('direction_accuracy', 0)
            if tft_acc > nhits_acc:
                scores['TFT'] += 20
            elif nhits_acc > tft_acc:
                scores['N-HITS'] += 20
            else:
                scores['TFT'] += 10
                scores['N-HITS'] += 10
            
            # Speed score (20%)
            tft_time = training['TFT'].get('training_time', float('inf'))
            nhits_time = training['N-HITS'].get('training_time', float('inf'))
            if tft_time < nhits_time:
                scores['TFT'] += 20
            elif nhits_time < tft_time:
                scores['N-HITS'] += 20
            else:
                scores['TFT'] += 10
                scores['N-HITS'] += 10
        
        # Prediction metrics (60% weight)
        predictions = comparison.get('prediction_comparison', {})
        if 'TFT' in predictions and 'N-HITS' in predictions:
            # Success rate (30%)
            tft_success = predictions['TFT'].get('success_rate', 0)
            nhits_success = predictions['N-HITS'].get('success_rate', 0)
            if tft_success > nhits_success:
                scores['TFT'] += 30
            elif nhits_success > tft_success:
                scores['N-HITS'] += 30
            else:
                scores['TFT'] += 15
                scores['N-HITS'] += 15
            
            # Inference speed (15%)
            tft_inference = predictions['TFT'].get('avg_inference_time_ms', float('inf'))
            nhits_inference = predictions['N-HITS'].get('avg_inference_time_ms', float('inf'))
            if tft_inference < nhits_inference:
                scores['TFT'] += 15
            elif nhits_inference < tft_inference:
                scores['N-HITS'] += 15
            else:
                scores['TFT'] += 7.5
                scores['N-HITS'] += 7.5
            
            # Confidence (15%)
            tft_conf = predictions['TFT'].get('avg_confidence', 0)
            nhits_conf = predictions['N-HITS'].get('avg_confidence', 0)
            if tft_conf > nhits_conf:
                scores['TFT'] += 15
            elif nhits_conf > tft_conf:
                scores['N-HITS'] += 15
            else:
                scores['TFT'] += 7.5
                scores['N-HITS'] += 7.5
        
        return scores
    
    def _generate_recommendation(self, comparison: Dict[str, Any]) -> str:
        """Generate recommendation based on comparison"""
        
        winner = comparison.get('overall_winner', 'Unknown')
        scores = comparison.get('winner_scores', {})
        
        tft_score = scores.get('TFT', 0)
        nhits_score = scores.get('N-HITS', 0)
        
        if winner == 'TFT' and tft_score > nhits_score + 20:
            return f"🟢 Use TFT as primary model - significantly outperforms N-HITS (score: {tft_score:.1f} vs {nhits_score:.1f})"
        elif winner == 'TFT':
            return f"🟡 Use TFT as primary with N-HITS backup - marginal improvement (score: {tft_score:.1f} vs {nhits_score:.1f})"
        elif winner == 'N-HITS' and nhits_score > tft_score + 20:
            return f"🔴 Use N-HITS only - TFT provides no benefit (score: {nhits_score:.1f} vs {tft_score:.1f})"
        else:
            return f"🟡 Close performance - use TFT primary with N-HITS backup for reliability (N-HITS score: {nhits_score:.1f} vs TFT: {tft_score:.1f})"
    
    def _print_comparison_results(self, comparison: Dict[str, Any]):
        """Print detailed comparison results"""
        
        symbol = comparison['symbol']
        print(f"\n🏆 COMPARISON RESULTS FOR {symbol}")
        print("=" * 50)
        
        # Training comparison
        training = comparison.get('training_comparison', {})
        if training:
            print(f"\n📚 TRAINING PERFORMANCE:")
            for model, metrics in training.items():
                print(f"   {model}:")
                print(f"      Model Type: {metrics.get('model_type', 'Unknown')}")
                print(f"      Training Time: {metrics.get('training_time', 0):.1f}s")
                print(f"      Direction Accuracy: {metrics.get('direction_accuracy', 0):.1%}")
                print(f"      Confidence: {metrics.get('confidence', 0):.2f}")
                print(f"      Fallback Used: {metrics.get('fallback_used', False)}")
        
        # Prediction comparison
        predictions = comparison.get('prediction_comparison', {})
        if predictions:
            print(f"\n🎯 PREDICTION PERFORMANCE:")
            for model, metrics in predictions.items():
                print(f"   {model}:")
                print(f"      Success Rate: {metrics.get('success_rate', 0):.1%}")
                print(f"      Avg Confidence: {metrics.get('avg_confidence', 0):.2f}")
                print(f"      Avg Inference Time: {metrics.get('avg_inference_time_ms', 0):.1f}ms")
                print(f"      Predictions: {metrics.get('successful_predictions', 0)}/{metrics.get('total_predictions', 0)}")
        
        # Winner and recommendation
        winner = comparison.get('overall_winner', 'Unknown')
        scores = comparison.get('winner_scores', {})
        recommendation = comparison.get('recommendation', 'No recommendation')
        
        print(f"\n🏆 WINNER: {winner}")
        print(f"📊 SCORES: TFT: {scores.get('TFT', 0):.1f}, N-HITS: {scores.get('N-HITS', 0):.1f}")
        print(f"💡 RECOMMENDATION: {recommendation}")
    
    def run_full_comparison(self, days: int = 150, num_predictions: int = 5) -> Dict[str, Any]:
        """Run complete comparison for all symbols"""
        
        print(f"🚀 STARTING FULL TFT vs N-HITS COMPARISON")
        print(f"📊 Symbols: {', '.join(self.symbols)}")
        print(f"📅 Training days: {days}")
        print(f"🎯 Test predictions: {num_predictions}")
        print("=" * 70)
        
        all_results = {
            'comparison_started': datetime.now().isoformat(),
            'symbols': self.symbols,
            'parameters': {
                'training_days': days,
                'test_predictions': num_predictions
            },
            'results': {},
            'summary': {}
        }
        
        for symbol in self.symbols:
            print(f"\n🔬 TESTING {symbol}")
            print("="*60)
            
            try:
                # Train models
                training_results = self.train_both_models(symbol, days)
                
                # Generate predictions
                prediction_results = self.generate_test_predictions(training_results, num_predictions)
                
                # Combine results
                combined_results = {**training_results, **prediction_results}
                
                # Compare models
                comparison = self.compare_models(combined_results)
                
                all_results['results'][symbol] = {
                    'training': training_results,
                    'predictions': prediction_results,
                    'comparison': comparison
                }
                
            except Exception as e:
                print(f"❌ Error testing {symbol}: {e}")
                all_results['results'][symbol] = {'error': str(e)}
        
        # Generate overall summary
        all_results['summary'] = self._generate_overall_summary(all_results['results'])
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f'tft_nhits_comparison_{timestamp}.json'
        
        with open(filename, 'w') as f:
            # Remove model objects before saving
            clean_results = self._clean_results_for_json(all_results)
            json.dump(clean_results, f, indent=2)
        
        print(f"\n💾 Results saved to: {filename}")
        return all_results
    
    def _clean_results_for_json(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Remove non-serializable objects from results"""
        
        clean_results = json.loads(json.dumps(results, default=str))
        
        # Remove model_object keys
        for symbol_results in clean_results.get('results', {}).values():
            if isinstance(symbol_results, dict) and 'training' in symbol_results:
                training = symbol_results['training']
                if 'models' in training:
                    for model_data in training['models'].values():
                        if 'model_object' in model_data:
                            del model_data['model_object']
        
        return clean_results
    
    def _generate_overall_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate overall summary across all symbols"""
        
        winners = []
        recommendations = []
        
        for symbol, data in results.items():
            if isinstance(data, dict) and 'comparison' in data:
                comparison = data['comparison']
                winner = comparison.get('overall_winner')
                recommendation = comparison.get('recommendation', '')
                
                if winner:
                    winners.append(winner)
                
                if 'TFT' in recommendation and '🟢' in recommendation:
                    recommendations.append('Use TFT Primary')
                elif 'TFT' in recommendation and '🟡' in recommendation:
                    recommendations.append('Use TFT + N-HITS Backup')
                else:
                    recommendations.append('Use N-HITS Only')
        
        # Count winners
        winner_counts = {'TFT': winners.count('TFT'), 'N-HITS': winners.count('N-HITS')}
        
        # Most common recommendation
        rec_counts = {}
        for rec in recommendations:
            rec_counts[rec] = rec_counts.get(rec, 0) + 1
        
        most_common_rec = max(rec_counts.keys(), key=lambda k: rec_counts[k]) if rec_counts else 'No recommendation'
        
        return {
            'total_symbols_tested': len(results),
            'successful_tests': len([r for r in results.values() if isinstance(r, dict) and 'comparison' in r]),
            'winner_counts': winner_counts,
            'overall_recommendation': most_common_rec,
            'recommendation_distribution': rec_counts
        }

def main():
    """Run TFT vs N-HITS comparison"""
    
    # Test with 2 symbols
    symbols = ["AAPL", "TSLA"]
    
    comparator = TFTNHITSComparison(symbols)
    results = comparator.run_full_comparison(days=120, num_predictions=3)
    
    # Print final summary
    print(f"\n🎉 FINAL SUMMARY")
    print("=" * 50)
    summary = results['summary']
    
    print(f"📊 Symbols tested: {summary['successful_tests']}/{summary['total_symbols_tested']}")
    print(f"🏆 Winners: TFT: {summary['winner_counts']['TFT']}, N-HITS: {summary['winner_counts']['N-HITS']}")
    print(f"💡 Overall recommendation: {summary['overall_recommendation']}")
    
    return results

if __name__ == "__main__":
    results = main()