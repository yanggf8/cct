#!/usr/bin/env python3
"""
Test Enhanced ModelScope Model via Direct API
"""

import requests
import json
import os

def test_modelscope_api():
    """Test ModelScope API endpoints"""
    
    api_key = os.getenv('MODELSCOPE_API_KEY')
    if not api_key:
        print("❌ MODELSCOPE_API_KEY not found")
        return False
    
    print("🧪 Testing Enhanced ModelScope Model API")
    print("=" * 50)
    
    # Test data (OHLCV format)
    test_data = {
        "data": [
            [100.0, 102.0, 99.0, 101.0, 1000000],
            [101.0, 103.0, 100.0, 102.0, 1100000],
            [102.0, 104.0, 101.0, 103.0, 1200000],
            [103.0, 105.0, 102.0, 104.0, 1300000],
            [104.0, 106.0, 103.0, 105.0, 1400000]
        ]
    }
    
    print(f"📊 Test data: {len(test_data['data'])} OHLCV records")
    print(f"💰 Price range: ${test_data['data'][0][3]} - ${test_data['data'][-1][3]}")
    
    # Test different endpoints
    endpoints = [
        "https://modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor/inference",
        "https://www.modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor/inference"
    ]
    
    for i, endpoint in enumerate(endpoints, 1):
        print(f"\n🔗 Test {i}: {endpoint}")
        
        try:
            response = requests.post(
                endpoint,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json=test_data,
                timeout=30
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ SUCCESS!")
                print(f"   📊 Response: {json.dumps(result, indent=2)}")
                return True
            else:
                print(f"   ❌ Error: {response.text[:200]}...")
                
        except requests.exceptions.Timeout:
            print(f"   ⏰ Timeout (30s)")
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
    
    # Check if model supports inference
    print(f"\n🔍 Checking model status...")
    try:
        status_url = "https://modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor"
        response = requests.get(status_url, headers={'Authorization': f'Bearer {api_key}'})
        
        if response.status_code == 200:
            data = response.json()
            support_inference = data.get('Data', {}).get('SupportApiInference', False)
            print(f"   API Inference Support: {support_inference}")
            
            if not support_inference:
                print("   ⚠️ Model may need to be activated for API inference")
                print("   💡 Try using ModelScope Studio or web interface to activate")
        
    except Exception as e:
        print(f"   ❌ Status check failed: {e}")
    
    return False

if __name__ == "__main__":
    success = test_modelscope_api()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Enhanced ModelScope model API is working!")
    else:
        print("⚠️ API not accessible - model may need activation")
        print("💡 Next steps:")
        print("   1. Check ModelScope web interface")
        print("   2. Activate model for API inference")
        print("   3. Or use local model files instead")
