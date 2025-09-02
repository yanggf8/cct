#!/usr/bin/env python3
"""
Real Cloudflare Workers AI Test
Test with actual API credentials
"""

import sys
from cloudflare_sentiment_test import CloudflareAITester, run_cloudflare_validation

def run_real_cloudflare_test(api_token):
    """Run test with real Cloudflare credentials"""
    print("🔗 Testing with REAL Cloudflare Workers AI API")
    print("=" * 60)
    
    # Initialize with real credentials
    tester = CloudflareAITester(
        account_id="ed01ccea0b8ee7138058c4378cc83e54",
        api_token=api_token
    )
    
    # Test single request first
    test_text = "Apple reports record quarterly earnings, stock soars 15%"
    print(f"Testing: \"{test_text}\"")
    
    result = tester.test_sentiment_api(test_text)
    
    if result['success']:
        print(f"✅ SUCCESS: {result['sentiment']['label']} ({result['sentiment']['score']:.2f})")
        print(f"   Latency: {result['latency_ms']:.1f}ms")
        print(f"   Real API call confirmed!")
        
        # Run full batch test
        print(f"\n🧪 Running full batch test...")
        batch_results = tester.run_batch_sentiment_test()
        
        return {
            'single_test': result,
            'batch_results': batch_results,
            'real_api': True
        }
    else:
        print(f"❌ FAILED: {result['error']}")
        return {
            'single_test': result,
            'real_api': False
        }

if __name__ == "__main__":
    print("Provide your Cloudflare Workers AI API token:")
    print("Usage: python cloudflare_real_test.py YOUR_API_TOKEN")
    
    if len(sys.argv) > 1:
        api_token = sys.argv[1]
        results = run_real_cloudflare_test(api_token)
    else:
        print("No API token provided - running in mock mode")
        from cloudflare_sentiment_test import run_cloudflare_validation
        results = run_cloudflare_validation()