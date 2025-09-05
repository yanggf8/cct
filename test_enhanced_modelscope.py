#!/usr/bin/env python3
"""
Test Enhanced ModelScope TFT+N-HITS Model
"""

import numpy as np
import json

try:
    from modelscope import pipeline
    from modelscope.utils.constant import Tasks
    MODELSCOPE_AVAILABLE = True
except ImportError:
    MODELSCOPE_AVAILABLE = False

def test_enhanced_model():
    """Test the enhanced ModelScope model"""
    
    if not MODELSCOPE_AVAILABLE:
        print("❌ ModelScope not available. Install with: pip install modelscope")
        return False
    
    try:
        print("🧪 Testing Enhanced ModelScope TFT+N-HITS Model...")
        print("=" * 60)
        
        # Initialize pipeline
        print("📦 Loading model pipeline...")
        predictor = pipeline(
            task=Tasks.time_series_forecasting,
            model='yanggf2/tft-primary-nhits-backup-predictor'
        )
        
        # Test data (OHLCV format)
        print("📊 Preparing test financial data...")
        financial_data = np.array([
            [100.0, 102.0, 99.0, 101.0, 1000000],   # OHLCV
            [101.0, 103.0, 100.0, 102.0, 1100000],
            [102.0, 104.0, 101.0, 103.0, 1200000],
            [103.0, 105.0, 102.0, 104.0, 1300000],
            [104.0, 106.0, 103.0, 105.0, 1400000],
            [105.0, 107.0, 104.0, 106.0, 1500000],
            [106.0, 108.0, 105.0, 107.0, 1600000],
            [107.0, 109.0, 106.0, 108.0, 1700000],
            [108.0, 110.0, 107.0, 109.0, 1800000],
            [109.0, 111.0, 108.0, 110.0, 1900000],
            [110.0, 112.0, 109.0, 111.0, 2000000],
            [111.0, 113.0, 110.0, 112.0, 2100000],
            [112.0, 114.0, 111.0, 113.0, 2200000],
            [113.0, 115.0, 112.0, 114.0, 2300000],
            [114.0, 116.0, 113.0, 115.0, 2400000],
            [115.0, 117.0, 114.0, 116.0, 2500000],
            [116.0, 118.0, 115.0, 117.0, 2600000],
            [117.0, 119.0, 116.0, 118.0, 2700000],
            [118.0, 120.0, 117.0, 119.0, 2800000],
            [119.0, 121.0, 118.0, 120.0, 2900000]
        ])
        
        print(f"   📈 Data shape: {financial_data.shape}")
        print(f"   💰 Price range: ${financial_data[0, 3]:.2f} - ${financial_data[-1, 3]:.2f}")
        
        # Make prediction
        print("\n🔮 Making prediction with Enhanced TFT+N-HITS...")
        result = predictor(financial_data)
        
        print("\n📊 Enhanced Model Results:")
        print("=" * 40)
        
        if isinstance(result, dict):
            for key, value in result.items():
                if key == 'individual_predictions':
                    print(f"   {key}:")
                    for model, pred in value.items():
                        print(f"     {model}: {pred}")
                elif key == 'model_info':
                    print(f"   {key}:")
                    print(f"     name: {value.get('name', 'N/A')}")
                    print(f"     version: {value.get('version', 'N/A')}")
                    print(f"     primary_model: {value.get('primary_model', 'N/A')}")
                else:
                    print(f"   {key}: {value}")
        else:
            print(f"   Raw result: {result}")
        
        print("\n✅ Enhanced ModelScope model test completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Enhanced model test failed: {str(e)}")
        print(f"   Error type: {type(e).__name__}")
        return False

def test_direct_api():
    """Test direct API call approach"""
    
    print("\n🌐 Testing Direct API Approach...")
    print("=" * 40)
    
    import requests
    import os
    
    api_key = os.getenv('MODELSCOPE_API_KEY')
    if not api_key:
        print("❌ MODELSCOPE_API_KEY not found in environment")
        return False
    
    # Test data
    test_data = {
        "data": [
            [100.0, 102.0, 99.0, 101.0, 1000000],
            [101.0, 103.0, 100.0, 102.0, 1100000],
            [102.0, 104.0, 101.0, 103.0, 1200000]
        ]
    }
    
    # Try different API endpoints
    endpoints = [
        "https://modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor/inference",
        "https://www.modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor/inference",
        "https://api.modelscope.cn/v1/models/yanggf2/tft-primary-nhits-backup-predictor/inference"
    ]
    
    for endpoint in endpoints:
        try:
            print(f"\n🔗 Testing endpoint: {endpoint}")
            
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
                print(f"   ✅ Success: {result}")
                return True
            else:
                print(f"   ❌ Error: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
    
    return False

if __name__ == "__main__":
    print("🧪 Enhanced ModelScope TFT+N-HITS Model Test")
    print("=" * 60)
    
    # Test 1: ModelScope SDK
    sdk_success = test_enhanced_model()
    
    # Test 2: Direct API
    api_success = test_direct_api()
    
    print("\n" + "=" * 60)
    print("📋 TEST SUMMARY:")
    print(f"   ModelScope SDK: {'✅ PASSED' if sdk_success else '❌ FAILED'}")
    print(f"   Direct API: {'✅ PASSED' if api_success else '❌ FAILED'}")
    
    if sdk_success or api_success:
        print("\n🎉 Enhanced model is accessible and working!")
    else:
        print("\n⚠️ Model may need activation or different access method")
