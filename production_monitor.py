#!/usr/bin/env python3
"""
Production Trading System Monitor
Monitors the live Cloudflare Worker and tracks performance
"""

import requests
import json
import time
from datetime import datetime, timedelta
import sys

class ProductionMonitor:
    def __init__(self):
        self.worker_url = "https://tft-trading-system.yanggf.workers.dev"
        self.monitoring_data = []
        self.start_time = datetime.now()
        
    def health_check(self):
        """Check system health"""
        try:
            response = requests.get(f"{self.worker_url}/health", timeout=10)
            
            if response.status_code == 200:
                health_data = response.json()
                print(f"✅ Health Check: {health_data['status']} at {health_data['timestamp']}")
                return True, health_data
            else:
                print(f"❌ Health Check Failed: HTTP {response.status_code}")
                return False, None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Health Check Error: {e}")
            return False, None
    
    def test_analysis(self):
        """Test trading analysis endpoint"""
        try:
            start_time = time.time()
            response = requests.get(f"{self.worker_url}/analyze", timeout=30)
            end_time = time.time()
            
            if response.status_code == 200:
                analysis_data = response.json()
                latency = (end_time - start_time) * 1000  # Convert to ms
                
                success_rate = analysis_data.get('performance_metrics', {}).get('success_rate', 0)
                symbols_analyzed = len(analysis_data.get('symbols_analyzed', []))
                alerts = len(analysis_data.get('alerts', []))
                
                print(f"✅ Analysis Complete:")
                print(f"   Symbols: {symbols_analyzed}")
                print(f"   Success Rate: {success_rate}%")
                print(f"   Alerts: {alerts}")
                print(f"   Latency: {latency:.1f}ms")
                
                return True, {
                    'latency_ms': latency,
                    'success_rate': success_rate,
                    'symbols_analyzed': symbols_analyzed,
                    'alerts': alerts,
                    'timestamp': datetime.now().isoformat()
                }
            else:
                print(f"❌ Analysis Failed: HTTP {response.status_code}")
                return False, None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Analysis Error: {e}")
            return False, None
    
    def get_stored_results(self, date=None):
        """Get stored results from KV"""
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
            
        try:
            response = requests.get(f"{self.worker_url}/results?date={date}", timeout=10)
            
            if response.status_code == 200:
                results = response.json()
                print(f"📊 Stored Results for {date}:")
                print(f"   Run ID: {results.get('run_id', 'N/A')}")
                print(f"   Symbols: {len(results.get('symbols_analyzed', []))}")
                return True, results
            elif response.status_code == 404:
                print(f"📭 No stored results for {date}")
                return False, "No data"
            else:
                print(f"❌ Results Fetch Failed: HTTP {response.status_code}")
                return False, None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Results Error: {e}")
            return False, None
    
    def monitor_loop(self, interval=300):  # 5 minutes
        """Continuous monitoring loop"""
        print(f"🔄 Starting Production Monitor")
        print(f"   Worker URL: {self.worker_url}")
        print(f"   Check Interval: {interval}s")
        print(f"   Started: {self.start_time}")
        print("-" * 60)
        
        while True:
            try:
                timestamp = datetime.now().strftime('%H:%M:%S')
                print(f"\\n[{timestamp}] Running checks...")
                
                # Health check
                health_ok, health_data = self.health_check()
                
                # Analysis test (every 4th check to avoid spam)
                check_count = len(self.monitoring_data)
                if check_count % 4 == 0:
                    analysis_ok, analysis_data = self.test_analysis()
                    if analysis_ok:
                        self.monitoring_data.append(analysis_data)
                
                # Check stored results
                results_ok, results_data = self.get_stored_results()
                
                # Summary
                uptime = datetime.now() - self.start_time
                print(f"📈 System Status: {'🟢 HEALTHY' if health_ok else '🔴 UNHEALTHY'}")
                print(f"📊 Monitoring Uptime: {uptime}")
                
                if self.monitoring_data:
                    avg_latency = sum(d['latency_ms'] for d in self.monitoring_data) / len(self.monitoring_data)
                    print(f"⏱️  Average Latency: {avg_latency:.1f}ms")
                
                print("-" * 60)
                
                # Sleep until next check
                time.sleep(interval)
                
            except KeyboardInterrupt:
                print(f"\\n🛑 Monitoring stopped by user")
                self.print_summary()
                break
            except Exception as e:
                print(f"\\n❌ Monitor error: {e}")
                time.sleep(30)  # Wait 30s before retrying
    
    def print_summary(self):
        """Print monitoring summary"""
        print(f"\\n📊 MONITORING SUMMARY")
        print(f"={'=' * 50}")
        print(f"Start Time: {self.start_time}")
        print(f"End Time: {datetime.now()}")
        print(f"Duration: {datetime.now() - self.start_time}")
        print(f"Analysis Tests: {len(self.monitoring_data)}")
        
        if self.monitoring_data:
            latencies = [d['latency_ms'] for d in self.monitoring_data]
            success_rates = [d['success_rate'] for d in self.monitoring_data]
            
            print(f"Average Latency: {sum(latencies) / len(latencies):.1f}ms")
            print(f"Min Latency: {min(latencies):.1f}ms")
            print(f"Max Latency: {max(latencies):.1f}ms")
            print(f"Average Success Rate: {sum(success_rates) / len(success_rates):.1f}%")
        
        print("=" * 50)

def main():
    """Main monitoring function"""
    monitor = ProductionMonitor()
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "health":
            monitor.health_check()
        elif command == "test":
            monitor.test_analysis()
        elif command == "results":
            date = sys.argv[2] if len(sys.argv) > 2 else None
            monitor.get_stored_results(date)
        elif command == "monitor":
            interval = int(sys.argv[2]) if len(sys.argv) > 2 else 300
            monitor.monitor_loop(interval)
        else:
            print("Usage: python production_monitor.py [health|test|results|monitor] [args]")
    else:
        # Default: Run single health and analysis test
        print("🔍 Production System Check")
        print("=" * 50)
        monitor.health_check()
        print()
        monitor.test_analysis()
        print()
        monitor.get_stored_results()

if __name__ == "__main__":
    main()