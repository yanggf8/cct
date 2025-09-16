/**
 * Independent Technical Analysis Module
 * Demonstrates that technical indicators can run completely independently
 * without neural networks or sentiment analysis
 */

import { createTechnicalFeatures } from './technical_indicators.js';

/**
 * Run pure technical analysis independently
 */
export async function runIndependentTechnicalAnalysis(symbols, env) {
  console.log('📊 Independent Technical Analysis - 33 Indicators Only');
  
  const results = {
    timestamp: new Date().toISOString(),
    analysis_type: 'independent_technical_analysis',
    feature_count: 33,
    symbols_analyzed: symbols,
    technical_signals: {},
    system_performance: {
      success_rate: 0,
      avg_confidence: 0,
      feature_coverage: 0
    }
  };

  let successfulAnalyses = 0;
  let totalFeatureCoverage = 0;
  let totalConfidence = 0;

  for (const symbol of symbols) {
    try {
      console.log(`📈 Technical analysis for ${symbol}...`);
      
      // Get 3-month historical data using FMP API
      const extendedData = await fetchExtendedMarketDataFMP(symbol, env);
      
      if (!extendedData || extendedData.length < 50) {
        throw new Error(`Insufficient data for ${symbol}: ${extendedData?.length || 0} points`);
      }
      
      // Calculate 33 technical features
      const technicalFeatures = createTechnicalFeatures(extendedData);
      
      if (!technicalFeatures) {
        throw new Error(`Technical features calculation failed for ${symbol}`);
      }
      
      // Create technical signal (independent prediction)
      const technicalSignal = createTechnicalSignal(technicalFeatures, symbol);
      
      results.technical_signals[symbol] = technicalSignal;
      successfulAnalyses++;
      totalFeatureCoverage += calculateFeatureCoverage(technicalFeatures);
      totalConfidence += technicalSignal.confidence;
      
      console.log(`✅ ${symbol}: ${technicalSignal.direction} (${(technicalSignal.confidence * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ Technical analysis failed for ${symbol}:`, error.message);
      
      results.technical_signals[symbol] = {
        symbol: symbol,
        error: error.message,
        status: 'failed'
      };
    }
  }
  
  // Calculate system performance
  results.system_performance.success_rate = (successfulAnalyses / symbols.length) * 100;
  results.system_performance.avg_confidence = successfulAnalyses > 0 ? 
    totalConfidence / successfulAnalyses : 0;
  results.system_performance.feature_coverage = successfulAnalyses > 0 ? 
    totalFeatureCoverage / successfulAnalyses : 0;
  
  console.log(`📊 Independent Technical Analysis Complete: ${successfulAnalyses}/${symbols.length} symbols`);
  return results;
}

/**
 * Fetch market data using Financial Modeling Prep API (independent of neural networks)
 */
async function fetchExtendedMarketDataFMP(symbol, env) {
  try {
    if (!env.FMP_API_KEY) {
      throw new Error('FMP_API_KEY not configured');
    }
    
    console.log(`📈 Fetching 3mo data for ${symbol} using FMP API...`);
    const fmpUrl = `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${getDateXMonthsAgo(3)}&to=${getCurrentDate()}&apikey=${env.FMP_API_KEY}`;
    
    const response = await fetch(fmpUrl);
    if (!response.ok) {
      throw new Error(`FMP API HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.historical || data.historical.length === 0) {
      throw new Error(`No historical data from FMP for ${symbol}`);
    }
    
    const ohlcData = data.historical.reverse().map(day => ({
      timestamp: new Date(day.date).getTime() / 1000,
      open: day.open,
      high: day.high,
      low: day.low,
      close: day.close,
      volume: day.volume
    }));
    
    console.log(`📈 FMP: Retrieved ${ohlcData.length} data points for ${symbol}`);
    return ohlcData;
    
  } catch (error) {
    console.error(`❌ FMP data fetch failed for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Create technical signal based purely on technical indicators
 */
function createTechnicalSignal(features, symbol) {
  let technicalScore = 0;
  let signalStrength = 0;
  let reasoningFactors = [];
  const currentPrice = features.close;
  
  // RSI Analysis (14% weight from local training)
  if (features.rsi_14 !== null) {
    if (features.rsi_14 > 70) {
      technicalScore -= 0.3; // Overbought
      reasoningFactors.push(`RSI overbought (${features.rsi_14.toFixed(1)})`);
    } else if (features.rsi_14 < 30) {
      technicalScore += 0.3; // Oversold
      reasoningFactors.push(`RSI oversold (${features.rsi_14.toFixed(1)})`);
    }
    signalStrength += 0.14;
  }
  
  // Bollinger Band Position (12% weight)
  if (features.bb_position !== null) {
    if (features.bb_position > 0.8) {
      technicalScore -= 0.25; // Near upper band
      reasoningFactors.push('Near Bollinger upper band');
    } else if (features.bb_position < 0.2) {
      technicalScore += 0.25; // Near lower band
      reasoningFactors.push('Near Bollinger lower band');
    }
    signalStrength += 0.12;
  }
  
  // MACD Analysis (10% weight)
  if (features.macd !== null && features.macd_signal !== null) {
    const macdBullish = features.macd > features.macd_signal;
    if (macdBullish && features.macd_histogram > 0) {
      technicalScore += 0.2;
      reasoningFactors.push('MACD bullish crossover');
    } else if (!macdBullish && features.macd_histogram < 0) {
      technicalScore -= 0.2;
      reasoningFactors.push('MACD bearish crossover');
    }
    signalStrength += 0.10;
  }
  
  // Moving Average Analysis (6% weight)
  if (features.price_vs_sma20 !== null) {
    if (features.price_vs_sma20 > 0.05) {
      technicalScore += 0.15; // Strong above SMA20
      reasoningFactors.push('Strong above SMA20');
    } else if (features.price_vs_sma20 < -0.05) {
      technicalScore -= 0.15; // Strong below SMA20
      reasoningFactors.push('Strong below SMA20');
    }
    signalStrength += 0.06;
  }
  
  // Volume Analysis (7% weight)
  if (features.volume_ratio !== null && features.volume_ratio > 1.5) {
    technicalScore += 0.1; // High volume confirmation
    reasoningFactors.push(`High volume (${features.volume_ratio.toFixed(1)}x avg)`);
    signalStrength += 0.07;
  }
  
  // Williams %R Analysis (4% weight)
  if (features.williams_r !== null) {
    if (features.williams_r > -20) {
      technicalScore -= 0.1; // Overbought
      reasoningFactors.push('Williams %R overbought');
    } else if (features.williams_r < -80) {
      technicalScore += 0.1; // Oversold
      reasoningFactors.push('Williams %R oversold');
    }
    signalStrength += 0.04;
  }
  
  // Stochastic Analysis (4% weight)
  if (features.stoch_k !== null) {
    if (features.stoch_k > 80) {
      technicalScore -= 0.08;
      reasoningFactors.push('Stochastic overbought');
    } else if (features.stoch_k < 20) {
      technicalScore += 0.08;
      reasoningFactors.push('Stochastic oversold');
    }
    signalStrength += 0.04;
  }
  
  // Determine direction and confidence
  let direction = 'NEUTRAL';
  if (technicalScore > 0.1) direction = 'UP';
  else if (technicalScore < -0.1) direction = 'DOWN';
  
  const confidence = Math.min(0.95, Math.max(0.1, signalStrength));
  const priceChange = technicalScore * 0.02; // Max 2% price movement from technicals
  const predictedPrice = currentPrice * (1 + priceChange);
  
  return {
    symbol: symbol,
    timestamp: new Date().toISOString(),
    current_price: currentPrice,
    predicted_price: predictedPrice,
    direction: direction,
    confidence: confidence,
    technical_score: technicalScore,
    signal_strength: signalStrength,
    reasoning: reasoningFactors.join(', ') || 'Neutral technical indicators',
    analysis_type: 'pure_technical_analysis',
    feature_summary: createFeatureSummary(features)
  };
}

/**
 * Helper functions
 */
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function getDateXMonthsAgo(months) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

function calculateFeatureCoverage(features) {
  const totalFeatures = Object.keys(features).length;
  const validFeatures = Object.values(features).filter(val => val !== null && val !== undefined).length;
  return (validFeatures / totalFeatures) * 100;
}

function createFeatureSummary(features) {
  const summary = [];
  
  if (features.rsi_14 !== null) {
    summary.push(`RSI: ${features.rsi_14.toFixed(1)}`);
  }
  
  if (features.bb_position !== null) {
    const position = features.bb_position > 0.8 ? 'Upper' : 
                    features.bb_position < 0.2 ? 'Lower' : 'Middle';
    summary.push(`BB: ${position}`);
  }
  
  if (features.macd !== null && features.macd_signal !== null) {
    const trend = features.macd > features.macd_signal ? 'Bullish' : 'Bearish';
    summary.push(`MACD: ${trend}`);
  }
  
  if (features.volume_ratio !== null) {
    summary.push(`Vol: ${features.volume_ratio.toFixed(1)}x`);
  }
  
  return summary.join(' | ');
}

export default {
  runIndependentTechnicalAnalysis
};