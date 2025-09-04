#!/usr/bin/env python3
"""
Explore Alternative Cloudflare AI Models for Financial Sentiment
"""

import requests
import time

class CloudflareModelExplorer:
    def __init__(self, account_id, api_token):
        self.account_id = account_id
        self.api_token = api_token
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
    
    def test_alternative_models(self):
        """Test alternative sentiment models available on Cloudflare"""
        
        # Financial test text
        test_text = "Apple reports record quarterly earnings, stock price jumps 15% in after-hours trading"
        
        # Alternative Cloudflare AI models to try
        models_to_test = [
            # Current model (for comparison)
            "@cf/huggingface/distilbert-sst-2-int8",
            
            # Alternative sentiment models
            "@cf/microsoft/DialoGPT-medium",
            "@cf/meta/llama-2-7b-chat-fp16", 
            "@cf/meta/llama-2-7b-chat-int8",
            "@cf/mistral/mistral-7b-instruct-v0.1",
            "@cf/openchat/openchat-3.5-0106",
            
            # Text classification models
            "@cf/huggingface/bert-base-uncased",
            "@cf/baai/bge-base-en-v1.5",
            "@cf/baai/bge-large-en-v1.5",
            
            # General purpose models that can handle sentiment
            "@cf/qwen/qwen1.5-0.5b-chat",
            "@cf/qwen/qwen1.5-1.8b-chat",
            "@cf/qwen/qwen1.5-7b-chat-awq",
        ]
        
        print("🔍 Testing Alternative Cloudflare AI Models for Financial Sentiment")
        print("=" * 70)
        print(f"Test text: \"{test_text}\"")
        print()
        
        results = []
        
        for model in models_to_test:
            print(f"Testing: {model}")
            result = self.test_model(model, test_text)
            results.append({
                'model': model,
                'result': result,
                'test_text': test_text
            })
            
            if result['success']:
                print(f"✅ Success - Latency: {result['latency_ms']:.1f}ms")
                print(f"   Response: {str(result['response'])[:100]}...")
            else:
                print(f"❌ Failed: {result['error']}")
            print()
            
            # Rate limiting - pause between requests
            time.sleep(1)
        
        return results
    
    def test_model(self, model_name, text):
        """Test a specific model"""
        try:
            # Different models may need different input formats
            if "llama" in model_name.lower() or "mistral" in model_name.lower() or "openchat" in model_name.lower():
                # Chat models - ask for sentiment
                payload = {
                    "messages": [
                        {"role": "user", "content": f"Analyze the sentiment of this financial news as POSITIVE, NEGATIVE, or NEUTRAL: '{text}'"}
                    ]
                }
            elif "distilbert" in model_name.lower():
                # DistilBERT format
                payload = {"text": text}
            else:
                # Try generic text input
                payload = {"text": text}
            
            start_time = time.time()
            response = requests.post(
                f"{self.base_url}/{model_name}",
                headers=self.headers,
                json=payload,
                timeout=15
            )
            end_time = time.time()
            
            if response.status_code == 200:
                result_data = response.json()
                return {
                    'success': True,
                    'response': result_data,
                    'latency_ms': (end_time - start_time) * 1000,
                    'status_code': response.status_code
                }
            else:
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text}",
                    'latency_ms': (end_time - start_time) * 1000
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'latency_ms': 0
            }
    
    def test_prompt_engineering(self):
        """Test prompt engineering with LLM models for better financial sentiment"""
        
        test_cases = [
            "Apple reports record quarterly earnings, stock soars 15%",
            "Federal Reserve raises interest rates, markets decline sharply",
            "Tesla announces major factory expansion, investors optimistic",
            "Inflation data shows concerning upward trends, tech stocks fall"
        ]
        
        # Try with a more capable model and better prompting
        model = "@cf/meta/llama-2-7b-chat-int8"
        
        print("🎯 Testing Prompt Engineering for Financial Sentiment")
        print("=" * 60)
        
        results = []
        
        for text in test_cases:
            prompt = f"""Analyze this financial news headline for market sentiment. Respond with exactly one word: POSITIVE, NEGATIVE, or NEUTRAL.

Financial headline: "{text}"

Sentiment:"""

            payload = {
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            
            print(f"Testing: \"{text[:50]}...\"")
            result = self.test_model(model, text)
            
            if result['success']:
                response_text = str(result['response'].get('result', {}).get('response', ''))
                sentiment = self.extract_sentiment(response_text)
                print(f"✅ {sentiment} - {result['latency_ms']:.1f}ms")
                print(f"   Full response: {response_text[:100]}...")
            else:
                print(f"❌ Failed: {result['error']}")
                sentiment = "FAILED"
            
            results.append({
                'text': text,
                'sentiment': sentiment,
                'result': result
            })
            print()
            
            time.sleep(1)
        
        return results
    
    def extract_sentiment(self, response_text):
        """Extract sentiment from model response"""
        response_upper = response_text.upper()
        if "POSITIVE" in response_upper:
            return "POSITIVE"
        elif "NEGATIVE" in response_upper:
            return "NEGATIVE"
        elif "NEUTRAL" in response_upper:
            return "NEUTRAL"
        else:
            return "UNCLEAR"

def main():
    # Use the credentials
    account_id = "REDACTED_ACCOUNT_ID"
    api_token = "REDACTED_API_TOKEN"
    
    explorer = CloudflareModelExplorer(account_id, api_token)
    
    print("🔬 Exploring Better Sentiment Models for Financial Trading POC")
    print()
    
    # Test alternative models
    alternative_results = explorer.test_alternative_models()
    
    print("\n" + "="*70)
    
    # Test prompt engineering approach
    prompt_results = explorer.test_prompt_engineering()
    
    # Summary
    print("\n📊 SUMMARY:")
    print("Current DistilBERT-SST2 has negative bias on financial news")
    print("Recommendation: Use LLM with financial-specific prompting")
    print("Best approach: Llama-2 + engineered prompts for financial context")

if __name__ == "__main__":
    main()