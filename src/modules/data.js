/**
 * Data Access Module
 * Handles data retrieval from KV storage and fact table operations
 */

/**
 * Get fact table data from stored analysis results
 * Convert stored analysis data into fact table format for weekly analysis
 */
export async function getFactTableData(env) {
  try {
    // Get the last 7 days of analysis data
    const factTableData = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      // Try to get analysis data for this date
      const analysisKey = `analysis_${dateStr}`;
      const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
      
      if (analysisJson) {
        try {
          const analysisData = JSON.parse(analysisJson);
          
          // Convert analysis data to fact table format
          if (analysisData.symbols_analyzed && analysisData.trading_signals) {
            analysisData.symbols_analyzed.forEach(symbol => {
              const signal = analysisData.trading_signals[symbol];
              if (signal) {
                factTableData.push({
                  date: dateStr,
                  symbol: symbol,
                  predicted_price: signal.predicted_price,
                  current_price: signal.current_price,
                  actual_price: signal.current_price, // Mock actual price for now
                  direction_prediction: signal.direction,
                  direction_correct: Math.random() > 0.5, // Mock direction accuracy
                  confidence: signal.confidence,
                  model: signal.model || 'TFT-Ensemble',
                  trigger_mode: analysisData.trigger_mode,
                  timestamp: analysisData.timestamp || checkDate.toISOString()
                });
              }
            });
          }
        } catch (parseError) {
          console.error(`❌ Error parsing analysis data for ${dateStr}:`, parseError);
        }
      }
    }
    
    console.log(`📊 Retrieved ${factTableData.length} fact table records from analysis data`);
    return factTableData;
    
  } catch (error) {
    console.error('❌ Error retrieving fact table data:', error);
    return [];
  }
}

/**
 * Get fact table data with custom date range and week selection
 */
export async function getFactTableDataWithRange(env, rangeDays = 7, weekSelection = 'current') {
  try {
    const factTableData = [];
    const today = new Date();
    
    // Calculate start date based on week selection
    let startDate = new Date(today);
    if (weekSelection === 'last1') {
      startDate.setDate(today.getDate() - 7);
    } else if (weekSelection === 'last2') {
      startDate.setDate(today.getDate() - 14);
    } else if (weekSelection === 'last3') {
      startDate.setDate(today.getDate() - 21);
    }
    
    // Get data for the specified range
    for (let i = 0; i < rangeDays; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      // Try to get analysis data for this date
      const analysisKey = `analysis_${dateStr}`;
      const analysisJson = await env.TRADING_RESULTS.get(analysisKey);
      
      if (analysisJson) {
        try {
          const analysisData = JSON.parse(analysisJson);
          
          // Convert analysis data to fact table format
          if (analysisData.symbols_analyzed && analysisData.trading_signals) {
            analysisData.symbols_analyzed.forEach(symbol => {
              const signal = analysisData.trading_signals[symbol];
              if (signal) {
                // Generate more realistic mock actual prices based on predicted prices
                const priceVariation = (Math.random() - 0.5) * 0.02; // ±1% variation
                const actualPrice = signal.predicted_price * (1 + priceVariation);
                
                // Determine direction accuracy
                const predictedDirection = signal.predicted_price > signal.current_price;
                const actualDirection = actualPrice > signal.current_price;
                const directionCorrect = predictedDirection === actualDirection;
                
                factTableData.push({
                  date: dateStr,
                  symbol: symbol,
                  predicted_price: signal.predicted_price,
                  current_price: signal.current_price,
                  actual_price: actualPrice,
                  direction_prediction: signal.direction,
                  direction_correct: directionCorrect,
                  confidence: signal.confidence,
                  model: signal.model || 'TFT-Ensemble',
                  trigger_mode: analysisData.trigger_mode,
                  timestamp: analysisData.timestamp || checkDate.toISOString()
                });
              }
            });
          }
        } catch (parseError) {
          console.error(`❌ Error parsing analysis data for ${dateStr}:`, parseError);
        }
      }
    }
    
    console.log(`📊 Retrieved ${factTableData.length} records for range=${rangeDays}, week=${weekSelection}`);
    return factTableData;
    
  } catch (error) {
    console.error('❌ Error retrieving fact table data with range:', error);
    return [];
  }
}

/**
 * Store fact table data to KV storage
 */
export async function storeFactTableData(env, factTableData) {
  try {
    const factTableKey = 'fact_table_data';
    await env.TRADING_RESULTS.put(
      factTableKey,
      JSON.stringify(factTableData),
      { expirationTtl: 604800 } // 7 days
    );
    
    console.log(`💾 Stored ${factTableData.length} fact table records to KV`);
    return true;
    
  } catch (error) {
    console.error('❌ Error storing fact table data:', error);
    return false;
  }
}

/**
 * Get analysis results by date
 */
export async function getAnalysisResultsByDate(env, dateString) {
  try {
    const dailyKey = `analysis_${dateString}`;
    const resultJson = await env.TRADING_RESULTS.get(dailyKey);
    
    if (!resultJson) {
      return null;
    }
    
    return JSON.parse(resultJson);
    
  } catch (error) {
    console.error(`❌ Error retrieving analysis for ${dateString}:`, error);
    return null;
  }
}

/**
 * List all KV keys with a prefix
 */
export async function listKVKeys(env, prefix = '') {
  try {
    const keys = [];
    let cursor = null;
    
    do {
      const result = await env.TRADING_RESULTS.list({ 
        prefix: prefix,
        cursor: cursor,
        limit: 1000
      });
      
      keys.push(...result.keys);
      cursor = result.cursor;
      
    } while (cursor);
    
    return keys;
    
  } catch (error) {
    console.error('❌ Error listing KV keys:', error);
    return [];
  }
}