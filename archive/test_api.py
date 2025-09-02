#!/usr/bin/env python3
"""
API Testing Script - Test local or remote ModelScope API
"""

import requests
import json
import time

def test_local_api(base_url="http://localhost:8000"):
    """Test the local API server"""
    print("🧪 Testing Local API Server")
    print("=" * 50)
    
    try:
        # Test health check
        print("1. Testing health endpoint...")
        health_response = requests.get(f"{base_url}/health", timeout=5)
        if health_response.status_code == 200:
            print("✅ Health check passed")
            health_data = health_response.json()
            print(f"   Status: {health_data['status']}")
        else:
            print(f"❌ Health check failed: {health_response.status_code}")
            return False
        
        # Test prediction
        print("\n2. Testing prediction endpoint...")
        test_data = {
            "price_sequence": [150.0, 151.2, 149.8, 152.1, 153.0]
        }
        
        start_time = time.time()
        pred_response = requests.post(
            f"{base_url}/predict", 
            json=test_data,
            timeout=10
        )
        end_time = time.time()
        
        if pred_response.status_code == 200:
            print("✅ Prediction request succeeded")
            result = pred_response.json()
            
            prediction = result['prediction']
            metadata = result['metadata']
            
            print(f"   Predicted price: ${prediction['predicted_price']}")
            print(f"   Confidence: {prediction['confidence']}")
            print(f"   API latency: {metadata['latency_ms']}ms")
            print(f"   Total latency: {(end_time - start_time) * 1000:.2f}ms")
            print(f"   Simulated cost: ${metadata['cost_simulation']}")
            
            # Validation results
            validation_results = {
                'api_responds': True,
                'latency_ms': metadata['latency_ms'],
                'total_latency_ms': (end_time - start_time) * 1000,
                'cost_per_call': metadata['cost_simulation'],
                'predicted_price': prediction['predicted_price'],
                'confidence': prediction['confidence']
            }
            
            print(f"\n📊 Validation Results:")
            print(f"   API Response: ✅ Working")
            print(f"   Latency: {'✅' if validation_results['total_latency_ms'] < 3000 else '❌'} {validation_results['total_latency_ms']:.0f}ms")
            print(f"   Cost: {'✅' if validation_results['cost_per_call'] < 0.15 else '❌'} ${validation_results['cost_per_call']}")
            
            return validation_results
            
        else:
            print(f"❌ Prediction failed: {pred_response.status_code}")
            print(f"   Error: {pred_response.text}")
            return False
    
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to local server")
        print("   Start the server first: python local_api_server.py")
        return False
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return False

def test_modelscope_api(api_endpoint):
    """Test actual ModelScope API (when deployed)"""
    print(f"🌐 Testing ModelScope API: {api_endpoint}")
    print("=" * 50)
    
    # This will be implemented when you have actual ModelScope endpoint
    print("⏳ ModelScope API testing not implemented yet")
    print("   Deploy to ModelScope first, then provide the endpoint URL")
    
    return False

def generate_api_test_report(results):
    """Generate comprehensive API test report"""
    report = {
        'test_timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'test_results': results,
        'week1_validation_status': 'PASSED' if results else 'FAILED',
        'next_steps': []
    }
    
    if results:
        if results['total_latency_ms'] < 3000:
            report['latency_validation'] = 'PASSED'
        else:
            report['latency_validation'] = 'FAILED'
            report['next_steps'].append('Optimize API latency')
        
        if results['cost_per_call'] < 0.15:
            report['cost_validation'] = 'PASSED'
        else:
            report['cost_validation'] = 'FAILED'
            report['next_steps'].append('Optimize API costs')
        
        report['ready_for_week2'] = len(report['next_steps']) == 0
        
        if report['ready_for_week2']:
            report['next_steps'] = [
                'Proceed to Week 2: Cloudflare AI validation',
                'Set up Cloudflare Workers account',
                'Test sentiment analysis API'
            ]
    else:
        report['ready_for_week2'] = False
        report['next_steps'] = [
            'Fix API deployment issues',
            'Retry Week 1 validation'
        ]
    
    # Save report
    with open('api_test_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📋 Test Report:")
    print(f"   Status: {report['week1_validation_status']}")
    if results:
        print(f"   Latency: {report['latency_validation']}")
        print(f"   Cost: {report['cost_validation']}")
        print(f"   Ready for Week 2: {report['ready_for_week2']}")
    
    print(f"   Report saved: api_test_report.json")
    
    return report

if __name__ == "__main__":
    print("🔬 POC Week 1: API Testing")
    print()
    
    # Test local API first
    local_results = test_local_api()
    
    # Generate report
    report = generate_api_test_report(local_results)
    
    if not local_results:
        print("\n💡 To test the API:")
        print("   1. Start server: python local_api_server.py")
        print("   2. In another terminal: python test_api.py")
        print("   3. Or visit http://localhost:8000 in browser")