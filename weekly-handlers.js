/**
 * Weekly Analysis Handler Functions
 * Minimal handlers for the weekly market close analysis page
 */

/**
 * Serve the Weekly Analysis HTML page
 */
async function handleWeeklyAnalysisPage(request, env) {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Market Close Analysis - TFT Trading System</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ffffff; min-height: 100vh; padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header {
            text-align: center; margin-bottom: 40px; padding: 30px;
            background: rgba(255, 255, 255, 0.1); border-radius: 20px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .header h1 {
            font-size: 2.8rem; margin-bottom: 10px;
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card {
            background: rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 25px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center; transition: transform 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card .value { font-size: 2.5rem; font-weight: bold; color: #00f2fe; margin: 10px 0; }
        .chart-container {
            background: rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 30px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); margin: 20px 0;
        }
        .chart-wrapper { position: relative; height: 400px; }
        .loading { text-align: center; padding: 40px; font-size: 1.1rem; }
        .error { text-align: center; padding: 40px; background: rgba(255, 0, 0, 0.1); border-radius: 15px; color: #ff6b6b; }
        .refresh-button {
            background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none;
            padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 1rem;
            margin: 20px auto; display: block; transition: all 0.3s ease;
        }
        .refresh-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3); }
        .table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .table th, .table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        .table th { background: rgba(255, 255, 255, 0.1); color: #4facfe; }
        .table tr:hover { background: rgba(255, 255, 255, 0.05); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Weekly Market Close Analysis</h1>
            <p>Comprehensive prediction accuracy and model performance review</p>
            <button class="refresh-button" onclick="loadData()">🔄 Refresh Data</button>
        </div>

        <div id="loading" class="loading">Loading weekly analysis data...</div>

        <div id="error" class="error" style="display: none;">
            <h3>⚠️ Error Loading Data</h3>
            <p id="error-message"></p>
            <button class="refresh-button" onclick="loadData()">Try Again</button>
        </div>

        <div id="content" style="display: none;">
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Overall Accuracy</h3>
                    <div class="value" id="overall-accuracy">-</div>
                    <div class="label">Price Predictions</div>
                </div>
                <div class="stat-card">
                    <h3>Direction Accuracy</h3>
                    <div class="value" id="direction-accuracy">-</div>
                    <div class="label">UP/DOWN Signals</div>
                </div>
                <div class="stat-card">
                    <h3>Total Predictions</h3>
                    <div class="value" id="total-predictions">-</div>
                    <div class="label">This Week</div>
                </div>
                <div class="stat-card">
                    <h3>Best Model</h3>
                    <div class="value" id="best-model">-</div>
                    <div class="label">Top Performer</div>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">📈 Daily Accuracy Trends</h2>
                <div class="chart-wrapper">
                    <canvas id="accuracyChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">📋 Detailed Prediction History</h2>
                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>Model</th>
                                <th>Predicted</th>
                                <th>Actual</th>
                                <th>Direction</th>
                                <th>Accuracy</th>
                            </tr>
                        </thead>
                        <tbody id="predictions-table-body">
                            <tr><td colspan="7" style="text-align: center; padding: 20px;">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script>
        let accuracyChart;

        async function loadData() {
            try {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('error').style.display = 'none';
                document.getElementById('content').style.display = 'none';

                const response = await fetch('/api/weekly-data');
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }

                const data = await response.json();
                updateOverviewStats(data);
                createAccuracyChart(data.dailyAccuracy || []);
                updatePredictionsTable(data.predictions || []);

                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';

            } catch (error) {
                console.error('Error loading data:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error-message').textContent = error.message;
            }
        }

        function updateOverviewStats(data) {
            const stats = data.overview || {};
            document.getElementById('overall-accuracy').textContent = 
                stats.overallAccuracy ? \`\${stats.overallAccuracy.toFixed(2)}%\` : '-';
            document.getElementById('direction-accuracy').textContent = 
                stats.directionAccuracy ? \`\${stats.directionAccuracy.toFixed(2)}%\` : '-';
            document.getElementById('total-predictions').textContent = stats.totalPredictions || '-';
            document.getElementById('best-model').textContent = stats.bestModel || '-';
        }

        function createAccuracyChart(dailyData) {
            const ctx = document.getElementById('accuracyChart').getContext('2d');
            if (accuracyChart) accuracyChart.destroy();

            accuracyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dailyData.map(d => new Date(d.date).toLocaleDateString()),
                    datasets: [{
                        label: 'Price Accuracy (%)',
                        data: dailyData.map(d => d.priceAccuracy),
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Direction Accuracy (%)',
                        data: dailyData.map(d => d.directionAccuracy),
                        borderColor: '#00f2fe',
                        backgroundColor: 'rgba(0, 242, 254, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#ffffff' } } },
                    scales: {
                        x: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                        y: { ticks: { color: '#ffffff' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, min: 0, max: 100 }
                    }
                }
            });
        }

        function updatePredictionsTable(predictions) {
            const tbody = document.getElementById('predictions-table-body');
            tbody.innerHTML = '';

            predictions.forEach(prediction => {
                const row = document.createElement('tr');
                const accuracy = prediction.actual_price && prediction.predicted_price ? 
                    (100 - Math.abs((prediction.predicted_price - prediction.actual_price) / prediction.actual_price * 100)) : null;
                const directionCorrect = prediction.direction_correct !== undefined ? 
                    (prediction.direction_correct ? '✓' : '✗') : '-';

                row.innerHTML = \`
                    <td>\${new Date(prediction.date).toLocaleDateString()}</td>
                    <td><strong>\${prediction.symbol}</strong></td>
                    <td>\${prediction.model || 'Ensemble'}</td>
                    <td>$\${prediction.predicted_price ? prediction.predicted_price.toFixed(2) : '-'}</td>
                    <td>$\${prediction.actual_price ? prediction.actual_price.toFixed(2) : '-'}</td>
                    <td>\${prediction.direction || '➡️'} \${directionCorrect}</td>
                    <td>\${accuracy !== null ? accuracy.toFixed(2) + '%' : '-'}</td>
                \`;
                tbody.appendChild(row);
            });
        }

        document.addEventListener('DOMContentLoaded', loadData);
    </script>
</body>
</html>`;

  return new Response(htmlContent, {
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * Provide weekly data API for the analysis page
 */
async function handleWeeklyDataAPI(request, env) {
  try {
    // Get the last 7 days of fact table data
    const factTableData = await getFactTableData(env);
    
    // Process the data to create charts and analytics
    const weeklyData = await processWeeklyAnalysisData(factTableData, env);
    
    return new Response(JSON.stringify(weeklyData, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Weekly data API error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
      overview: {
        overallAccuracy: 0,
        directionAccuracy: 0,
        totalPredictions: 0,
        bestModel: 'No Data'
      },
      dailyAccuracy: [],
      modelPerformance: {},
      predictions: [],
      symbolBreakdown: {}
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Process fact table data into weekly analysis format
 */
async function processWeeklyAnalysisData(factTableData, env) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Filter to last 7 days and valid predictions
  const recentPredictions = factTableData.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= sevenDaysAgo && 
           record.predicted_price !== null && 
           record.actual_price !== null;
  });
  
  // Calculate overall accuracy metrics
  let totalPriceAccuracy = 0;
  let totalDirectionAccuracy = 0;
  let priceCount = 0;
  let directionCount = 0;
  
  const symbolStats = {};
  const modelStats = {};
  const dailyStats = {};
  
  recentPredictions.forEach(record => {
    // Price accuracy calculation
    if (record.predicted_price && record.actual_price) {
      const priceError = Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100);
      const priceAccuracy = Math.max(0, 100 - priceError);
      totalPriceAccuracy += priceAccuracy;
      priceCount++;
    }
    
    // Direction accuracy
    if (record.direction_correct !== undefined) {
      totalDirectionAccuracy += record.direction_correct ? 100 : 0;
      directionCount++;
    }
    
    // Symbol breakdown
    if (!symbolStats[record.symbol]) {
      symbolStats[record.symbol] = {
        priceAccuracy: 0,
        directionAccuracy: 0,
        totalPredictions: 0,
        bestModel: 'Ensemble'
      };
    }
    symbolStats[record.symbol].totalPredictions++;
    
    // Model performance tracking
    const model = record.model || 'Ensemble';
    if (!modelStats[model]) {
      modelStats[model] = { accuracy: 0, count: 0 };
    }
    if (record.predicted_price && record.actual_price) {
      const accuracy = Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
      modelStats[model].accuracy += accuracy;
      modelStats[model].count++;
    }
    
    // Daily aggregation
    const dateKey = record.date;
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { 
        priceAccuracy: 0, 
        directionAccuracy: 0, 
        priceCount: 0, 
        directionCount: 0 
      };
    }
    if (record.predicted_price && record.actual_price) {
      const accuracy = Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
      dailyStats[dateKey].priceAccuracy += accuracy;
      dailyStats[dateKey].priceCount++;
    }
    if (record.direction_correct !== undefined) {
      dailyStats[dateKey].directionAccuracy += record.direction_correct ? 100 : 0;
      dailyStats[dateKey].directionCount++;
    }
  });
  
  // Process daily accuracy for chart
  const dailyAccuracy = Object.keys(dailyStats).map(date => ({
    date,
    priceAccuracy: dailyStats[date].priceCount > 0 ? 
      dailyStats[date].priceAccuracy / dailyStats[date].priceCount : 0,
    directionAccuracy: dailyStats[date].directionCount > 0 ? 
      dailyStats[date].directionAccuracy / dailyStats[date].directionCount : 0
  })).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Find best performing model
  let bestModel = 'Ensemble';
  let bestAccuracy = 0;
  Object.entries(modelStats).forEach(([model, stats]) => {
    if (stats.count > 0) {
      const avgAccuracy = stats.accuracy / stats.count;
      if (avgAccuracy > bestAccuracy) {
        bestAccuracy = avgAccuracy;
        bestModel = model;
        modelStats[model].accuracy = avgAccuracy; // Store average for chart
      }
    }
  });
  
  // Calculate symbol-level stats
  Object.keys(symbolStats).forEach(symbol => {
    const symbolPredictions = recentPredictions.filter(r => r.symbol === symbol);
    let symbolPriceAcc = 0;
    let symbolDirAcc = 0;
    let pCount = 0;
    let dCount = 0;
    
    symbolPredictions.forEach(record => {
      if (record.predicted_price && record.actual_price) {
        symbolPriceAcc += Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
        pCount++;
      }
      if (record.direction_correct !== undefined) {
        symbolDirAcc += record.direction_correct ? 100 : 0;
        dCount++;
      }
    });
    
    symbolStats[symbol].priceAccuracy = pCount > 0 ? symbolPriceAcc / pCount : 0;
    symbolStats[symbol].directionAccuracy = dCount > 0 ? symbolDirAcc / dCount : 0;
  });
  
  return {
    overview: {
      overallAccuracy: priceCount > 0 ? totalPriceAccuracy / priceCount : 0,
      directionAccuracy: directionCount > 0 ? totalDirectionAccuracy / directionCount : 0,
      totalPredictions: recentPredictions.length,
      bestModel: bestModel
    },
    dailyAccuracy: dailyAccuracy,
    modelPerformance: modelStats,
    predictions: recentPredictions.map(record => ({
      date: record.date,
      symbol: record.symbol,
      model: record.model || 'Ensemble',
      predicted_price: record.predicted_price,
      actual_price: record.actual_price,
      direction: record.direction_prediction,
      direction_correct: record.direction_correct,
      confidence: record.confidence
    })),
    symbolBreakdown: symbolStats
  };
}

// Export functions for use in the main worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleWeeklyAnalysisPage,
    handleWeeklyDataAPI,
    processWeeklyAnalysisData
  };
}