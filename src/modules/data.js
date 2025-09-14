/**
 * Data Access Module
 * Handles data retrieval from KV storage and fact table operations
 */

/**
 * Get fact table data from KV storage
 * This function was referenced in weekly-analysis.js but needs to be imported
 */
export async function getFactTableData(env) {
  try {
    // Get the fact table data from KV storage
    const factTableKey = 'fact_table_data';
    const factTableJson = await env.TRADING_RESULTS.get(factTableKey);
    
    if (!factTableJson) {
      console.log('No fact table data found in KV storage');
      return [];
    }
    
    const factTableData = JSON.parse(factTableJson);
    console.log(`📊 Retrieved ${factTableData.length} fact table records from KV`);
    
    return factTableData;
    
  } catch (error) {
    console.error('❌ Error retrieving fact table data:', error);
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