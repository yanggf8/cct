#!/usr/bin/env python3
"""
Paper Trading Tracker - Track Trading Signal Performance
Validates trading system performance before live deployment
"""

import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import yfinance as yf
import numpy as np

class PaperTradingTracker:
    def __init__(self, initial_capital: float = 100000):
        """
        Initialize paper trading tracker
        
        Args:
            initial_capital: Starting capital for paper trading ($100k default)
        """
        self.initial_capital = initial_capital
        self.current_capital = initial_capital
        self.positions = {}  # Current positions
        self.trade_history = []  # Complete trade log
        self.daily_portfolio_values = []
        self.performance_metrics = {}
        
        # Risk management parameters
        self.max_position_size = 0.05  # 5% max per position
        self.max_portfolio_risk = 0.20  # 20% max total risk exposure
        self.stop_loss_pct = 0.08  # 8% stop loss
        self.take_profit_pct = 0.15  # 15% take profit
        
        # Load existing data if available
        self.load_trading_history()
    
    def add_signal(self, symbol: str, action: str, confidence: float, 
                   position_size: float, current_price: float, 
                   reasoning: str, timestamp: datetime):
        """Add new trading signal to tracker"""
        
        signal = {
            'timestamp': timestamp.isoformat(),
            'symbol': symbol,
            'action': action,
            'confidence': confidence,
            'suggested_position_size': position_size,
            'current_price': current_price,
            'reasoning': reasoning,
            'executed': False,
            'execution_price': None,
            'execution_timestamp': None,
            'position_id': None
        }
        
        # Execute trade if conditions are met
        if self.should_execute_signal(signal):
            self.execute_trade(signal)
        
        # Save signal regardless of execution
        self.save_signal(signal)
    
    def should_execute_signal(self, signal: Dict) -> bool:
        """Determine if signal should be executed based on risk management"""
        
        action = signal['action'].upper()
        symbol = signal['symbol']
        
        # Don't execute HOLD signals
        if 'HOLD' in action:
            return False
        
        # Check minimum confidence threshold
        if signal['confidence'] < 0.65:
            return False
        
        # Check if we already have a position in this symbol
        if symbol in self.positions:
            current_position = self.positions[symbol]
            
            # Don't add to existing position in same direction
            if (action.startswith('BUY') and current_position['quantity'] > 0) or \
               (action.startswith('SELL') and current_position['quantity'] < 0):
                return False
        
        # Check total portfolio risk
        proposed_value = signal['current_price'] * signal['suggested_position_size'] * self.current_capital
        current_exposure = sum(abs(pos['current_value']) for pos in self.positions.values())
        
        if (current_exposure + proposed_value) / self.current_capital > self.max_portfolio_risk:
            return False
        
        return True
    
    def execute_trade(self, signal: Dict):
        """Execute paper trade based on signal"""
        
        symbol = signal['symbol']
        action = signal['action']
        price = signal['current_price']
        position_size = min(signal['suggested_position_size'], self.max_position_size)
        
        # Calculate position value and quantity
        position_value = self.current_capital * position_size
        
        if action.startswith('BUY'):
            quantity = position_value / price
            side = 1
        else:  # SELL
            quantity = position_value / price
            side = -1
        
        # Generate position ID
        position_id = f"{symbol}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Create position
        position = {
            'position_id': position_id,
            'symbol': symbol,
            'side': 'LONG' if side > 0 else 'SHORT',
            'entry_price': price,
            'entry_timestamp': datetime.now().isoformat(),
            'quantity': quantity * side,
            'entry_value': position_value * side,
            'current_price': price,
            'current_value': position_value * side,
            'unrealized_pnl': 0.0,
            'stop_loss_price': self.calculate_stop_loss(price, side),
            'take_profit_price': self.calculate_take_profit(price, side),
            'signal_confidence': signal['confidence'],
            'reasoning': signal['reasoning']
        }
        
        # Add to positions
        self.positions[symbol] = position
        
        # Update signal as executed
        signal['executed'] = True
        signal['execution_price'] = price
        signal['execution_timestamp'] = datetime.now().isoformat()
        signal['position_id'] = position_id
        
        # Add to trade history
        trade_record = {
            'timestamp': datetime.now().isoformat(),
            'type': 'OPEN',
            'symbol': symbol,
            'side': position['side'],
            'quantity': abs(quantity),
            'price': price,
            'value': position_value,
            'position_id': position_id,
            'signal_confidence': signal['confidence'],
            'reasoning': signal['reasoning']
        }
        
        self.trade_history.append(trade_record)
        
        print(f"📈 EXECUTED: {action} {symbol} | Qty: {abs(quantity):.2f} | Price: ${price:.2f} | Value: ${position_value:,.0f}")
    
    def calculate_stop_loss(self, entry_price: float, side: int) -> float:
        """Calculate stop loss price"""
        if side > 0:  # LONG position
            return entry_price * (1 - self.stop_loss_pct)
        else:  # SHORT position
            return entry_price * (1 + self.stop_loss_pct)
    
    def calculate_take_profit(self, entry_price: float, side: int) -> float:
        """Calculate take profit price"""
        if side > 0:  # LONG position
            return entry_price * (1 + self.take_profit_pct)
        else:  # SHORT position
            return entry_price * (1 - self.take_profit_pct)
    
    def update_positions(self):
        """Update all positions with current market prices"""
        
        symbols_to_update = list(self.positions.keys())
        
        for symbol in symbols_to_update:
            try:
                # Get current price
                ticker = yf.Ticker(symbol)
                current_price = ticker.history(period="1d")['Close'].iloc[-1]
                
                position = self.positions[symbol]
                position['current_price'] = current_price
                
                # Calculate current value and PnL
                quantity = position['quantity']
                position['current_value'] = quantity * current_price
                position['unrealized_pnl'] = position['current_value'] - position['entry_value']
                
                # Check stop loss / take profit
                self.check_exit_conditions(symbol, position, current_price)
                
            except Exception as e:
                print(f"❌ Error updating {symbol}: {e}")
    
    def check_exit_conditions(self, symbol: str, position: Dict, current_price: float):
        """Check if position should be closed based on stop loss/take profit"""
        
        should_close = False
        close_reason = ""
        
        if position['side'] == 'LONG':
            if current_price <= position['stop_loss_price']:
                should_close = True
                close_reason = "STOP_LOSS"
            elif current_price >= position['take_profit_price']:
                should_close = True
                close_reason = "TAKE_PROFIT"
        else:  # SHORT
            if current_price >= position['stop_loss_price']:
                should_close = True
                close_reason = "STOP_LOSS"
            elif current_price <= position['take_profit_price']:
                should_close = True
                close_reason = "TAKE_PROFIT"
        
        if should_close:
            self.close_position(symbol, current_price, close_reason)
    
    def close_position(self, symbol: str, close_price: float, reason: str):
        """Close existing position"""
        
        if symbol not in self.positions:
            return
        
        position = self.positions[symbol]
        
        # Calculate final P&L
        final_pnl = position['quantity'] * (close_price - position['entry_price'])
        final_value = position['quantity'] * close_price
        
        # Update capital
        self.current_capital += final_pnl
        
        # Add closing trade to history
        close_trade = {
            'timestamp': datetime.now().isoformat(),
            'type': 'CLOSE',
            'symbol': symbol,
            'side': position['side'],
            'quantity': abs(position['quantity']),
            'price': close_price,
            'value': abs(final_value),
            'position_id': position['position_id'],
            'pnl': final_pnl,
            'pnl_percent': (final_pnl / abs(position['entry_value'])) * 100,
            'close_reason': reason,
            'hold_duration': self.calculate_hold_duration(position['entry_timestamp'])
        }
        
        self.trade_history.append(close_trade)
        
        # Remove from positions
        del self.positions[symbol]
        
        pnl_sign = "📈" if final_pnl >= 0 else "📉"
        print(f"{pnl_sign} CLOSED: {symbol} | P&L: ${final_pnl:,.0f} ({close_trade['pnl_percent']:+.1f}%) | Reason: {reason}")
    
    def calculate_hold_duration(self, entry_timestamp: str) -> str:
        """Calculate how long position was held"""
        entry_time = datetime.fromisoformat(entry_timestamp)
        duration = datetime.now() - entry_time
        
        if duration.days > 0:
            return f"{duration.days}d {duration.seconds // 3600}h"
        else:
            return f"{duration.seconds // 3600}h {(duration.seconds % 3600) // 60}m"
    
    def process_daily_signals(self, trading_signals: Dict[str, Dict]):
        """Process daily signals from trading system"""
        
        for symbol, result in trading_signals.items():
            if result.get('success'):
                # Create signal entry
                signal = {
                    'timestamp': datetime.now().isoformat(),
                    'symbol': symbol,
                    'action': result.get('action', ''),
                    'confidence': result.get('confidence', 0),
                    'suggested_position_size': 0.03,  # Default 3%
                    'current_price': result.get('current_price', 0),
                    'reasoning': result.get('reasoning', ''),
                    'signal_score': result.get('signal_score', 0)
                }
                
                # Process the signal
                self.add_signal(
                    symbol=symbol,
                    action=signal['action'],
                    confidence=signal['confidence'],
                    position_size=signal['suggested_position_size'],
                    current_price=signal['current_price'],
                    reasoning=signal['reasoning'],
                    timestamp=datetime.now()
                )
        
        # Update existing positions
        self.update_positions()
        
        # Calculate daily performance
        self.calculate_daily_performance()
        
        # Save state
        self.save_trading_history()
    
    def calculate_daily_performance(self):
        """Calculate and store daily portfolio performance"""
        
        # Calculate total portfolio value
        position_value = sum(pos['current_value'] for pos in self.positions.values())
        cash_value = self.current_capital - sum(pos['entry_value'] for pos in self.positions.values())
        total_value = position_value + cash_value
        
        daily_record = {
            'date': datetime.now().strftime('%Y-%m-%d'),
            'total_value': total_value,
            'cash': cash_value,
            'positions_value': position_value,
            'num_positions': len(self.positions),
            'total_return': ((total_value - self.initial_capital) / self.initial_capital) * 100,
            'daily_return': 0.0  # Will calculate based on previous day
        }
        
        # Calculate daily return if we have previous data
        if self.daily_portfolio_values:
            prev_value = self.daily_portfolio_values[-1]['total_value']
            daily_record['daily_return'] = ((total_value - prev_value) / prev_value) * 100
        
        self.daily_portfolio_values.append(daily_record)
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Generate comprehensive performance summary"""
        
        if not self.daily_portfolio_values:
            return {'error': 'No performance data available'}
        
        latest = self.daily_portfolio_values[-1]
        
        # Calculate performance metrics
        total_trades = len([t for t in self.trade_history if t['type'] == 'CLOSE'])
        winning_trades = len([t for t in self.trade_history if t['type'] == 'CLOSE' and t['pnl'] > 0])
        
        win_rate = (winning_trades / max(total_trades, 1)) * 100
        
        # Calculate average returns
        daily_returns = [d['daily_return'] for d in self.daily_portfolio_values if d['daily_return'] != 0]
        avg_daily_return = np.mean(daily_returns) if daily_returns else 0
        
        return {
            'current_portfolio_value': latest['total_value'],
            'total_return_percent': latest['total_return'],
            'total_return_dollars': latest['total_value'] - self.initial_capital,
            'active_positions': len(self.positions),
            'total_trades_completed': total_trades,
            'win_rate_percent': win_rate,
            'average_daily_return_percent': avg_daily_return,
            'max_drawdown_percent': self.calculate_max_drawdown(),
            'sharpe_ratio': self.calculate_sharpe_ratio(daily_returns),
            'current_positions': {
                symbol: {
                    'side': pos['side'],
                    'unrealized_pnl': pos['unrealized_pnl'],
                    'pnl_percent': (pos['unrealized_pnl'] / abs(pos['entry_value'])) * 100
                } for symbol, pos in self.positions.items()
            }
        }
    
    def calculate_max_drawdown(self) -> float:
        """Calculate maximum drawdown percentage"""
        if len(self.daily_portfolio_values) < 2:
            return 0.0
        
        values = [d['total_value'] for d in self.daily_portfolio_values]
        peak = values[0]
        max_drawdown = 0.0
        
        for value in values:
            if value > peak:
                peak = value
            drawdown = (peak - value) / peak * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        return max_drawdown
    
    def calculate_sharpe_ratio(self, daily_returns: List[float], risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio"""
        if not daily_returns or len(daily_returns) < 2:
            return 0.0
        
        annual_return = np.mean(daily_returns) * 252  # Annualized
        annual_volatility = np.std(daily_returns) * np.sqrt(252)  # Annualized
        
        if annual_volatility == 0:
            return 0.0
        
        return (annual_return - risk_free_rate) / annual_volatility
    
    def save_signal(self, signal: Dict):
        """Save individual signal to log"""
        signal_filename = f"signals_{datetime.now().strftime('%Y%m')}.json"
        
        # Load existing signals
        try:
            with open(signal_filename, 'r') as f:
                signals = json.load(f)
        except FileNotFoundError:
            signals = []
        
        signals.append(signal)
        
        # Save updated signals
        with open(signal_filename, 'w') as f:
            json.dump(signals, f, indent=2)
    
    def save_trading_history(self):
        """Save complete trading history and positions"""
        
        data = {
            'initial_capital': self.initial_capital,
            'current_capital': self.current_capital,
            'positions': self.positions,
            'trade_history': self.trade_history,
            'daily_portfolio_values': self.daily_portfolio_values,
            'last_updated': datetime.now().isoformat()
        }
        
        with open('paper_trading_history.json', 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    def load_trading_history(self):
        """Load existing trading history"""
        
        try:
            with open('paper_trading_history.json', 'r') as f:
                data = json.load(f)
            
            self.current_capital = data.get('current_capital', self.initial_capital)
            self.positions = data.get('positions', {})
            self.trade_history = data.get('trade_history', [])
            self.daily_portfolio_values = data.get('daily_portfolio_values', [])
            
            print(f"📁 Loaded trading history: {len(self.trade_history)} trades, {len(self.positions)} active positions")
            
        except FileNotFoundError:
            print("📝 Starting fresh paper trading session")

def main():
    """Test paper trading tracker"""
    
    tracker = PaperTradingTracker()
    
    # Simulate some test signals
    test_signals = [
        {
            'symbol': 'AAPL',
            'action': 'BUY STRONG',
            'confidence': 0.87,
            'position_size': 0.04,
            'current_price': 229.72,
            'reasoning': 'Strong TFT prediction + bullish sentiment'
        },
        {
            'symbol': 'TSLA', 
            'action': 'SELL WEAK',
            'confidence': 0.72,
            'position_size': 0.03,
            'current_price': 329.36,
            'reasoning': 'Weak momentum + negative sentiment'
        }
    ]
    
    print("🧪 Testing Paper Trading Tracker")
    print("=" * 40)
    
    # Process test signals
    for signal in test_signals:
        tracker.add_signal(
            symbol=signal['symbol'],
            action=signal['action'],
            confidence=signal['confidence'],
            position_size=signal['position_size'],
            current_price=signal['current_price'],
            reasoning=signal['reasoning'],
            timestamp=datetime.now()
        )
    
    # Update positions
    tracker.update_positions()
    
    # Show performance
    performance = tracker.get_performance_summary()
    print(f"\n📊 Performance Summary:")
    print(f"   Portfolio Value: ${performance['current_portfolio_value']:,.0f}")
    print(f"   Total Return: {performance['total_return_percent']:+.2f}%")
    print(f"   Active Positions: {performance['active_positions']}")
    
    return tracker

if __name__ == "__main__":
    tracker = main()