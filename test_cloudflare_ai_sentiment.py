#!/usr/bin/env python3
"""
Test script to validate Cloudflare AI sentiment analysis locally
Tests DistilBERT sentiment model for financial text analysis
"""

import requests
import json
import os
from datetime import datetime

# Cloudflare API configuration
ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID', 'your-account-id')
API_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN', 'your-api-token')

# API endpoint
API_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/huggingface/distilbert-sst-2-int8"

def test_sentiment_analysis(text, symbol="TEST"):
    """Test Cloudflare AI sentiment analysis"""
    
    headers = {
        'Authorization': f'Bearer {API_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'text': text
    }
    
    print(f"🔍 Testing sentiment for {symbol}: '{text}'")
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"   ✅ Raw AI response: {result}")
            
            # Extract sentiment details
            if 'result' in result:
                sentiment_data = result['result']
                label = sentiment_data.get('label', 'UNKNOWN')
                score = sentiment_data.get('score', 0.5)
                
                # Convert to trading signal
                is_positive = label == 'POSITIVE'
                signal_score = 1.0 if is_positive else -1.0
                sentiment_label = 'BULLISH' if is_positive else 'BEARISH'
                recommendation = 'BUY' if is_positive else 'SELL'
                
                trading_signal = {
                    'symbol': symbol,
                    'raw_sentiment': sentiment_data,
                    'signal_score': signal_score,
                    'confidence': score,
                    'sentiment': sentiment_label,
                    'recommendation': recommendation,
                    'timestamp': datetime.now().isoformat()
                }
                
                print(f"   📊 Trading Signal: {trading_signal}")
                return trading_signal
                
        else:
            print(f"   ❌ API Error: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"   ❌ Request failed: {str(e)}")
        return None

def main():
    """Test various financial sentiment scenarios"""
    
    print("🚀 Testing Cloudflare AI Sentiment Analysis for Financial Trading")
    print("=" * 60)
    
    # Test cases for different sentiment scenarios
    test_cases = [
        {
            'symbol': 'AAPL',
            'text': 'Financial outlook for AAPL: Recent market performance and analyst sentiment'
        },
        {
            'symbol': 'AAPL', 
            'text': 'Apple reports record quarterly earnings, beats analyst expectations, stock price soars'
        },
        {
            'symbol': 'TSLA',
            'text': 'Tesla faces production delays and supply chain issues, investors concerned about delivery targets'
        },
        {
            'symbol': 'MSFT',
            'text': 'Microsoft announces strong cloud growth and AI partnerships, bullish outlook from analysts'
        },
        {
            'symbol': 'GOOGL',
            'text': 'Google parent Alphabet shows steady revenue growth across all business segments'
        },
        {
            'symbol': 'NVDA',
            'text': 'NVIDIA dominates AI chip market with breakthrough GPU technology, massive demand growth'
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📈 Test Case {i}: {test_case['symbol']}")
        result = test_sentiment_analysis(test_case['text'], test_case['symbol'])
        if result:
            results.append(result)
    
    print(f"\n📋 Summary: {len(results)} successful sentiment analyses")
    
    # Save results
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f'cloudflare_ai_sentiment_test_{timestamp}.json'
    
    with open(output_file, 'w') as f:
        json.dump({
            'test_timestamp': datetime.now().isoformat(),
            'api_endpoint': API_URL,
            'model': '@cf/huggingface/distilbert-sst-2-int8',
            'total_tests': len(test_cases),
            'successful_tests': len(results),
            'results': results
        }, f, indent=2)
    
    print(f"📄 Results saved to: {output_file}")
    
    # Show comparison with static sentiment
    print(f"\n🔄 Comparison with Static Sentiment:")
    static_bullish = ['AAPL', 'MSFT', 'GOOGL']  # From old worker
    
    for result in results:
        symbol = result['symbol']
        ai_sentiment = result['sentiment']
        static_sentiment = 'BULLISH' if symbol in static_bullish else 'NEUTRAL'
        match = "✅ Match" if ai_sentiment == static_sentiment else "❌ Different"
        print(f"   {symbol}: AI={ai_sentiment} vs Static={static_sentiment} {match}")

if __name__ == "__main__":
    # Check for required environment variables
    if ACCOUNT_ID == 'your-account-id' or API_TOKEN == 'your-api-token':
        print("❌ Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables")
        print("   export CLOUDFLARE_ACCOUNT_ID='your-account-id'")  
        print("   export CLOUDFLARE_API_TOKEN='your-api-token'")
        exit(1)
    
    main()