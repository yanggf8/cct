#!/usr/bin/env python3
"""
Simple test script to validate sentiment analysis using wrangler AI runtime
Uses wrangler's built-in AI capabilities for local testing
"""

import subprocess
import json
import tempfile
import os
from datetime import datetime

def create_test_worker():
    """Create a simple worker for AI testing"""
    worker_code = '''
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const text = url.searchParams.get('text') || 'Default financial outlook';
    
    try {
      const sentiment = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', {
        text: text
      });
      
      const isPositive = sentiment.label === 'POSITIVE';
      const tradingSignal = {
        raw_sentiment: sentiment,
        signal_score: isPositive ? 1.0 : -1.0,
        confidence: sentiment.score,
        sentiment: isPositive ? 'BULLISH' : 'BEARISH',
        recommendation: isPositive ? 'BUY' : 'SELL',
        timestamp: new Date().toISOString()
      };
      
      return new Response(JSON.stringify(tradingSignal, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        fallback_sentiment: 'NEUTRAL',
        signal_score: 0.0
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
'''
    
    return worker_code

def test_sentiment_with_wrangler(text, symbol="TEST"):
    """Test sentiment using wrangler dev"""
    print(f"🔍 Testing sentiment for {symbol}: '{text[:50]}...'")
    
    try:
        # Create temporary worker file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(create_test_worker())
            worker_file = f.name
        
        # Create temporary wrangler.toml
        toml_content = f'''
name = "sentiment-test"
main = "{os.path.basename(worker_file)}"
compatibility_date = "2024-01-01"

[ai]
binding = "AI"
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.toml', delete=False) as f:
            f.write(toml_content)
            toml_file = f.name
        
        # Test with curl (worker should be running)
        import urllib.parse
        encoded_text = urllib.parse.quote(text)
        test_url = f"https://tft-trading-system.yanggf.workers.dev?text={encoded_text}"
        
        result = subprocess.run([
            'curl', '-s', '--max-time', '30', test_url
        ], capture_output=True, text=True, timeout=35)
        
        if result.returncode == 0 and result.stdout:
            try:
                response_data = json.loads(result.stdout)
                print(f"   ✅ AI Response: {response_data}")
                return response_data
            except json.JSONDecodeError:
                print(f"   ❌ Invalid JSON response: {result.stdout}")
        else:
            print(f"   ❌ Request failed: {result.stderr}")
            
        # Cleanup
        os.unlink(worker_file)
        os.unlink(toml_file)
        
        return None
        
    except Exception as e:
        print(f"   ❌ Test failed: {str(e)}")
        return None

def main():
    """Test financial sentiment scenarios"""
    print("🚀 Testing Cloudflare AI Sentiment via Production Worker")
    print("=" * 60)
    
    # Financial text samples for different scenarios
    test_cases = [
        {
            'symbol': 'AAPL',
            'text': 'Apple reports record quarterly earnings, beats analyst expectations'
        },
        {
            'symbol': 'TSLA', 
            'text': 'Tesla faces production delays and supply chain issues'
        },
        {
            'symbol': 'MSFT',
            'text': 'Microsoft announces strong cloud growth and AI partnerships'
        },
        {
            'symbol': 'GOOGL',
            'text': 'Google shows steady revenue growth across business segments'
        },
        {
            'symbol': 'NVDA',
            'text': 'NVIDIA dominates AI chip market with breakthrough technology'
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\\n📈 Test Case {i}: {test_case['symbol']}")
        result = test_sentiment_with_wrangler(test_case['text'], test_case['symbol'])
        if result:
            result['symbol'] = test_case['symbol']
            result['test_text'] = test_case['text']
            results.append(result)
    
    print(f"\\n📋 Summary: {len(results)}/{len(test_cases)} successful tests")
    
    # Compare with static sentiment (from old worker)
    if results:
        print(f"\\n🔄 AI vs Static Sentiment Comparison:")
        static_bullish = ['AAPL', 'MSFT', 'GOOGL']
        
        for result in results:
            symbol = result['symbol']
            ai_sentiment = result.get('sentiment', 'UNKNOWN')
            static_sentiment = 'BULLISH' if symbol in static_bullish else 'NEUTRAL'
            match = "✅ Match" if ai_sentiment == static_sentiment else "❌ Different"
            confidence = result.get('confidence', 0.0)
            print(f"   {symbol}: AI={ai_sentiment}({confidence:.2f}) vs Static={static_sentiment} {match}")
    
    # Save results
    if results:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f'sentiment_comparison_{timestamp}.json'
        
        with open(output_file, 'w') as f:
            json.dump({
                'test_timestamp': datetime.now().isoformat(),
                'model': '@cf/huggingface/distilbert-sst-2-int8',
                'total_tests': len(test_cases),
                'successful_tests': len(results),
                'results': results
            }, f, indent=2)
        
        print(f"📄 Results saved to: {output_file}")

if __name__ == "__main__":
    main()