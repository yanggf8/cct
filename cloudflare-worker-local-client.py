#!/usr/bin/env python3
"""
Cloudflare Worker Local Client
Retrieves trading analysis results from Cloudflare Worker when your local machine comes online
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import time

class CloudflareWorkerClient:
    def __init__(self, worker_url: str, api_key: Optional[str] = None):
        """
        Initialize Cloudflare Worker client
        
        Args:
            worker_url: Your Cloudflare Worker URL (e.g., https://tft-trading-system.your-subdomain.workers.dev)
            api_key: Optional API key for authenticated requests
        """
        self.worker_url = worker_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        
        if api_key:
            self.session.headers.update({'Authorization': f'Bearer {api_key}'})
        
        print(f"🔗 Cloudflare Worker Client initialized")
        print(f"   Worker URL: {self.worker_url}")
    
    def get_latest_analysis(self, date: str = None) -> Dict[str, Any]:
        """
        Get latest trading analysis from Cloudflare Worker
        
        Args:
            date: Date in YYYY-MM-DD format (defaults to today)
        """
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
        
        try:
            response = self.session.get(
                f"{self.worker_url}/results",
                params={'date': date},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Retrieved analysis for {date}")
                print(f"   Symbols: {len(result.get('symbols_analyzed', []))}")
                print(f"   Status: {result.get('status', 'unknown')}")
                return result
            elif response.status_code == 404:
                print(f"📅 No analysis found for {date}")
                return {'error': 'No data available', 'date': date}
            else:
                print(f"❌ Failed to get results: HTTP {response.status_code}")
                return {'error': f'HTTP {response.status_code}', 'response': response.text}
                
        except requests.RequestException as e:
            print(f"❌ Connection error: {e}")
            return {'error': str(e)}
    
    def trigger_manual_analysis(self) -> Dict[str, Any]:
        """Trigger manual analysis on Cloudflare Worker"""
        
        try:
            print("🚀 Triggering manual analysis...")
            
            response = self.session.post(
                f"{self.worker_url}/analyze",
                timeout=60  # Analysis can take up to 60 seconds
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Manual analysis completed")
                print(f"   Run ID: {result.get('run_id', 'unknown')}")
                print(f"   Symbols: {len(result.get('symbols_analyzed', []))}")
                print(f"   Alerts: {len(result.get('alerts', []))}")
                return result
            else:
                print(f"❌ Manual analysis failed: HTTP {response.status_code}")
                return {'error': f'HTTP {response.status_code}', 'response': response.text}
                
        except requests.RequestException as e:
            print(f"❌ Manual analysis error: {e}")
            return {'error': str(e)}
    
    def check_worker_health(self) -> Dict[str, Any]:
        """Check Cloudflare Worker health status"""
        
        try:
            response = self.session.get(f"{self.worker_url}/health", timeout=10)
            
            if response.status_code == 200:
                health = response.json()
                print(f"✅ Worker health: {health.get('status', 'unknown')}")
                return health
            else:
                print(f"❌ Health check failed: HTTP {response.status_code}")
                return {'error': f'HTTP {response.status_code}'}
                
        except requests.RequestException as e:
            print(f"❌ Health check error: {e}")
            return {'error': str(e)}
    
    def get_recent_analysis_batch(self, days: int = 7) -> Dict[str, Dict]:
        """Get analysis results for multiple recent days"""
        
        results = {}
        
        for i in range(days):
            date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            result = self.get_latest_analysis(date)
            
            if 'error' not in result:
                results[date] = result
            
            time.sleep(0.5)  # Rate limiting
        
        return results
    
    def get_trading_signals_summary(self, date: str = None) -> Dict[str, Any]:
        """Get formatted summary of trading signals"""
        
        analysis = self.get_latest_analysis(date)
        
        if 'error' in analysis:
            return analysis
        
        signals = analysis.get('trading_signals', {})
        summary = {
            'date': date or datetime.now().strftime('%Y-%m-%d'),
            'timestamp': analysis.get('timestamp'),
            'total_symbols': len(signals),
            'signal_summary': {},
            'high_confidence_signals': [],
            'alerts': analysis.get('alerts', [])
        }
        
        # Analyze signals
        for symbol, signal in signals.items():
            if signal.get('success'):
                action = signal.get('action', '').split()[0]  # BUY/SELL/HOLD
                confidence = signal.get('confidence', 0)
                
                # Add to summary
                if action not in summary['signal_summary']:
                    summary['signal_summary'][action] = []
                
                summary['signal_summary'][action].append({
                    'symbol': symbol,
                    'confidence': confidence,
                    'reasoning': signal.get('reasoning', '')
                })
                
                # High confidence signals
                if confidence > 0.85 and action in ['BUY', 'SELL']:
                    summary['high_confidence_signals'].append({
                        'symbol': symbol,
                        'action': action,
                        'confidence': confidence,
                        'current_price': signal.get('current_price'),
                        'reasoning': signal.get('reasoning', '')
                    })
        
        return summary
    
    def monitor_daily_results(self, check_interval: int = 300):
        """
        Monitor for new daily results (run this when your machine comes online)
        
        Args:
            check_interval: Check interval in seconds (default 5 minutes)
        """
        print(f"🔄 Starting daily results monitoring (checking every {check_interval}s)")
        print("   Press Ctrl+C to stop")
        
        last_check = None
        
        try:
            while True:
                current_date = datetime.now().strftime('%Y-%m-%d')
                
                # Check for today's results
                result = self.get_latest_analysis(current_date)
                
                if 'error' not in result and result.get('timestamp') != last_check:
                    print(f"\n📊 NEW ANALYSIS DETECTED - {current_date}")
                    
                    # Get summary
                    summary = self.get_trading_signals_summary(current_date)
                    
                    print(f"🎯 Trading Signals Summary:")
                    for action, signals in summary.get('signal_summary', {}).items():
                        print(f"   {action}: {len(signals)} signals")
                        
                        for signal in signals[:3]:  # Show top 3
                            print(f"      • {signal['symbol']}: {signal['confidence']:.1%} confidence")
                    
                    # High confidence alerts
                    high_conf = summary.get('high_confidence_signals', [])
                    if high_conf:
                        print(f"\n🚨 HIGH CONFIDENCE SIGNALS ({len(high_conf)}):")
                        for signal in high_conf:
                            print(f"   🎯 {signal['symbol']}: {signal['action']} at ${signal['current_price']:.2f}")
                            print(f"      Confidence: {signal['confidence']:.1%}")
                            print(f"      Reasoning: {signal['reasoning']}")
                    
                    # Save local copy
                    filename = f"worker_analysis_{current_date.replace('-', '')}.json"
                    with open(filename, 'w') as f:
                        json.dump(result, f, indent=2)
                    
                    print(f"💾 Saved to: {filename}")
                    last_check = result.get('timestamp')
                
                print(f"⏱️ Next check in {check_interval}s...", end='\r')
                time.sleep(check_interval)
                
        except KeyboardInterrupt:
            print("\n⏹️ Monitoring stopped")
    
    def sync_with_paper_trading(self, paper_tracker):
        """Sync Cloudflare Worker results with local paper trading tracker"""
        
        print("🔄 Syncing worker results with paper trading...")
        
        # Get latest analysis
        latest = self.get_latest_analysis()
        
        if 'error' in latest:
            print(f"❌ Sync failed: {latest['error']}")
            return
        
        # Process signals through paper tracker
        trading_signals = latest.get('trading_signals', {})
        
        if trading_signals:
            paper_tracker.process_daily_signals(trading_signals)
            print(f"✅ Synced {len(trading_signals)} signals with paper trading")
        else:
            print("⚠️ No signals to sync")

def main():
    """Interactive Cloudflare Worker client"""
    
    # Configuration
    worker_url = "https://tft-trading-system.your-subdomain.workers.dev"  # Update this!
    
    client = CloudflareWorkerClient(worker_url)
    
    print("☁️ Cloudflare Worker Trading Client")
    print("=" * 40)
    print("1. Get latest analysis")
    print("2. Trigger manual analysis")  
    print("3. Check worker health")
    print("4. Get recent analysis batch")
    print("5. Monitor daily results")
    print("6. Get trading signals summary")
    print("7. Exit")
    
    while True:
        choice = input("\nEnter choice (1-7): ").strip()
        
        if choice == '1':
            date = input("Enter date (YYYY-MM-DD, or press Enter for today): ").strip()
            if not date:
                date = None
            
            result = client.get_latest_analysis(date)
            
            if 'error' not in result:
                print(f"\n📊 Analysis Results:")
                print(f"   Run ID: {result.get('run_id')}")
                print(f"   Symbols: {len(result.get('symbols_analyzed', []))}")
                print(f"   Success Rate: {result.get('performance_metrics', {}).get('success_rate', 0):.1f}%")
                print(f"   Alerts: {len(result.get('alerts', []))}")
            else:
                print(f"❌ {result['error']}")
        
        elif choice == '2':
            result = client.trigger_manual_analysis()
            
        elif choice == '3':
            health = client.check_worker_health()
            
            if 'error' not in health:
                print(f"\n🏥 Worker Health:")
                print(f"   Status: {health.get('status')}")
                print(f"   Version: {health.get('version')}")
                services = health.get('services', {})
                for service, status in services.items():
                    print(f"   {service}: {status}")
        
        elif choice == '4':
            days = int(input("How many days? (default 7): ") or 7)
            results = client.get_recent_analysis_batch(days)
            
            print(f"\n📅 Analysis found for {len(results)} days:")
            for date, result in results.items():
                signals = len(result.get('symbols_analyzed', []))
                alerts = len(result.get('alerts', []))
                print(f"   {date}: {signals} symbols, {alerts} alerts")
        
        elif choice == '5':
            interval = int(input("Check interval in seconds (default 300): ") or 300)
            client.monitor_daily_results(interval)
        
        elif choice == '6':
            date = input("Enter date (YYYY-MM-DD, or press Enter for today): ").strip()
            if not date:
                date = None
                
            summary = client.get_trading_signals_summary(date)
            
            if 'error' not in summary:
                print(f"\n📊 Trading Signals Summary - {summary['date']}")
                print(f"   Total symbols: {summary['total_symbols']}")
                
                for action, signals in summary.get('signal_summary', {}).items():
                    print(f"\n   {action} signals ({len(signals)}):")
                    for signal in signals:
                        print(f"      • {signal['symbol']}: {signal['confidence']:.1%}")
                
                high_conf = summary.get('high_confidence_signals', [])
                if high_conf:
                    print(f"\n   🎯 HIGH CONFIDENCE ({len(high_conf)}):")
                    for signal in high_conf:
                        print(f"      • {signal['symbol']}: {signal['action']} ({signal['confidence']:.1%})")
            else:
                print(f"❌ {summary['error']}")
        
        elif choice == '7':
            break
        
        else:
            print("Invalid choice. Please enter 1-7.")

if __name__ == "__main__":
    main()