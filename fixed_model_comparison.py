#!/usr/bin/env python3
"""
Fixed Model Comparison - Direct Testing
Compare LSTM vs Simple N-HITS with working predictions
"""

import json
import time
import numpy as np
from datetime import datetime
from typing import Dict, Any

# Import our models
from modelscope_inference import LSTMStockPredictor
from simple_nhits_model import SimpleNHITS

def test_models_directly():
    """Test both models with identical input data"""
    
    print("🧪 DIRECT MODEL COMPARISON TEST")
    print("=" * 50)
    print("Testing LSTM vs Simple N-HITS with identical sample data")
    print()
    
    # Sample OHLCV data (last 10 days for LSTM input)
    sample_data = [
        [220.0, 225.0, 218.5, 223.0, 45000000],  # Day 1
        [223.5, 227.0, 221.0, 225.8, 42000000],  # Day 2
        [225.0, 230.2, 223.5, 228.1, 48000000],  # Day 3
        [227.8, 232.0, 226.0, 230.5, 44000000],  # Day 4
        [230.0, 235.5, 228.5, 233.2, 46000000],  # Day 5
        [232.8, 238.0, 231.0, 236.4, 50000000],  # Day 6
        [235.5, 240.0, 233.8, 238.7, 47000000],  # Day 7
        [238.0, 242.5, 236.2, 240.1, 45000000],  # Day 8
        [239.5, 244.0, 237.8, 241.9, 49000000],  # Day 9
        [241.2, 245.5, 239.5, 243.6, 46000000],  # Day 10 (current)
    ]
    
    current_price = sample_data[-1][3]  # Last close price
    print(f"📊 Current price: ${current_price:.2f}")
    print(f"📈 Input data: 10 days of OHLCV sequences")
    print()
    
    results = {
        'test_timestamp': datetime.now().isoformat(),
        'input_data': {
            'current_price': current_price,
            'sequence_length': len(sample_data),
            'data_points': sample_data
        },
        'model_results': {}
    }
    
    # Test 1: LSTM Model
    print("🤖 Testing LSTM Model...")
    try:
        lstm_model = LSTMStockPredictor()
        
        start_time = time.time()
        lstm_result = lstm_model.predict_price(sample_data)
        end_time = time.time()
        
        if lstm_result['success']:
            lstm_performance = {
                'predicted_price': lstm_result['predicted_price'],
                'confidence': lstm_result['confidence'],
                'inference_time_ms': (end_time - start_time) * 1000,
                'model_type': lstm_result['model_type'],
                'success': True,
                'price_change': lstm_result['predicted_price'] - current_price,
                'price_change_pct': ((lstm_result['predicted_price'] - current_price) / current_price) * 100
            }
            
            print(f"   ✅ Prediction: ${lstm_result['predicted_price']:.2f}")
            print(f"   📊 Confidence: {lstm_result['confidence']:.2f}")
            print(f"   ⚡ Inference: {lstm_performance['inference_time_ms']:.1f}ms")
            print(f"   📈 Change: {lstm_performance['price_change_pct']:+.1f}%")
        else:
            lstm_performance = {'success': False, 'error': lstm_result.get('error', 'Unknown')}
            print(f"   ❌ LSTM prediction failed: {lstm_performance['error']}")
        
        results['model_results']['LSTM'] = lstm_performance
        
    except Exception as e:
        print(f"   ❌ LSTM test failed: {str(e)}")
        results['model_results']['LSTM'] = {'success': False, 'error': str(e)}
    
    print()
    
    # Test 2: Simple N-HITS Model
    print("🧠 Testing Simple N-HITS Model...")
    try:
        nhits_model = SimpleNHITS("AAPL")
        
        # Train the model first (quick training on limited data)
        print("   📚 Quick training...")
        try:
            X, y = nhits_model.get_training_data(days=90)  # 3 months
            training_result = nhits_model.train(X, y, epochs=10)  # Quick training
            
            if training_result['status'] == 'success':
                print(f"   ✅ Training completed ({training_result['epochs_completed']} epochs)")
            else:
                print(f"   ⚠️ Training issues, using fallback prediction")
        except Exception as e:
            print(f"   ⚠️ Training failed: {str(e)}, using fallback")
        
        start_time = time.time()
        nhits_result = nhits_model.predict_price(sample_data)
        end_time = time.time()
        
        if nhits_result['success']:
            nhits_performance = {
                'predicted_price': nhits_result['predicted_price'],
                'confidence': nhits_result['confidence'],
                'inference_time_ms': (end_time - start_time) * 1000,
                'model_type': nhits_result['model_type'],
                'success': True,
                'price_change': nhits_result['predicted_price'] - current_price,
                'price_change_pct': ((nhits_result['predicted_price'] - current_price) / current_price) * 100
            }
            
            print(f"   ✅ Prediction: ${nhits_result['predicted_price']:.2f}")
            print(f"   📊 Confidence: {nhits_result['confidence']:.2f}")
            print(f"   ⚡ Inference: {nhits_performance['inference_time_ms']:.1f}ms")
            print(f"   📈 Change: {nhits_performance['price_change_pct']:+.1f}%")
        else:
            nhits_performance = {'success': False, 'error': nhits_result.get('error', 'Unknown')}
            print(f"   ❌ N-HITS prediction failed: {nhits_performance['error']}")
        
        results['model_results']['Simple_NHITS'] = nhits_performance
        
    except Exception as e:
        print(f"   ❌ N-HITS test failed: {str(e)}")
        results['model_results']['Simple_NHITS'] = {'success': False, 'error': str(e)}
    
    print()
    
    # Generate comparison analysis
    comparison = analyze_model_comparison(results)
    results['comparison_analysis'] = comparison
    
    return results

def analyze_model_comparison(results: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze the direct comparison results"""
    
    print("📊 MODEL COMPARISON ANALYSIS")
    print("=" * 50)
    
    lstm_result = results['model_results'].get('LSTM', {})
    nhits_result = results['model_results'].get('Simple_NHITS', {})
    
    analysis = {
        'both_models_working': False,
        'winner': 'N/A',
        'comparison_metrics': {},
        'recommendations': []
    }
    
    if lstm_result.get('success') and nhits_result.get('success'):
        analysis['both_models_working'] = True
        
        # Compare predictions
        lstm_price = lstm_result['predicted_price']
        nhits_price = nhits_result['predicted_price']
        current_price = results['input_data']['current_price']
        
        price_diff = abs(lstm_price - nhits_price)
        price_diff_pct = (price_diff / current_price) * 100
        
        # Compare confidence
        lstm_conf = lstm_result['confidence']
        nhits_conf = nhits_result['confidence']
        conf_diff = nhits_conf - lstm_conf
        
        # Compare inference speed
        lstm_speed = lstm_result['inference_time_ms']
        nhits_speed = nhits_result['inference_time_ms']
        speed_ratio = lstm_speed / nhits_speed if nhits_speed > 0 else 1
        
        analysis['comparison_metrics'] = {
            'price_difference_usd': price_diff,
            'price_difference_pct': price_diff_pct,
            'confidence_difference': conf_diff,
            'speed_ratio_lstm_vs_nhits': speed_ratio
        }
        
        # Determine winner based on multiple factors
        score_lstm = 0
        score_nhits = 0
        
        # Higher confidence wins
        if lstm_conf > nhits_conf:
            score_lstm += 1
        elif nhits_conf > lstm_conf:
            score_nhits += 1
        
        # Faster inference wins
        if lstm_speed < nhits_speed:
            score_lstm += 1
        elif nhits_speed < lstm_speed:
            score_nhits += 1
        
        # More conservative prediction (closer to current price) gets bonus
        lstm_change_pct = abs(lstm_result['price_change_pct'])
        nhits_change_pct = abs(nhits_result['price_change_pct'])
        
        if lstm_change_pct < nhits_change_pct and lstm_change_pct < 10:  # Conservative and reasonable
            score_lstm += 1
        elif nhits_change_pct < lstm_change_pct and nhits_change_pct < 10:
            score_nhits += 1
        
        # Determine winner
        if score_lstm > score_nhits:
            analysis['winner'] = 'LSTM'
            analysis['winner_reason'] = f'Better overall performance (score: {score_lstm} vs {score_nhits})'
        elif score_nhits > score_lstm:
            analysis['winner'] = 'Simple_NHITS'
            analysis['winner_reason'] = f'Better overall performance (score: {score_nhits} vs {score_lstm})'
        else:
            analysis['winner'] = 'Tie'
            analysis['winner_reason'] = f'Equal performance (score: {score_lstm} vs {score_nhits})'
        
        print(f"🔍 Comparison Results:")
        print(f"   LSTM: ${lstm_price:.2f} (conf: {lstm_conf:.2f}, {lstm_speed:.0f}ms)")
        print(f"   N-HITS: ${nhits_price:.2f} (conf: {nhits_conf:.2f}, {nhits_speed:.0f}ms)")
        print(f"   Price difference: ${price_diff:.2f} ({price_diff_pct:.1f}%)")
        print(f"   Confidence difference: {conf_diff:+.2f}")
        print(f"   Speed ratio: {speed_ratio:.1f}x")
        print(f"   Winner: {analysis['winner']}")
        print(f"   Reason: {analysis['winner_reason']}")
        
        # Recommendations
        if analysis['winner'] == 'LSTM':
            analysis['recommendations'] = [
                'Continue using LSTM as primary model',
                'Consider N-HITS as backup or ensemble component',
                'LSTM shows better balance of speed and confidence'
            ]
        elif analysis['winner'] == 'Simple_NHITS':
            analysis['recommendations'] = [
                'Consider upgrading to Simple N-HITS',
                'N-HITS shows superior performance metrics',
                'Test N-HITS with live trading data before full deployment'
            ]
        else:
            analysis['recommendations'] = [
                'Both models perform similarly',
                'Consider ensemble approach combining both',
                'A/B test with live data to determine real-world winner'
            ]
    
    elif lstm_result.get('success'):
        analysis['winner'] = 'LSTM'
        analysis['winner_reason'] = 'Only model working successfully'
        analysis['recommendations'] = ['Use LSTM, fix N-HITS implementation']
        print("   ✅ LSTM working, ❌ N-HITS failed")
    
    elif nhits_result.get('success'):
        analysis['winner'] = 'Simple_NHITS'
        analysis['winner_reason'] = 'Only model working successfully'
        analysis['recommendations'] = ['Use N-HITS, investigate LSTM issues']
        print("   ❌ LSTM failed, ✅ N-HITS working")
    
    else:
        analysis['winner'] = 'Neither'
        analysis['winner_reason'] = 'Both models failed'
        analysis['recommendations'] = ['Debug both models, check data formats and dependencies']
        print("   ❌ Both models failed")
    
    print(f"\n💡 Recommendations:")
    for rec in analysis['recommendations']:
        print(f"   • {rec}")
    
    return analysis

def main():
    """Run the direct model comparison"""
    
    print("🚀 ADVANCED ML MODELS - DIRECT COMPARISON")
    print("=" * 60)
    print("Testing LSTM vs Simple N-HITS with identical sample data")
    print("Goal: Determine which model performs better in controlled conditions")
    print()
    
    # Run the comparison
    results = main_comparison = test_models_directly()
    
    # Save results
    with open('direct_model_comparison.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n🎉 COMPARISON COMPLETE!")
    print(f"💾 Results saved to: direct_model_comparison.json")
    
    # Final summary
    analysis = results['comparison_analysis']
    print(f"\n📋 FINAL SUMMARY:")
    print(f"   Winner: {analysis['winner']}")
    print(f"   Reason: {analysis.get('winner_reason', 'See detailed analysis')}")
    
    if analysis['both_models_working']:
        metrics = analysis['comparison_metrics']
        print(f"   Price difference: {metrics['price_difference_pct']:.1f}%")
        print(f"   Confidence difference: {metrics['confidence_difference']:+.2f}")
        print(f"   Performance: {'Both models operational' if analysis['both_models_working'] else 'Issues detected'}")
    
    return results

if __name__ == "__main__":
    results = main()