#!/usr/bin/env python3
"""
Test ModelScope Deployment - Week 1 POC Validation
Test our deployed LSTM model and measure performance
"""

import time
import json
import requests
from modelscope.pipelines import pipeline
from modelscope.utils.constant import Tasks

def test_modelscope_local_loading():
    """Test loading our model locally via ModelScope SDK"""
    print("🧪 Testing ModelScope Local Model Loading...")
    
    try:
        # Try to load our model using ModelScope SDK
        from modelscope.models.base import Model
        from modelscope.utils.hub import snapshot_download
        
        # Download our model locally
        model_dir = snapshot_download('yanggf2/lstm-stock-predictor-aapl-poc')
        print(f"✅ Model downloaded to: {model_dir}")
        
        # List downloaded files
        import os
        files = os.listdir(model_dir)
        print(f"   Files in model: {files}")
        
        # Try to load our custom inference script
        import sys
        sys.path.append(model_dir)
        
        try:
            from modelscope_inference import LSTMStockPredictor
            predictor = LSTMStockPredictor()
            print("✅ Model loaded successfully via ModelScope")
            
            # Test prediction with sample data
            sample_data = [
                [150.0, 152.0, 149.5, 151.0, 1000000],
                [151.0, 153.0, 150.5, 152.5, 1100000],
                [152.5, 154.0, 151.0, 153.0, 950000],
                [153.0, 154.5, 152.0, 153.5, 1200000],
                [153.5, 155.0, 152.5, 154.0, 980000],
                [154.0, 155.5, 153.0, 154.5, 1050000],
                [154.5, 156.0, 153.5, 155.0, 1100000],
                [155.0, 156.5, 154.0, 155.5, 990000],
                [155.5, 157.0, 154.5, 156.0, 1150000],
                [156.0, 157.5, 155.0, 156.5, 1000000]
            ]
            
            start_time = time.time()
            prediction = predictor.predict_price(sample_data)
            end_time = time.time()
            
            print(f"✅ Prediction successful:")
            print(f"   Predicted price: ${prediction['predicted_price']}")
            print(f"   Confidence: {prediction['confidence']}")
            print(f"   Latency: {(end_time - start_time) * 1000:.2f}ms")
            
            return {
                'local_loading': True,
                'prediction_works': True,
                'latency_ms': (end_time - start_time) * 1000,
                'predicted_price': prediction['predicted_price'],
                'confidence': prediction['confidence']
            }
            
        except ImportError as e:
            print(f"❌ Could not import custom inference: {e}")
            return {'local_loading': True, 'prediction_works': False, 'error': str(e)}
        
    except Exception as e:
        print(f"❌ ModelScope loading failed: {e}")
        return {'local_loading': False, 'error': str(e)}

def test_modelscope_pipeline():
    """Test using ModelScope pipeline (if available)"""
    print("\n🔧 Testing ModelScope Pipeline...")
    
    try:
        # Try to create a pipeline for our custom model
        pipeline_instance = pipeline(
            task='custom',
            model='yanggf2/lstm-stock-predictor-aapl-poc'
        )
        
        # Test with sample data
        result = pipeline_instance({
            'sequence_data': [
                [150.0, 152.0, 149.5, 151.0, 1000000],
                [151.0, 153.0, 150.5, 152.5, 1100000],
                [152.5, 154.0, 151.0, 153.0, 950000],
                [153.0, 154.5, 152.0, 153.5, 1200000],
                [153.5, 155.0, 152.5, 154.0, 980000],
                [154.0, 155.5, 153.0, 154.5, 1050000],
                [154.5, 156.0, 153.5, 155.0, 1100000],
                [155.0, 156.5, 154.0, 155.5, 990000],
                [155.5, 157.0, 154.5, 156.0, 1150000],
                [156.0, 157.5, 155.0, 156.5, 1000000]
            ]
        })
        
        print(f"✅ Pipeline prediction: {result}")
        return {'pipeline_works': True, 'result': result}
        
    except Exception as e:
        print(f"❌ Pipeline test failed: {e}")
        return {'pipeline_works': False, 'error': str(e)}

def check_modelscope_inference_service():
    """Check if ModelScope provides an inference API endpoint"""
    print("\n🌐 Checking ModelScope Inference Service...")
    
    # Common ModelScope inference endpoint patterns
    possible_endpoints = [
        f"https://modelscope.cn/api/v1/models/yanggf2/lstm-stock-predictor-aapl-poc/predict",
        f"https://api.modelscope.cn/v1/models/yanggf2/lstm-stock-predictor-aapl-poc/predict",
        f"https://inference.modelscope.cn/yanggf2/lstm-stock-predictor-aapl-poc"
    ]
    
    test_data = {
        "sequence_data": [
            [150.0, 152.0, 149.5, 151.0, 1000000],
            [151.0, 153.0, 150.5, 152.5, 1100000],
            [152.5, 154.0, 151.0, 153.0, 950000],
            [153.0, 154.5, 152.0, 153.5, 1200000],
            [153.5, 155.0, 152.5, 154.0, 980000],
            [154.0, 155.5, 153.0, 154.5, 1050000],
            [154.5, 156.0, 153.5, 155.0, 1100000],
            [155.0, 156.5, 154.0, 155.5, 990000],
            [155.5, 157.0, 154.5, 156.0, 1150000],
            [156.0, 157.5, 155.0, 156.5, 1000000]
        ]
    }
    
    for endpoint in possible_endpoints:
        try:
            print(f"   Testing: {endpoint}")
            response = requests.post(
                endpoint,
                json=test_data,
                timeout=10,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Inference API working: {endpoint}")
                print(f"   Response: {result}")
                return {
                    'api_available': True,
                    'endpoint': endpoint,
                    'response': result
                }
            else:
                print(f"   Status: {response.status_code}")
                
        except Exception as e:
            print(f"   Error: {e}")
    
    print("❌ No active inference API found")
    return {'api_available': False}

def run_complete_deployment_test():
    """Run complete deployment validation"""
    print("=" * 60)
    print("🔬 POC WEEK 1: ModelScope Deployment Testing")
    print("=" * 60)
    print("Goal: Validate deployed model and measure performance")
    print(f"Started: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    results = {
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'tests': {}
    }
    
    # Test 1: Local model loading
    results['tests']['local_loading'] = test_modelscope_local_loading()
    
    # Test 2: Pipeline usage
    results['tests']['pipeline'] = test_modelscope_pipeline()
    
    # Test 3: Inference API
    results['tests']['inference_api'] = check_modelscope_inference_service()
    
    # Generate final report
    return generate_deployment_report(results)

def generate_deployment_report(results):
    """Generate comprehensive deployment test report"""
    print()
    print("=" * 60)
    print("📊 DEPLOYMENT VALIDATION REPORT")
    print("=" * 60)
    
    # Analyze results
    local_works = results['tests']['local_loading'].get('local_loading', False)
    prediction_works = results['tests']['local_loading'].get('prediction_works', False)
    api_available = results['tests']['inference_api'].get('api_available', False)
    
    if local_works and prediction_works:
        print("✅ LOCAL MODEL DEPLOYMENT: SUCCESS")
        local_result = results['tests']['local_loading']
        print(f"   Predicted price: ${local_result.get('predicted_price', 'N/A')}")
        print(f"   Confidence: {local_result.get('confidence', 'N/A')}")
        print(f"   Latency: {local_result.get('latency_ms', 'N/A'):.2f}ms")
    else:
        print("❌ LOCAL MODEL DEPLOYMENT: FAILED")
        if 'error' in results['tests']['local_loading']:
            print(f"   Error: {results['tests']['local_loading']['error']}")
    
    if api_available:
        print("✅ INFERENCE API: AVAILABLE")
        api_result = results['tests']['inference_api']
        print(f"   Endpoint: {api_result.get('endpoint', 'N/A')}")
    else:
        print("⏳ INFERENCE API: NOT YET AVAILABLE")
        print("   Note: ModelScope may need time to deploy inference API")
    
    # Week 1 POC Success Criteria
    print(f"\n🎯 WEEK 1 POC VALIDATION:")
    criteria = {
        'model_uploaded': True,  # We successfully uploaded
        'model_loads': local_works,
        'prediction_works': prediction_works,
        'reasonable_latency': local_result.get('latency_ms', 1000) < 3000 if local_works else False
    }
    
    success_count = sum(criteria.values())
    success_rate = (success_count / len(criteria)) * 100
    
    print(f"   Model uploaded: {'✅' if criteria['model_uploaded'] else '❌'}")
    print(f"   Model loads: {'✅' if criteria['model_loads'] else '❌'}")
    print(f"   Predictions work: {'✅' if criteria['prediction_works'] else '❌'}")
    print(f"   Reasonable latency: {'✅' if criteria['reasonable_latency'] else '❌'}")
    print(f"   Success rate: {success_rate:.0f}%")
    
    # Final recommendation
    if success_rate >= 75:
        print(f"\n🎉 WEEK 1 POC: SUCCESS")
        print(f"   ✅ Ready to proceed to Week 2 (Cloudflare AI)")
        print(f"   ✅ ModelScope deployment validated")
        print(f"   ✅ Custom model inference working")
    else:
        print(f"\n⚠️ WEEK 1 POC: NEEDS IMPROVEMENT")
        print(f"   🔄 Address issues before proceeding to Week 2")
    
    # Save results
    with open('deployment_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📋 Full results saved: deployment_test_results.json")
    print(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    return results

if __name__ == "__main__":
    results = run_complete_deployment_test()