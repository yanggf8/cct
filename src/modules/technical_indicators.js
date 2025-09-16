/**
 * Technical Indicators Module for Cloudflare Workers
 * Migrated from local_training_manual_ta.py for CF-compatible feature engineering
 * Implements 33 technical indicators for enhanced stock prediction
 */

// Simple Moving Average
export function sma(prices, length) {
  if (prices.length < length) return null;
  const sum = prices.slice(-length).reduce((a, b) => a + b, 0);
  return sum / length;
}

// Exponential Moving Average
export function ema(prices, length, previousEma = null) {
  if (prices.length === 0) return null;
  
  const multiplier = 2 / (length + 1);
  const currentPrice = prices[prices.length - 1];
  
  if (previousEma === null) {
    // Initialize with SMA for first value
    if (prices.length < length) return null;
    return sma(prices.slice(0, length), length);
  }
  
  return (currentPrice * multiplier) + (previousEma * (1 - multiplier));
}

// Calculate EMA series for array of prices
export function emaSeries(prices, length) {
  const emaValues = [];
  let previousEma = null;
  
  for (let i = 0; i < prices.length; i++) {
    const currentPrices = prices.slice(0, i + 1);
    const emaValue = ema(currentPrices, length, previousEma);
    emaValues.push(emaValue);
    if (emaValue !== null) previousEma = emaValue;
  }
  
  return emaValues;
}

// Relative Strength Index
export function rsi(prices, length = 14) {
  if (prices.length < length + 1) return null;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let gains = 0;
  let losses = 0;
  
  // Initial average gain/loss
  for (let i = 0; i < length; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += Math.abs(changes[i]);
  }
  
  gains /= length;
  losses /= length;
  
  if (losses === 0) return 100;
  
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

// Bollinger Bands
export function bollingerBands(prices, length = 20, std = 2) {
  if (prices.length < length) return { upper: null, lower: null, middle: null };
  
  const recentPrices = prices.slice(-length);
  const middle = sma(recentPrices, length);
  
  // Calculate standard deviation
  const variance = recentPrices.reduce((sum, price) => {
    return sum + Math.pow(price - middle, 2);
  }, 0) / length;
  
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: middle + (stdDev * std),
    lower: middle - (stdDev * std),
    middle: middle,
    width: (2 * stdDev * std) / middle,
    position: (prices[prices.length - 1] - (middle - stdDev * std)) / (2 * stdDev * std)
  };
}

// Average True Range
export function atr(ohlcData, length = 14) {
  if (ohlcData.length < length + 1) return null;
  
  const trueRanges = [];
  
  for (let i = 1; i < ohlcData.length; i++) {
    const high = ohlcData[i].high;
    const low = ohlcData[i].low;
    const prevClose = ohlcData[i - 1].close;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  // Return average of last 'length' true ranges
  const recentTR = trueRanges.slice(-length);
  return recentTR.reduce((a, b) => a + b, 0) / length;
}

// MACD (Moving Average Convergence Divergence)
export function macd(prices, fast = 12, slow = 26, signal = 9) {
  if (prices.length < slow) return { macd: null, signal: null, histogram: null };
  
  const emaFast = emaSeries(prices, fast);
  const emaSlow = emaSeries(prices, slow);
  
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    } else {
      macdLine.push(null);
    }
  }
  
  // Filter out nulls for signal calculation
  const validMacd = macdLine.filter(val => val !== null);
  if (validMacd.length < signal) {
    return { macd: macdLine[macdLine.length - 1], signal: null, histogram: null };
  }
  
  const signalLine = emaSeries(validMacd, signal);
  const currentSignal = signalLine[signalLine.length - 1];
  const currentMacd = macdLine[macdLine.length - 1];
  
  return {
    macd: currentMacd,
    signal: currentSignal,
    histogram: currentMacd && currentSignal ? currentMacd - currentSignal : null
  };
}

// Stochastic Oscillator
export function stochastic(ohlcData, kPeriod = 14, dPeriod = 3) {
  if (ohlcData.length < kPeriod) return { k: null, d: null };
  
  const recentData = ohlcData.slice(-kPeriod);
  const highs = recentData.map(d => d.high);
  const lows = recentData.map(d => d.low);
  const currentClose = ohlcData[ohlcData.length - 1].close;
  
  const highestHigh = Math.max(...highs);
  const lowestLow = Math.min(...lows);
  
  const kPercent = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  // For %D, we need multiple %K values - simplified for CF Workers
  // Using current %K as approximation for %D in single calculation
  const dPercent = kPercent; // Simplified - in full implementation would be SMA of recent %K values
  
  return { k: kPercent, d: dPercent };
}

// Williams %R
export function williamsR(ohlcData, length = 14) {
  if (ohlcData.length < length) return null;
  
  const recentData = ohlcData.slice(-length);
  const highs = recentData.map(d => d.high);
  const lows = recentData.map(d => d.low);
  const currentClose = ohlcData[ohlcData.length - 1].close;
  
  const highestHigh = Math.max(...highs);
  const lowestLow = Math.min(...lows);
  
  return -100 * ((highestHigh - currentClose) / (highestHigh - lowestLow));
}

// On Balance Volume (simplified for CF Workers)
export function obv(ohlcData) {
  if (ohlcData.length < 2) return null;
  
  let obvValue = ohlcData[0].volume;
  
  for (let i = 1; i < ohlcData.length; i++) {
    const currentClose = ohlcData[i].close;
    const previousClose = ohlcData[i - 1].close;
    const currentVolume = ohlcData[i].volume;
    
    if (currentClose > previousClose) {
      obvValue += currentVolume;
    } else if (currentClose < previousClose) {
      obvValue -= currentVolume;
    }
    // If equal, OBV stays the same
  }
  
  return obvValue;
}

// Price Returns
export function priceReturns(prices, period = 1) {
  if (prices.length < period + 1) return null;
  
  const currentPrice = prices[prices.length - 1];
  const pastPrice = prices[prices.length - 1 - period];
  
  return (currentPrice - pastPrice) / pastPrice;
}

// Create comprehensive technical features for a symbol
export function createTechnicalFeatures(ohlcData) {
  if (!ohlcData || ohlcData.length < 50) {
    return null; // Need sufficient data for all indicators
  }
  
  const closes = ohlcData.map(d => d.close);
  const volumes = ohlcData.map(d => d.volume);
  const currentData = ohlcData[ohlcData.length - 1];
  
  // Trend Indicators
  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema12Series = emaSeries(closes, 12);
  const ema26Series = emaSeries(closes, 26);
  const ema12 = ema12Series[ema12Series.length - 1];
  const ema26 = ema26Series[ema26Series.length - 1];
  
  // MACD
  const macdData = macd(closes);
  
  // Momentum Indicators  
  const rsi14 = rsi(closes, 14);
  const rsi30 = rsi(closes, 30);
  const stochData = stochastic(ohlcData);
  const williamsRValue = williamsR(ohlcData);
  
  // Volatility Indicators
  const bbData = bollingerBands(closes);
  const atrValue = atr(ohlcData);
  
  // Volume Indicators
  const volumeSma = sma(volumes, 20);
  const volumeRatio = volumeSma ? currentData.volume / volumeSma : null;
  const obvValue = obv(ohlcData);
  
  // Price Action Features
  const return1d = priceReturns(closes, 1);
  const return3d = priceReturns(closes, 3);
  const return5d = priceReturns(closes, 5);
  const return10d = priceReturns(closes, 10);
  
  // Price position in daily range
  const pricePosition = currentData.high !== currentData.low ? 
    (currentData.close - currentData.low) / (currentData.high - currentData.low) : 0.5;
  
  // Gap analysis
  const gap = ohlcData.length > 1 ? 
    (currentData.open - ohlcData[ohlcData.length - 2].close) / ohlcData[ohlcData.length - 2].close : 0;
  
  // Relative strength
  const priceVsSma20 = sma20 ? (currentData.close / sma20) - 1 : null;
  const priceVsSma50 = sma50 ? (currentData.close / sma50) - 1 : null;
  
  // Moving average slopes (simplified)
  const sma20Slope = closes.length >= 25 ? 
    priceReturns(closes.slice(-25).filter((_, i, arr) => i % 5 === 0 || i === arr.length - 1), 1) : null;
  const sma50Slope = closes.length >= 60 ? 
    priceReturns(closes.slice(-60).filter((_, i, arr) => i % 10 === 0 || i === arr.length - 1), 1) : null;
  
  return {
    // Basic OHLCV
    open: currentData.open,
    high: currentData.high,
    low: currentData.low,
    close: currentData.close,
    volume: currentData.volume,
    
    // Trend Indicators
    sma_5: sma5,
    sma_20: sma20,
    sma_50: sma50,
    ema_12: ema12,
    ema_26: ema26,
    
    // MACD
    macd: macdData.macd,
    macd_signal: macdData.signal,
    macd_histogram: macdData.histogram,
    
    // Momentum
    rsi_14: rsi14,
    rsi_30: rsi30,
    stoch_k: stochData.k,
    stoch_d: stochData.d,
    williams_r: williamsRValue,
    
    // Volatility
    bb_upper: bbData.upper,
    bb_lower: bbData.lower,
    bb_middle: bbData.middle,
    bb_width: bbData.width,
    bb_position: bbData.position,
    atr: atrValue,
    
    // Volume
    volume_sma: volumeSma,
    volume_ratio: volumeRatio,
    obv: obvValue,
    
    // Price Action
    return_1d: return1d,
    return_3d: return3d,
    return_5d: return5d,
    return_10d: return10d,
    price_position: pricePosition,
    gap: gap,
    
    // Relative Strength
    price_vs_sma20: priceVsSma20,
    price_vs_sma50: priceVsSma50,
    sma20_slope: sma20Slope,
    sma50_slope: sma50Slope
  };
}

// Normalize technical features for ML models
export function normalizeTechnicalFeatures(features) {
  if (!features) return null;
  
  // Create normalized feature vector (similar to sklearn StandardScaler)
  const normalized = {};
  
  // Features that should be normalized to 0-1 range
  const percentageFeatures = [
    'return_1d', 'return_3d', 'return_5d', 'return_10d',
    'price_vs_sma20', 'price_vs_sma50', 'sma20_slope', 'sma50_slope', 'gap'
  ];
  
  // Features that are already in reasonable ranges
  const boundedFeatures = [
    'rsi_14', 'rsi_30', 'stoch_k', 'stoch_d', 'williams_r',
    'bb_position', 'price_position'
  ];
  
  // Copy basic features
  Object.keys(features).forEach(key => {
    const value = features[key];
    
    if (value === null || value === undefined) {
      normalized[key] = 0; // Handle null values
    } else if (percentageFeatures.includes(key)) {
      // Clip extreme values and normalize
      normalized[key] = Math.max(-0.1, Math.min(0.1, value)) * 10; // Scale to roughly -1 to 1
    } else if (boundedFeatures.includes(key)) {
      // Already in good ranges, just ensure bounds
      normalized[key] = Math.max(-100, Math.min(100, value)) / 100; // Scale to -1 to 1
    } else if (key.includes('volume')) {
      // Log transform volume-based features
      normalized[key] = value > 0 ? Math.log(value + 1) / 20 : 0; // Rough normalization
    } else {
      // Price-based features - use relative scaling
      normalized[key] = value / features.close; // Relative to current price
    }
  });
  
  return normalized;
}

// Export main function for integration with existing system
export default {
  createTechnicalFeatures,
  normalizeTechnicalFeatures,
  sma,
  ema,
  rsi,
  bollingerBands,
  atr,
  macd,
  stochastic,
  williamsR,
  obv,
  priceReturns
};