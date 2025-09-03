#!/usr/bin/env python3
"""
Cloud vs Local Performance Comparison
Compare ModelScope API vs Local TFT performance side-by-side
"""

import time
import json
from datetime import datetime
from typing import Dict, List, Any
import warnings
warnings.filterwarnings('ignore')

# Import both systems
from integrated_trading_system import IntegratedTradingSystem  # Local TFT + N-HITS
from integrated_trading_system_cloud import CloudIntegratedTradingSystem  # Cloud API

class CloudLocalComparison:
    """Compare cloud ModelScope API vs local TFT performance"""
    
    def __init__(self):
        # Cloudflare credentials
        self.account_id = "ed01ccea0b8ee7138058c4378cc83e54"
        self.api_token = "twU2VBUvYy3eUuVBwZ6HtqV4ms3TeW2SI2-0KGIT"
        
        # Initialize both systems
        print("🏗️ Initializing systems for comparison...")
        
        # Local system (TFT + N-HITS local models)
        print("   🏠 Local System: TFT + N-HITS local models")
        self.local_system = IntegratedTradingSystem(self.account_id, self.api_token)
        
        # Cloud system (ModelScope API + Cloudflare)
        print("   ☁️ Cloud System: ModelScope API (mock) + Cloudflare")
        self.cloud_system = CloudIntegratedTradingSystem(
            self.account_id, 
            self.api_token, 
            use_mock_api=True  # Using mock for comparison
        )
        
        self.comparison_results = {}
    
    def compare_single_stock(self, symbol: str) -> Dict[str, Any]:
        """Compare local vs cloud performance for single stock"""
        
        print(f"\n🔬 COMPARING LOCAL vs CLOUD for {symbol}")
        print("=" * 60)
        
        comparison = {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'local_result': {},
            'cloud_result': {},
            'performance_comparison': {},
            'recommendation_comparison': {}
        }
        
        # Test Local System
        print(f"1️⃣ Testing LOCAL system for {symbol}...")
        local_start = time.time()
        
        try:
            local_result = self.local_system.analyze_stock(symbol)
            local_end = time.time()
            local_total_time = (local_end - local_start) * 1000
            
            comparison['local_result'] = {
                'success': local_result.get('success', False),
                'action': local_result.get('action', 'UNKNOWN'),
                'confidence': local_result.get('confidence', 0.0),
                'signal_score': local_result.get('signal_score', 0.0),
                'total_time_ms': local_total_time,
                'system_version': local_result.get('model_version', 'Local'),
                'price_model': local_result.get('components', {}).get('price_prediction', {}).get('model_used', 'Unknown'),
                'error': local_result.get('error') if not local_result.get('success', False) else None
            }
            
            print(f"   ✅ Local completed: {local_total_time:.0f}ms total")
            
        except Exception as e:
            comparison['local_result'] = {
                'success': False,
                'error': str(e),
                'total_time_ms': 0
            }
            print(f"   ❌ Local failed: {e}")
        
        print(f"\n2️⃣ Testing CLOUD system for {symbol}...")
        cloud_start = time.time()
        
        try:
            cloud_result = self.cloud_system.analyze_stock(symbol)
            cloud_end = time.time()
            cloud_total_time = (cloud_end - cloud_start) * 1000
            
            comparison['cloud_result'] = {
                'success': cloud_result.get('success', False),
                'action': cloud_result.get('action', 'UNKNOWN'),
                'confidence': cloud_result.get('confidence', 0.0),
                'signal_score': cloud_result.get('signal_score', 0.0),
                'total_time_ms': cloud_total_time,
                'system_version': cloud_result.get('system_version', 'Cloud'),
                'api_mode': cloud_result.get('api_mode', 'Unknown'),
                'price_model': cloud_result.get('components', {}).get('price_prediction', {}).get('model_used', 'Unknown'),
                'error': cloud_result.get('error') if not cloud_result.get('success', False) else None
            }
            
            print(f"   ✅ Cloud completed: {cloud_total_time:.0f}ms total")
            
        except Exception as e:
            comparison['cloud_result'] = {
                'success': False,
                'error': str(e),
                'total_time_ms': 0
            }
            print(f"   ❌ Cloud failed: {e}")
        
        # Performance Comparison
        local_res = comparison['local_result']
        cloud_res = comparison['cloud_result']
        
        if local_res.get('success') and cloud_res.get('success'):
            comparison['performance_comparison'] = {
                'speed_winner': 'Local' if local_res['total_time_ms'] < cloud_res['total_time_ms'] else 'Cloud',
                'speed_difference_ms': abs(local_res['total_time_ms'] - cloud_res['total_time_ms']),
                'confidence_winner': 'Local' if local_res['confidence'] > cloud_res['confidence'] else 'Cloud',
                'confidence_difference': abs(local_res['confidence'] - cloud_res['confidence']),
                'local_time_ms': local_res['total_time_ms'],
                'cloud_time_ms': cloud_res['total_time_ms'],
                'both_successful': True
            }
            
            # Recommendation Comparison
            comparison['recommendation_comparison'] = {
                'local_action': local_res['action'],
                'cloud_action': cloud_res['action'],
                'actions_match': local_res['action'] == cloud_res['action'],
                'local_score': local_res['signal_score'],
                'cloud_score': cloud_res['signal_score'],
                'score_difference': abs(local_res['signal_score'] - cloud_res['signal_score']),
                'agreement_level': self._calculate_agreement(local_res, cloud_res)
            }
        else:
            comparison['performance_comparison'] = {
                'both_successful': False,
                'local_success': local_res.get('success', False),
                'cloud_success': cloud_res.get('success', False)
            }
        
        return comparison
    
    def _calculate_agreement(self, local: Dict, cloud: Dict) -> str:
        """Calculate agreement level between local and cloud recommendations"""
        
        local_action = local.get('action', '').split()[0]  # Get BUY/SELL/HOLD part
        cloud_action = cloud.get('action', '').split()[0]
        
        if local_action == cloud_action:
            return 'FULL_AGREEMENT'
        elif (local_action in ['BUY', 'SELL'] and cloud_action == 'HOLD') or \
             (cloud_action in ['BUY', 'SELL'] and local_action == 'HOLD'):
            return 'PARTIAL_AGREEMENT'
        elif (local_action == 'BUY' and cloud_action == 'SELL') or \
             (local_action == 'SELL' and cloud_action == 'BUY'):
            return 'DISAGREEMENT'
        else:
            return 'UNKNOWN'
    
    def run_comprehensive_comparison(self, symbols: List[str] = None) -> Dict[str, Any]:
        """Run comprehensive comparison across multiple symbols"""
        
        symbols = symbols or ['AAPL', 'TSLA']
        
        print("🏆 COMPREHENSIVE CLOUD vs LOCAL COMPARISON")
        print("=" * 70)
        print(f"Testing {len(symbols)} symbols: {', '.join(symbols)}")
        print()
        
        results = {}
        
        for symbol in symbols:
            comparison = self.compare_single_stock(symbol)
            results[symbol] = comparison
        
        # Generate summary
        summary = self._generate_comparison_summary(results)
        
        # Complete results
        final_results = {
            'comparison_timestamp': datetime.now().isoformat(),
            'symbols_tested': symbols,
            'individual_results': results,
            'summary': summary,
            'systems_info': {
                'local_system': {
                    'version': self.local_system.system_version,
                    'primary_model': 'TFT Primary + N-HITS Backup (Local)',
                    'sentiment': 'Cloudflare Llama-2'
                },
                'cloud_system': {
                    'version': self.cloud_system.system_version,
                    'primary_model': 'ModelScope API (Mock)',
                    'sentiment': 'Cloudflare Llama-2',
                    'api_mode': self.cloud_system.api_mode
                }
            }
        }
        
        # Print summary
        self._print_comparison_summary(summary, symbols)
        
        # Save results
        with open('cloud_vs_local_comparison.json', 'w') as f:
            json.dump(final_results, f, indent=2)
        
        print(f"\n💾 Complete comparison saved: cloud_vs_local_comparison.json")
        
        return final_results
    
    def _generate_comparison_summary(self, results: Dict[str, Dict]) -> Dict[str, Any]:
        """Generate comparison summary statistics"""
        
        total_tests = len(results)
        local_successes = sum(1 for r in results.values() if r['local_result'].get('success', False))
        cloud_successes = sum(1 for r in results.values() if r['cloud_result'].get('success', False))
        both_successful = sum(1 for r in results.values() if r['performance_comparison'].get('both_successful', False))
        
        # Speed comparison (for successful tests)
        successful_comparisons = [r for r in results.values() if r['performance_comparison'].get('both_successful', False)]
        
        if successful_comparisons:
            local_times = [r['local_result']['total_time_ms'] for r in successful_comparisons]
            cloud_times = [r['cloud_result']['total_time_ms'] for r in successful_comparisons]
            
            avg_local_time = sum(local_times) / len(local_times)
            avg_cloud_time = sum(cloud_times) / len(cloud_times)
            
            # Agreement analysis
            agreement_levels = [r['recommendation_comparison']['agreement_level'] for r in successful_comparisons]
            full_agreements = agreement_levels.count('FULL_AGREEMENT')
            partial_agreements = agreement_levels.count('PARTIAL_AGREEMENT')
            disagreements = agreement_levels.count('DISAGREEMENT')
            
            speed_winner = 'Local' if avg_local_time < avg_cloud_time else 'Cloud'
            speed_advantage_ms = abs(avg_local_time - avg_cloud_time)
            
        else:
            avg_local_time = avg_cloud_time = 0
            speed_winner = 'None'
            speed_advantage_ms = 0
            full_agreements = partial_agreements = disagreements = 0
        
        return {
            'total_tests': total_tests,
            'local_success_rate': (local_successes / total_tests) * 100,
            'cloud_success_rate': (cloud_successes / total_tests) * 100,
            'both_successful': both_successful,
            'performance': {
                'avg_local_time_ms': avg_local_time,
                'avg_cloud_time_ms': avg_cloud_time,
                'speed_winner': speed_winner,
                'speed_advantage_ms': speed_advantage_ms
            },
            'agreement_analysis': {
                'full_agreements': full_agreements,
                'partial_agreements': partial_agreements,
                'disagreements': disagreements,
                'agreement_rate': (full_agreements / max(both_successful, 1)) * 100
            },
            'recommendation': self._generate_final_recommendation(
                local_successes, cloud_successes, both_successful, 
                speed_winner, full_agreements, total_tests
            )
        }
    
    def _generate_final_recommendation(self, local_succ: int, cloud_succ: int, both_succ: int, 
                                     speed_winner: str, agreements: int, total: int) -> str:
        """Generate final recommendation based on comparison"""
        
        if both_succ == total and agreements == both_succ:
            if speed_winner == 'Local':
                return "🏠 RECOMMEND LOCAL: Both systems work perfectly, local is faster"
            else:
                return "☁️ RECOMMEND CLOUD: Both systems work perfectly, cloud has deployment advantages"
        elif both_succ == total and agreements >= both_succ * 0.5:
            return "🔀 EITHER SYSTEM: Both reliable with good agreement, choose based on deployment preference"
        elif local_succ > cloud_succ:
            return "🏠 RECOMMEND LOCAL: Local system more reliable in testing"
        elif cloud_succ > local_succ:
            return "☁️ RECOMMEND CLOUD: Cloud system more reliable in testing"
        else:
            return "⚠️ FURTHER TESTING NEEDED: Mixed results, need more validation"
    
    def _print_comparison_summary(self, summary: Dict, symbols: List[str]):
        """Print formatted comparison summary"""
        
        print(f"\n📋 COMPARISON SUMMARY")
        print("=" * 50)
        print(f"📊 Test Results:")
        print(f"   Symbols tested: {summary['total_tests']} ({', '.join(symbols)})")
        print(f"   Local success rate: {summary['local_success_rate']:.0f}%")
        print(f"   Cloud success rate: {summary['cloud_success_rate']:.0f}%")
        print(f"   Both successful: {summary['both_successful']}/{summary['total_tests']}")
        
        perf = summary['performance']
        print(f"\n⚡ Performance:")
        print(f"   Local avg time: {perf['avg_local_time_ms']:.0f}ms")
        print(f"   Cloud avg time: {perf['avg_cloud_time_ms']:.0f}ms")
        print(f"   Speed winner: {perf['speed_winner']} (by {perf['speed_advantage_ms']:.0f}ms)")
        
        agree = summary['agreement_analysis']
        print(f"\n🤝 Agreement Analysis:")
        print(f"   Full agreements: {agree['full_agreements']}/{summary['both_successful']}")
        print(f"   Partial agreements: {agree['partial_agreements']}/{summary['both_successful']}")
        print(f"   Disagreements: {agree['disagreements']}/{summary['both_successful']}")
        print(f"   Agreement rate: {agree['agreement_rate']:.0f}%")
        
        print(f"\n🏆 FINAL RECOMMENDATION:")
        print(f"   {summary['recommendation']}")

def main():
    """Run cloud vs local comparison"""
    
    # Initialize comparison
    comparator = CloudLocalComparison()
    
    # Run comprehensive comparison
    results = comparator.run_comprehensive_comparison(['AAPL', 'TSLA'])
    
    print(f"\n💡 NEXT STEPS:")
    print(f"1. Review detailed results in 'cloud_vs_local_comparison.json'")
    print(f"2. Activate real ModelScope API endpoint for production testing")
    print(f"3. Re-run comparison with real cloud API for final validation")
    print(f"4. Choose deployment strategy based on results and requirements")
    
    return results

if __name__ == "__main__":
    results = main()