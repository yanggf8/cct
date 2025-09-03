#!/usr/bin/env python3
"""
System Monitor - Production Trading System Health Monitoring
Monitors system health, performance, and sends alerts for critical issues
"""

import time
import json
import logging
import smtplib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import requests
import psutil
import os
import threading

class SystemMonitor:
    def __init__(self, config_file: str = "monitoring_config.json"):
        """Initialize system monitor with configuration"""
        
        self.config = self.load_config(config_file)
        self.setup_logging()
        
        # Monitoring state
        self.monitoring_active = False
        self.last_health_check = None
        self.system_status = {
            'overall_status': 'UNKNOWN',
            'components': {},
            'alerts': [],
            'performance_metrics': {}
        }
        
        # Thresholds
        self.cpu_threshold = 80  # %
        self.memory_threshold = 85  # %
        self.disk_threshold = 90  # %
        self.api_timeout = 10  # seconds
        self.max_consecutive_failures = 3
        
        # Failure tracking
        self.consecutive_failures = {}
        
        self.logger.info("🔍 System monitor initialized")
    
    def load_config(self, config_file: str) -> Dict:
        """Load monitoring configuration"""
        
        default_config = {
            'email': {
                'enabled': False,
                'smtp_server': 'smtp.gmail.com',
                'smtp_port': 587,
                'sender_email': '',
                'sender_password': '',
                'recipient_emails': []
            },
            'slack': {
                'enabled': False,
                'webhook_url': ''
            },
            'monitoring_interval': 300,  # 5 minutes
            'critical_alerts': True,
            'performance_logging': True
        }
        
        try:
            with open(config_file, 'r') as f:
                user_config = json.load(f)
                default_config.update(user_config)
        except FileNotFoundError:
            # Create default config
            with open(config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            self.logger.info(f"📝 Created default config: {config_file}")
        
        return default_config
    
    def setup_logging(self):
        """Setup monitoring logging"""
        
        log_filename = f"system_monitor_{datetime.now().strftime('%Y%m')}.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_filename),
                logging.StreamHandler()
            ]
        )
        
        self.logger = logging.getLogger(__name__)
    
    def check_system_health(self) -> Dict[str, Any]:
        """Comprehensive system health check"""
        
        self.logger.info("🏥 Running system health check...")
        
        health_report = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': 'HEALTHY',
            'components': {},
            'performance': {},
            'alerts': []
        }
        
        # Check system resources
        health_report['components']['system_resources'] = self.check_system_resources()
        
        # Check trading system components
        health_report['components']['trading_system'] = self.check_trading_system()
        
        # Check data sources
        health_report['components']['data_sources'] = self.check_data_sources()
        
        # Check file systems
        health_report['components']['file_systems'] = self.check_file_systems()
        
        # Determine overall health
        component_statuses = [comp['status'] for comp in health_report['components'].values()]
        
        if 'CRITICAL' in component_statuses:
            health_report['overall_status'] = 'CRITICAL'
        elif 'WARNING' in component_statuses:
            health_report['overall_status'] = 'WARNING'
        elif 'DOWN' in component_statuses:
            health_report['overall_status'] = 'DEGRADED'
        
        # Generate alerts
        self.generate_alerts(health_report)
        
        # Update system status
        self.system_status = health_report
        self.last_health_check = datetime.now()
        
        self.logger.info(f"✅ Health check completed: {health_report['overall_status']}")
        
        return health_report
    
    def check_system_resources(self) -> Dict[str, Any]:
        """Check CPU, memory, disk usage"""
        
        try:
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            status = 'HEALTHY'
            issues = []
            
            # Check thresholds
            if cpu_usage > self.cpu_threshold:
                status = 'WARNING'
                issues.append(f"High CPU usage: {cpu_usage:.1f}%")
            
            if memory.percent > self.memory_threshold:
                status = 'WARNING' if status == 'HEALTHY' else 'CRITICAL'
                issues.append(f"High memory usage: {memory.percent:.1f}%")
            
            if disk.percent > self.disk_threshold:
                status = 'CRITICAL'
                issues.append(f"High disk usage: {disk.percent:.1f}%")
            
            return {
                'status': status,
                'cpu_percent': cpu_usage,
                'memory_percent': memory.percent,
                'disk_percent': disk.percent,
                'issues': issues,
                'last_check': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'CRITICAL',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
    
    def check_trading_system(self) -> Dict[str, Any]:
        """Check trading system components"""
        
        try:
            issues = []
            status = 'HEALTHY'
            
            # Check if main system files exist
            required_files = [
                'integrated_trading_system.py',
                'lightweight_tft.py',
                'simple_nhits_model.py',
                'paper_trading_tracker.py'
            ]
            
            missing_files = []
            for file in required_files:
                if not os.path.exists(file):
                    missing_files.append(file)
            
            if missing_files:
                status = 'CRITICAL'
                issues.append(f"Missing files: {', '.join(missing_files)}")
            
            # Try to import main components
            try:
                from integrated_trading_system import IntegratedTradingSystem
                from lightweight_tft import LightweightTFTModel
                from simple_nhits_model import SimpleNHITS
                import_status = 'SUCCESS'
            except Exception as e:
                import_status = f'FAILED: {str(e)}'
                status = 'CRITICAL'
                issues.append(f"Import error: {str(e)}")
            
            # Check latest analysis results
            analysis_status = 'NO_DATA'
            last_analysis = None
            
            try:
                with open('latest_analysis.json', 'r') as f:
                    latest = json.load(f)
                    last_analysis = latest.get('timestamp')
                    analysis_status = 'AVAILABLE'
                    
                    # Check if analysis is recent (within 24 hours)
                    if last_analysis:
                        last_time = datetime.fromisoformat(last_analysis)
                        if datetime.now() - last_time > timedelta(hours=24):
                            status = 'WARNING' if status == 'HEALTHY' else status
                            issues.append("Analysis data is stale (>24h)")
            except FileNotFoundError:
                status = 'WARNING' if status == 'HEALTHY' else status
                issues.append("No recent analysis results found")
            
            return {
                'status': status,
                'import_status': import_status,
                'analysis_status': analysis_status,
                'last_analysis': last_analysis,
                'issues': issues,
                'last_check': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'status': 'CRITICAL',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
    
    def check_data_sources(self) -> Dict[str, Any]:
        """Check external data source availability"""
        
        data_sources = {
            'yahoo_finance': 'https://finance.yahoo.com',
            'cloudflare_ai': None  # Will check via API call
        }
        
        results = {}
        overall_status = 'HEALTHY'
        
        # Test Yahoo Finance
        try:
            import yfinance as yf
            ticker = yf.Ticker("AAPL")
            data = ticker.history(period="1d")
            
            if not data.empty:
                results['yahoo_finance'] = {
                    'status': 'HEALTHY',
                    'response_time_ms': 0,  # yfinance doesn't provide timing
                    'last_check': datetime.now().isoformat()
                }
            else:
                results['yahoo_finance'] = {
                    'status': 'WARNING',
                    'issue': 'No data returned',
                    'last_check': datetime.now().isoformat()
                }
                overall_status = 'WARNING'
                
        except Exception as e:
            results['yahoo_finance'] = {
                'status': 'CRITICAL',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
            overall_status = 'CRITICAL'
        
        # Test Cloudflare AI (basic connectivity)
        try:
            # Simple ping to Cloudflare
            response = requests.get('https://api.cloudflare.com/client/v4/zones', timeout=5)
            
            if response.status_code == 403:  # Expected without auth
                results['cloudflare_ai'] = {
                    'status': 'HEALTHY',
                    'response_time_ms': response.elapsed.total_seconds() * 1000,
                    'last_check': datetime.now().isoformat()
                }
            else:
                results['cloudflare_ai'] = {
                    'status': 'WARNING',
                    'status_code': response.status_code,
                    'last_check': datetime.now().isoformat()
                }
                
        except Exception as e:
            results['cloudflare_ai'] = {
                'status': 'WARNING',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
        
        return {
            'status': overall_status,
            'sources': results,
            'last_check': datetime.now().isoformat()
        }
    
    def check_file_systems(self) -> Dict[str, Any]:
        """Check critical files and directories"""
        
        critical_paths = {
            'analysis_results': 'latest_analysis.json',
            'paper_trading': 'paper_trading_history.json',
            'logs': '.',
            'models': '.'
        }
        
        results = {}
        overall_status = 'HEALTHY'
        
        for name, path in critical_paths.items():
            try:
                if os.path.exists(path):
                    stat = os.stat(path)
                    results[name] = {
                        'status': 'AVAILABLE',
                        'size_bytes': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'path': path
                    }
                else:
                    results[name] = {
                        'status': 'MISSING',
                        'path': path
                    }
                    if name in ['analysis_results', 'paper_trading']:
                        overall_status = 'WARNING'
                        
            except Exception as e:
                results[name] = {
                    'status': 'ERROR',
                    'error': str(e),
                    'path': path
                }
                overall_status = 'WARNING'
        
        return {
            'status': overall_status,
            'paths': results,
            'last_check': datetime.now().isoformat()
        }
    
    def generate_alerts(self, health_report: Dict):
        """Generate alerts based on health report"""
        
        alerts = []
        
        # Check for critical issues
        for component_name, component in health_report['components'].items():
            if component['status'] == 'CRITICAL':
                alert = {
                    'level': 'CRITICAL',
                    'component': component_name,
                    'message': f"CRITICAL: {component_name} is down or failing",
                    'timestamp': datetime.now().isoformat(),
                    'details': component
                }
                alerts.append(alert)
                self.send_alert(alert)
            
            elif component['status'] == 'WARNING':
                alert = {
                    'level': 'WARNING',
                    'component': component_name,
                    'message': f"WARNING: {component_name} has issues",
                    'timestamp': datetime.now().isoformat(),
                    'details': component
                }
                alerts.append(alert)
        
        # Check for consecutive failures
        for component_name, component in health_report['components'].items():
            if component['status'] in ['CRITICAL', 'WARNING']:
                self.consecutive_failures[component_name] = self.consecutive_failures.get(component_name, 0) + 1
                
                if self.consecutive_failures[component_name] >= self.max_consecutive_failures:
                    alert = {
                        'level': 'CRITICAL',
                        'component': component_name,
                        'message': f"CRITICAL: {component_name} has failed {self.consecutive_failures[component_name]} consecutive times",
                        'timestamp': datetime.now().isoformat(),
                        'details': component
                    }
                    alerts.append(alert)
                    self.send_alert(alert)
            else:
                # Reset failure count for healthy components
                self.consecutive_failures[component_name] = 0
        
        health_report['alerts'] = alerts
    
    def send_alert(self, alert: Dict):
        """Send alert via configured channels"""
        
        self.logger.warning(f"🚨 ALERT: {alert['message']}")
        
        # Send email alert
        if self.config['email']['enabled']:
            self.send_email_alert(alert)
        
        # Send Slack alert
        if self.config['slack']['enabled']:
            self.send_slack_alert(alert)
    
    def send_email_alert(self, alert: Dict):
        """Send email alert"""
        
        try:
            msg = MimeMultipart()
            msg['From'] = self.config['email']['sender_email']
            msg['To'] = ', '.join(self.config['email']['recipient_emails'])
            msg['Subject'] = f"Trading System Alert - {alert['level']}"
            
            body = f"""
Trading System Alert

Level: {alert['level']}
Component: {alert['component']}
Message: {alert['message']}
Timestamp: {alert['timestamp']}

Details:
{json.dumps(alert['details'], indent=2)}

Please check the system immediately.
            """
            
            msg.attach(MimeText(body, 'plain'))
            
            server = smtplib.SMTP(self.config['email']['smtp_server'], self.config['email']['smtp_port'])
            server.starttls()
            server.login(self.config['email']['sender_email'], self.config['email']['sender_password'])
            
            text = msg.as_string()
            server.sendmail(self.config['email']['sender_email'], self.config['email']['recipient_emails'], text)
            server.quit()
            
            self.logger.info("📧 Email alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to send email alert: {e}")
    
    def send_slack_alert(self, alert: Dict):
        """Send Slack webhook alert"""
        
        try:
            webhook_url = self.config['slack']['webhook_url']
            
            color = '#ff0000' if alert['level'] == 'CRITICAL' else '#ffaa00'
            
            payload = {
                'attachments': [
                    {
                        'color': color,
                        'title': f"Trading System Alert - {alert['level']}",
                        'fields': [
                            {'title': 'Component', 'value': alert['component'], 'short': True},
                            {'title': 'Level', 'value': alert['level'], 'short': True},
                            {'title': 'Message', 'value': alert['message'], 'short': False},
                            {'title': 'Timestamp', 'value': alert['timestamp'], 'short': True}
                        ]
                    }
                ]
            }
            
            response = requests.post(webhook_url, json=payload, timeout=10)
            response.raise_for_status()
            
            self.logger.info("💬 Slack alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to send Slack alert: {e}")
    
    def start_monitoring(self):
        """Start continuous monitoring"""
        
        self.monitoring_active = True
        self.logger.info("🔄 Starting continuous monitoring...")
        
        monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        monitoring_thread.start()
        
        self.logger.info(f"📊 Monitoring started (interval: {self.config['monitoring_interval']}s)")
    
    def _monitoring_loop(self):
        """Background monitoring loop"""
        
        while self.monitoring_active:
            try:
                self.check_system_health()
                time.sleep(self.config['monitoring_interval'])
                
            except Exception as e:
                self.logger.error(f"❌ Monitoring error: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    
    def stop_monitoring(self):
        """Stop continuous monitoring"""
        
        self.monitoring_active = False
        self.logger.info("⏹️ Monitoring stopped")
    
    def get_status_dashboard(self) -> Dict[str, Any]:
        """Get formatted status dashboard"""
        
        if not self.last_health_check:
            return {'error': 'No health check data available. Run check_system_health() first.'}
        
        dashboard = {
            'system_overview': {
                'overall_status': self.system_status['overall_status'],
                'last_check': self.last_health_check.isoformat(),
                'monitoring_active': self.monitoring_active,
                'uptime_check': self.get_system_uptime()
            },
            'component_status': {},
            'recent_alerts': self.system_status.get('alerts', [])[-5:],  # Last 5 alerts
            'recommendations': self.generate_recommendations()
        }
        
        # Format component status
        for comp_name, comp_data in self.system_status.get('components', {}).items():
            status_emoji = {
                'HEALTHY': '✅',
                'WARNING': '⚠️',
                'CRITICAL': '🚨',
                'DOWN': '❌'
            }.get(comp_data.get('status', 'UNKNOWN'), '❓')
            
            dashboard['component_status'][comp_name] = {
                'status': f"{status_emoji} {comp_data.get('status', 'UNKNOWN')}",
                'issues': comp_data.get('issues', []),
                'last_check': comp_data.get('last_check', 'Unknown')
            }
        
        return dashboard
    
    def get_system_uptime(self) -> str:
        """Get system uptime"""
        try:
            uptime_seconds = time.time() - psutil.boot_time()
            uptime_hours = uptime_seconds / 3600
            
            if uptime_hours < 24:
                return f"{uptime_hours:.1f} hours"
            else:
                return f"{uptime_hours/24:.1f} days"
        except:
            return "Unknown"
    
    def generate_recommendations(self) -> List[str]:
        """Generate system recommendations based on current status"""
        
        recommendations = []
        
        if self.system_status.get('overall_status') == 'CRITICAL':
            recommendations.append("🚨 IMMEDIATE ACTION REQUIRED: Critical system issues detected")
        
        # Check for specific issues
        for comp_name, comp_data in self.system_status.get('components', {}).items():
            if comp_data.get('status') == 'WARNING':
                if 'High CPU usage' in str(comp_data.get('issues', [])):
                    recommendations.append("📊 Consider reducing system load or upgrading hardware")
                
                if 'High memory usage' in str(comp_data.get('issues', [])):
                    recommendations.append("🧠 Memory usage is high - check for memory leaks")
                
                if 'stale' in str(comp_data.get('issues', [])).lower():
                    recommendations.append("📅 Analysis data is outdated - run manual analysis")
        
        if not recommendations:
            recommendations.append("✅ System operating normally - no immediate action required")
        
        return recommendations

def main():
    """System monitor main interface"""
    
    monitor = SystemMonitor()
    
    print("🔍 System Monitor - Trading System Health Check")
    print("=" * 50)
    print("1. Run health check")
    print("2. Start continuous monitoring")
    print("3. View status dashboard")
    print("4. Stop monitoring")
    print("5. Exit")
    
    while True:
        choice = input("\nEnter choice (1-5): ").strip()
        
        if choice == '1':
            print("\n🏥 Running system health check...")
            health_report = monitor.check_system_health()
            
            print(f"\n📊 Overall Status: {health_report['overall_status']}")
            for comp_name, comp_data in health_report['components'].items():
                status_emoji = {
                    'HEALTHY': '✅',
                    'WARNING': '⚠️', 
                    'CRITICAL': '🚨',
                    'DOWN': '❌'
                }.get(comp_data.get('status', 'UNKNOWN'), '❓')
                
                print(f"   {status_emoji} {comp_name}: {comp_data.get('status', 'UNKNOWN')}")
                
                if comp_data.get('issues'):
                    for issue in comp_data['issues']:
                        print(f"      - {issue}")
        
        elif choice == '2':
            monitor.start_monitoring()
            print("✅ Continuous monitoring started. Press any key to stop...")
            input()
            monitor.stop_monitoring()
        
        elif choice == '3':
            dashboard = monitor.get_status_dashboard()
            
            if 'error' not in dashboard:
                print(f"\n📊 SYSTEM DASHBOARD")
                print("=" * 30)
                print(f"Overall Status: {dashboard['system_overview']['overall_status']}")
                print(f"Last Check: {dashboard['system_overview']['last_check']}")
                print(f"Uptime: {dashboard['system_overview']['uptime_check']}")
                
                print(f"\n🏗️ COMPONENT STATUS:")
                for comp, status in dashboard['component_status'].items():
                    print(f"   {status['status']} {comp}")
                
                if dashboard['recent_alerts']:
                    print(f"\n🚨 RECENT ALERTS:")
                    for alert in dashboard['recent_alerts']:
                        print(f"   {alert['level']}: {alert['message']}")
                
                print(f"\n💡 RECOMMENDATIONS:")
                for rec in dashboard['recommendations']:
                    print(f"   {rec}")
            else:
                print(f"❌ {dashboard['error']}")
        
        elif choice == '4':
            monitor.stop_monitoring()
        
        elif choice == '5':
            monitor.stop_monitoring()
            break
        
        else:
            print("Invalid choice. Please enter 1-5.")

if __name__ == "__main__":
    main()