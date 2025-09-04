#!/usr/bin/env python3
"""
Production Scheduler - Pre-Market Trading Analysis
Automated daily runs at 6:30-9:30 AM EST for production trading signals
"""

import schedule
import time
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any
import threading
import os

from integrated_trading_system import IntegratedTradingSystem
from paper_trading_tracker import PaperTradingTracker

class ProductionScheduler:
    def __init__(self, cloudflare_account_id: str, cloudflare_token: str):
        """Initialize production scheduler with trading system"""
        
        # Initialize core systems
        self.trading_system = IntegratedTradingSystem(cloudflare_account_id, cloudflare_token)
        self.paper_tracker = PaperTradingTracker()
        
        # Production configuration
        self.production_symbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'NVDA']  # Top 5 for initial validation
        self.pre_market_start = "06:30"  # EST
        self.market_open = "09:30"      # EST
        
        # Setup logging
        self.setup_logging()
        
        # Status tracking
        self.daily_results = {}
        self.scheduler_active = False
        self.current_run_id = None
        
        self.logger.info("🚀 Production scheduler initialized")
        self.logger.info(f"   Portfolio: {', '.join(self.production_symbols)}")
        self.logger.info(f"   Schedule: {self.pre_market_start} - {self.market_open} EST daily")
    
    def setup_logging(self):
        """Setup production logging"""
        
        log_filename = f"production_trading_{datetime.now().strftime('%Y%m')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_filename),
                logging.StreamHandler()  # Also log to console
            ]
        )
        
        self.logger = logging.getLogger(__name__)
    
    def run_daily_analysis(self) -> Dict[str, Any]:
        """Execute complete pre-market analysis for all symbols"""
        
        self.current_run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.logger.info(f"📊 Starting daily analysis - {self.current_run_id}")
        
        analysis_results = {
            'run_id': self.current_run_id,
            'timestamp': datetime.now().isoformat(),
            'symbols_analyzed': [],
            'trading_signals': {},
            'performance_metrics': {},
            'alerts': [],
            'status': 'running'
        }
        
        # Analyze each symbol
        for symbol in self.production_symbols:
            self.logger.info(f"   📈 Analyzing {symbol}...")
            
            try:
                # Get trading signal
                result = self.trading_system.analyze_stock(symbol)
                analysis_results['symbols_analyzed'].append(symbol)
                analysis_results['trading_signals'][symbol] = result
                
                # Process signal for paper trading
                if result.get('success'):
                    self.process_trading_signal(symbol, result)
                    
                    # Check for high-confidence signals
                    if result.get('confidence', 0) > 0.85 and result.get('action', '').startswith(('BUY', 'SELL')):
                        alert_msg = f"🎯 HIGH CONFIDENCE SIGNAL: {symbol} - {result['action']} (confidence: {result['confidence']:.1%})"
                        analysis_results['alerts'].append(alert_msg)
                        self.logger.warning(alert_msg)
                
                self.logger.info(f"   ✅ {symbol}: {result.get('action', 'UNKNOWN')} (conf: {result.get('confidence', 0):.1%})")
                
            except Exception as e:
                error_msg = f"❌ Analysis failed for {symbol}: {str(e)}"
                analysis_results['alerts'].append(error_msg)
                self.logger.error(error_msg)
        
        # Generate performance summary
        analysis_results['performance_metrics'] = self.generate_performance_summary(analysis_results)
        analysis_results['status'] = 'completed'
        
        # Save results
        self.save_daily_results(analysis_results)
        
        # Update paper trading tracker
        self.paper_tracker.process_daily_signals(analysis_results['trading_signals'])
        
        self.logger.info(f"🏁 Daily analysis completed - {len(analysis_results['symbols_analyzed'])}/{len(self.production_symbols)} symbols")
        
        return analysis_results
    
    def process_trading_signal(self, symbol: str, result: Dict[str, Any]):
        """Process individual trading signal"""
        
        if not result.get('success'):
            return
        
        action = result.get('action', '')
        confidence = result.get('confidence', 0)
        signal_score = result.get('signal_score', 0)
        
        # Calculate position size based on confidence (basic risk management)
        position_size = self.calculate_position_size(confidence, signal_score)
        
        # Log trading recommendation
        self.logger.info(f"   💡 {symbol} Signal: {action} | Size: {position_size:.1%} | Score: {signal_score:.3f}")
        
        # Store for paper trading
        self.paper_tracker.add_signal(
            symbol=symbol,
            action=action,
            confidence=confidence,
            position_size=position_size,
            current_price=result.get('current_price'),
            reasoning=result.get('reasoning', ''),
            timestamp=datetime.now()
        )
    
    def calculate_position_size(self, confidence: float, signal_score: float) -> float:
        """Calculate position size based on confidence and signal strength"""
        
        # Base position size (2-5% of portfolio)
        base_size = 0.03  # 3% base allocation
        
        # Confidence multiplier (0.6-1.4x)
        confidence_multiplier = 0.2 + (confidence * 1.2)
        
        # Signal strength multiplier (0.5-1.5x)  
        signal_multiplier = 0.5 + abs(signal_score)
        
        # Calculate final position size
        position_size = base_size * confidence_multiplier * min(signal_multiplier, 1.5)
        
        # Cap at maximum 5% per position
        return min(position_size, 0.05)
    
    def generate_performance_summary(self, analysis_results: Dict) -> Dict[str, Any]:
        """Generate performance metrics for daily run"""
        
        signals = analysis_results.get('trading_signals', {})
        successful_analyses = sum(1 for r in signals.values() if r.get('success', False))
        
        # Signal distribution
        signal_counts = {'BUY': 0, 'SELL': 0, 'HOLD': 0}
        confidence_scores = []
        
        for result in signals.values():
            if result.get('success'):
                action = result.get('action', '').split()[0]  # Get BUY/SELL/HOLD part
                if action in signal_counts:
                    signal_counts[action] += 1
                
                confidence_scores.append(result.get('confidence', 0))
        
        avg_confidence = np.mean(confidence_scores) if confidence_scores else 0
        
        return {
            'success_rate': (successful_analyses / len(self.production_symbols)) * 100,
            'signal_distribution': signal_counts,
            'avg_confidence': float(avg_confidence),
            'high_confidence_signals': sum(1 for c in confidence_scores if c > 0.85),
            'total_symbols': len(self.production_symbols),
            'successful_analyses': successful_analyses
        }
    
    def save_daily_results(self, results: Dict):
        """Save daily analysis results"""
        
        # Save to dated file
        filename = f"daily_analysis_{datetime.now().strftime('%Y%m%d')}.json"
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        # Also update latest results
        with open('latest_analysis.json', 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        self.logger.info(f"💾 Results saved: {filename}")
    
    def schedule_daily_runs(self):
        """Setup scheduled daily runs"""
        
        # Schedule pre-market analysis at 7:00 AM EST daily
        schedule.every().day.at("07:00").do(self.run_daily_analysis)
        
        self.logger.info("⏰ Scheduled daily analysis at 07:00 EST")
        
        # Start scheduler in background thread
        self.scheduler_active = True
        scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        scheduler_thread.start()
        
        self.logger.info("🔄 Scheduler started in background")
    
    def _run_scheduler(self):
        """Background scheduler loop"""
        while self.scheduler_active:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    
    def run_manual_analysis(self) -> Dict[str, Any]:
        """Run immediate manual analysis (for testing)"""
        
        self.logger.info("🖱️ Running manual analysis...")
        return self.run_daily_analysis()
    
    def get_latest_results(self) -> Dict[str, Any]:
        """Get latest analysis results"""
        
        try:
            with open('latest_analysis.json', 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {'error': 'No analysis results available'}
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        self.scheduler_active = False
        self.logger.info("⏹️ Scheduler stopped")

def main():
    """Production scheduler main function"""
    
    # Cloudflare credentials - Load from environment variables
    account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID')
    api_token = os.environ.get('CLOUDFLARE_API_TOKEN')
    
    if not account_id or not api_token:
        print("❌ ERROR: Missing CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables")
        exit(1)
    
    # Initialize scheduler
    scheduler = ProductionScheduler(account_id, api_token)
    
    print("🚀 Production Trading Scheduler")
    print("=" * 40)
    print("1. Schedule daily runs (7:00 AM EST)")
    print("2. Run manual analysis now")
    print("3. View latest results")
    print("4. Exit")
    
    while True:
        choice = input("\nEnter choice (1-4): ").strip()
        
        if choice == '1':
            scheduler.schedule_daily_runs()
            print("✅ Daily scheduler activated. Press Ctrl+C to stop.")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                scheduler.stop_scheduler()
                print("\n⏹️ Scheduler stopped.")
                break
                
        elif choice == '2':
            results = scheduler.run_manual_analysis()
            print(f"\n📊 Analysis completed for {len(results['symbols_analyzed'])} symbols")
            print(f"🎯 Signals: {results['performance_metrics']['signal_distribution']}")
            print(f"📈 Avg confidence: {results['performance_metrics']['avg_confidence']:.1%}")
            
        elif choice == '3':
            results = scheduler.get_latest_results()
            if 'error' not in results:
                print(f"\n📅 Latest run: {results.get('timestamp', 'Unknown')}")
                print(f"🎯 Signals: {results.get('performance_metrics', {}).get('signal_distribution', {})}")
                print(f"⚠️ Alerts: {len(results.get('alerts', []))}")
            else:
                print("❌ No results available")
                
        elif choice == '4':
            scheduler.stop_scheduler()
            break
        else:
            print("Invalid choice. Please enter 1-4.")

if __name__ == "__main__":
    main()