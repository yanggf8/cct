/**
 * Weekly Analysis Module
 * Handles the dedicated weekly market close analysis page and data API
 */

import { getFactTableData, getFactTableDataWithRange } from './data.js';

/**
 * Serve the Weekly Analysis HTML page
 */
export async function handleWeeklyAnalysisPage(request, env) {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dual AI Comparison Dashboard - TFT Trading System</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
  <script src="js/api-client.js?v=20251018-2"></script>
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

        /* 4 Moment Navigation Styles */
        .nav-report-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .nav-report-btn:hover {
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3);
            text-decoration: none;
            color: #ffffff;
        }

        .nav-report-btn.active {
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            border-color: #00f2fe;
            box-shadow: 0 4px 15px rgba(79, 172, 254, 0.4);
            color: #ffffff;
        }

        .nav-report-btn.active:hover {
            background: linear-gradient(45deg, #00f2fe, #4facfe);
            transform: translateY(-1px);
        }

        @media (max-width: 768px) {
            .report-navigation {
                flex-direction: column !important;
                gap: 8px !important;
            }

            .nav-report-btn {
                justify-content: center;
                min-width: 200px;
            }
        }
        .stat-card {
            background: rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 25px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center; transition: transform 0.3s ease;
        }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card h3 { font-size: 1.1rem; margin-bottom: 10px; opacity: 0.8; text-transform: uppercase; }
        .stat-card .value { font-size: 2.5rem; font-weight: bold; color: #00f2fe; margin: 10px 0; }
        .chart-container {
            background: rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 30px;
            backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); margin: 20px 0;
        }
        .chart-wrapper { position: relative; height: 400px; }
        .loading { text-align: center; padding: 40px; font-size: 1.1rem; }
        .error { 
            text-align: center; padding: 40px; background: rgba(255, 0, 0, 0.1); 
            border-radius: 15px; color: #ff6b6b; 
        }
        .refresh-button {
            background: linear-gradient(45deg, #4facfe, #00f2fe); color: white; border: none;
            padding: 12px 24px; border-radius: 25px; cursor: pointer; font-size: 1rem;
            margin: 20px auto; display: block; transition: all 0.3s ease;
        }
        .refresh-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3); }
        .table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .table th, .table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
        .table th { background: rgba(255, 255, 255, 0.1); color: #4facfe; font-weight: 600; }
        .table tr:hover { background: rgba(255, 255, 255, 0.05); }
        .accuracy-indicator { display: inline-flex; align-items: center; gap: 5px; }
        .symbol-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .symbol-card { background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1); }
        .symbol-card h4 { color: #4facfe; margin-bottom: 15px; font-size: 1.2rem; }
        .prediction-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .prediction-row:last-child { border-bottom: none; }
        
        @media (max-width: 768px) {
            .header h1 { font-size: 2rem; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .stat-card .value { font-size: 2rem; }
            .chart-wrapper { height: 300px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Dual AI Comparison Dashboard</h1>
            <p>Comprehensive prediction accuracy and model performance review</p>

            <!-- 4 Moment Navigation -->
            <div class="report-navigation" style="margin: 20px 0; display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; background: rgba(79, 172, 254, 0.1); padding: 15px; border-radius: 12px; backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);">
                <span style="color: #4facfe; font-weight: 600; margin-right: 10px;">📈 Navigate Reports:</span>
                <a href="/pre-market-briefing" class="nav-report-btn">📅 Pre-Market</a>
                <a href="/intraday-check" class="nav-report-btn">📊 Intraday</a>
                <a href="/end-of-day-summary" class="nav-report-btn">📈 End-of-Day</a>
                <a href="/weekly-review" class="nav-report-btn active">📋 Weekly Review</a>
                <a href="/weekly-analysis" class="nav-report-btn">📊 Weekly Dashboard</a>
            </div>

            <!-- Date Selection Controls -->
            <div style="margin: 20px 0; display: flex; gap: 15px; align-items: center; justify-content: center; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label for="weekSelect" style="color: #4facfe; font-weight: 600;">📅 Select Week:</label>
                    <select id="weekSelect" onchange="loadData()" style="
                        padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);
                        background: rgba(255,255,255,0.1); color: white; font-size: 14px;">
                        <option value="current">Current Week</option>
                        <option value="last1">Last Week</option>
                        <option value="last2">2 Weeks Ago</option>
                        <option value="last3">3 Weeks Ago</option>
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label for="dateRange" style="color: #4facfe; font-weight: 600;">📊 Date Range:</label>
                    <select id="dateRange" onchange="loadData()" style="
                        padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);
                        background: rgba(255,255,255,0.1); color: white; font-size: 14px;">
                        <option value="7">Last 7 Days</option>
                        <option value="14">Last 14 Days</option>
                        <option value="30">Last 30 Days</option>
                    </select>
                </div>
                <button class="refresh-button" onclick="loadData()" style="margin: 0;">🔄 Refresh Data</button>
            </div>
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
                    <h3>Dual AI Agreement</h3>
                    <div class="value" id="layer-consistency">-</div>
                    <div class="label">Dual AI Agreement</div>
                </div>
                <div class="stat-card">
                    <h3>Total Predictions</h3>
                    <div class="value" id="total-predictions">-</div>
                    <div class="label">Analysis Count</div>
                </div>
                <div class="stat-card">
                    <h3>Primary Model</h3>
                    <div class="value" id="best-model">-</div>
                    <div class="label">Top Performer</div>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">📈 Daily Dual AI Accuracy Trends</h2>
                <div class="chart-wrapper">
                    <canvas id="accuracyChart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">📋 Dual AI Analysis History</h2>
                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>Primary Model</th>
                                <th>Sentiment</th>
                                <th>Direction</th>
                                <th>Dual AI Agreement</th>
                                <th>Overall Confidence</th>
                                <th>Articles Analyzed</th>
                            </tr>
                        </thead>
                        <tbody id="predictions-table-body">
                            <tr><td colspan="8" style="text-align: center; padding: 20px;">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="chart-container">
                <h2 style="text-align: center; color: #4facfe; margin-bottom: 20px;">🤝 Dual AI Agreement Analysis</h2>
                <div id="symbol-breakdown" class="symbol-grid">
                    <!-- Dynamic content -->
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

                // Get selected parameters
                const weekSelect = document.getElementById('weekSelect');
                const dateRange = document.getElementById('dateRange');
                const selectedWeek = weekSelect ? weekSelect.value : 'current';
                const selectedRange = dateRange ? dateRange.value : '7';

                // Build API URL with parameters
                const apiUrl = '/api/weekly-data?week=' + selectedWeek + '&range=' + selectedRange;
                const response = await window.cctApi.request(apiUrl);
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                const data = await response.json();
                updateOverviewStats(data);
                createAccuracyChart(data.dailyAccuracy || []);
                updatePredictionsTable(data.predictions || []);
                updateSymbolBreakdown(data.symbolBreakdown || {});

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
            document.getElementById('layer-consistency').textContent =
                stats.layerConsistency ? \`\${(stats.layerConsistency * 100).toFixed(1)}%\` : '-';
            document.getElementById('total-predictions').textContent = stats.totalPredictions || '-';
            document.getElementById('best-model').textContent = stats.primaryModel || stats.bestModel || 'GPT-OSS-120B';
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
                    }, {
                        label: 'Dual AI Agreement (%)',
                        data: dailyData.map(d => (d.layer_consistency || 0) * 100),
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
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

                const directionCorrect = prediction.direction_correct !== undefined ?
                    (prediction.direction_correct ? '✓' : '✗') : '-';

                // Get sentiment direction arrow for dual AI analysis
                const getDirectionArrow = (direction) => {
                    switch(direction?.toUpperCase()) {
                        case 'BULLISH': return '↗️';
                        case 'BEARISH': return '↘️';
                        default: return '➡️';
                    }
                };

                // Format layer consistency with appropriate styling
                const layerConsistency = prediction.layer_consistency !== undefined ?
                    (prediction.layer_consistency * 100).toFixed(1) + '%' : '-';

                // Format overall confidence
                const overallConfidence = prediction.overall_confidence !== undefined ?
                    (prediction.overall_confidence * 100).toFixed(1) + '%' : '-';

                row.innerHTML = \`
                    <td>\${new Date(prediction.date).toLocaleDateString()}</td>
                    <td><strong>\${prediction.symbol}</strong></td>
                    <td>\${prediction.primary_model || prediction.model || 'GPT-OSS-120B'}</td>
                    <td>\${prediction.sentiment_label || '-'}</td>
                    <td>
                        <div class="accuracy-indicator">
                            <span class="direction-arrow">\${getDirectionArrow(prediction.direction_prediction)}</span>
                            <span>\${directionCorrect}</span>
                        </div>
                    </td>
                    <td>\${layerConsistency}</td>
                    <td>\${overallConfidence}</td>
                    <td>\${prediction.articles_analyzed || '-'}</td>
                \`;
                tbody.appendChild(row);
            });
        }

        function updateSymbolBreakdown(symbolData) {
            const container = document.getElementById('symbol-breakdown');
            container.innerHTML = '';

            Object.entries(symbolData).forEach(([symbol, data]) => {
                const card = document.createElement('div');
                card.className = 'symbol-card';

                // Format layer consistency with color coding
                const layerConsistency = data.layerConsistency !== undefined ? data.layerConsistency * 100 : 0;
                let consistencyColor = '#ff6b6b'; // Default red
                if (layerConsistency >= 70) consistencyColor = '#00f2fe'; // High consistency - cyan
                else if (layerConsistency >= 50) consistencyColor = '#ffd93d'; // Medium consistency - yellow

                card.innerHTML = \`
                    <h4>\${symbol}</h4>
                    <div class="prediction-row">
                        <span>📊 Price Accuracy:</span>
                        <span style="color: #4facfe; font-weight: 600;">\${data.priceAccuracy ? data.priceAccuracy.toFixed(2) + '%' : '-'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>🎯 Direction Accuracy:</span>
                        <span>\${data.directionAccuracy ? data.directionAccuracy.toFixed(2) + '%' : '-'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>🤝 Dual AI Agreement:</span>
                        <span style="color: \${consistencyColor}; font-weight: 600;">\${layerConsistency.toFixed(1)}%</span>
                    </div>
                    <div class="prediction-row">
                        <span>📰 Avg Articles:</span>
                        <span>\${data.avgArticles ? data.avgArticles.toFixed(1) : '0'}</span>
                    </div>
                    <div class="prediction-row">
                        <span>📊 Total Analyses:</span>
                        <span>\${data.totalPredictions || 0}</span>
                    </div>
                    <div class="prediction-row">
                        <span>🚀 Primary Model:</span>
                        <span style="color: #4facfe; font-weight: 600;">\${data.primaryModel || 'GPT-OSS-120B'}</span>
                    </div>
                \`;

                container.appendChild(card);
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
export async function handleWeeklyDataAPI(request, env) {
  try {
    // Get URL parameters for date filtering
    const url = new URL(request.url);
    const weekParam = url.searchParams.get('week') || 'current';
    const rangeParam = parseInt(url.searchParams.get('range')) || 7;
    
    console.log(`📊 Weekly data requested: week=${weekParam}, range=${rangeParam}`);
    
    // Get fact table data with custom date range
    const factTableData = await getFactTableDataWithRange(env, rangeParam, weekParam);
    
    // Process the data to create charts and analytics
    const weeklyData = await processWeeklyAnalysisData(factTableData, env);
    
    // Add metadata about the request
    weeklyData.metadata = {
      week_selected: weekParam,
      date_range_days: rangeParam,
      data_points: factTableData.length,
      generated_at: new Date().toISOString()
    };
    
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
  let totalSentimentAccuracy = 0;
  let totalNeuralAgreement = 0;
  let priceCount = 0;
  let directionCount = 0;
  let sentimentCount = 0;
  let agreementCount = 0;

  const symbolStats = {};
  const modelStats = {};
  const dailyStats = {};
  const sentimentStats = {};
  const neuralAgreementStats = {};
  
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
    
    // Symbol breakdown (enhanced for sentiment-first)
    if (!symbolStats[record.symbol]) {
      symbolStats[record.symbol] = {
        priceAccuracy: 0,
        directionAccuracy: 0,
        sentimentAccuracy: 0,
        neuralAgreementRate: 0,
        avgNewsArticles: 0,
        totalPredictions: 0,
        bestModel: 'GPT-OSS-120B',
        primaryModel: 'GPT-OSS-120B'
      };
    }
    symbolStats[record.symbol].totalPredictions++;
    
    // Model performance tracking (updated for sentiment-first)
    const model = record.primary_model || record.model || 'GPT-OSS-120B';
    if (!modelStats[model]) {
      modelStats[model] = { accuracy: 0, count: 0, type: 'sentiment' };
    }
    if (record.predicted_price && record.actual_price) {
      const accuracy = Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
      modelStats[model].accuracy += accuracy;
      modelStats[model].count++;
    }

    // Sentiment analysis tracking
    if (record.sentiment_score !== undefined) {
      totalSentimentAccuracy += record.sentiment_score * 100;
      sentimentCount++;

      if (!sentimentStats[record.symbol]) {
        sentimentStats[record.symbol] = { total: 0, count: 0, newsArticles: 0 };
      }
      sentimentStats[record.symbol].total += record.sentiment_score * 100;
      sentimentStats[record.symbol].count++;
      sentimentStats[record.symbol].newsArticles += record.news_articles || 0;
    }

    // Neural agreement tracking
    if (record.neural_agreement) {
      const agreementValue = record.neural_agreement === 'AGREE' ? 100 : 0;
      totalNeuralAgreement += agreementValue;
      agreementCount++;

      if (!neuralAgreementStats[record.symbol]) {
        neuralAgreementStats[record.symbol] = { agreements: 0, total: 0 };
      }
      neuralAgreementStats[record.symbol].total++;
      if (record.neural_agreement === 'AGREE') {
        neuralAgreementStats[record.symbol].agreements++;
      }
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
  
  // Find best performing model (sentiment-first approach)
  let bestModel = 'GPT-OSS-120B';
  let bestAccuracy = 0;
  Object.entries(modelStats).forEach(([model, stats]) => {
    if (stats.count > 0) {
      const avgAccuracy = stats.accuracy / stats.count;
      if (avgAccuracy > bestAccuracy) {
        bestAccuracy = avgAccuracy;
        bestModel = model;
        modelStats[model].accuracy = avgAccuracy;
      }
    }
  });

  // Ensure GPT-OSS-120B is shown as primary even if not best performer
  if (!modelStats['GPT-OSS-120B']) {
    bestModel = 'GPT-OSS-120B (Primary)';
  }
  
  // Calculate symbol-level stats (enhanced for sentiment-first)
  Object.keys(symbolStats).forEach(symbol => {
    const symbolPredictions = recentPredictions.filter(r => r.symbol === symbol);
    let symbolPriceAcc = 0;
    let symbolDirAcc = 0;
    let symbolSentAcc = 0;
    let symbolNewsCount = 0;
    let pCount = 0;
    let dCount = 0;
    let sCount = 0;

    symbolPredictions.forEach(record => {
      if (record.predicted_price && record.actual_price) {
        symbolPriceAcc += Math.max(0, 100 - Math.abs((record.predicted_price - record.actual_price) / record.actual_price * 100));
        pCount++;
      }
      if (record.direction_correct !== undefined) {
        symbolDirAcc += record.direction_correct ? 100 : 0;
        dCount++;
      }
      if (record.sentiment_score !== undefined) {
        symbolSentAcc += record.sentiment_score * 100;
        symbolNewsCount += record.news_articles || 0;
        sCount++;
      }
    });

    symbolStats[symbol].priceAccuracy = pCount > 0 ? symbolPriceAcc / pCount : 0;
    symbolStats[symbol].directionAccuracy = dCount > 0 ? symbolDirAcc / dCount : 0;
    symbolStats[symbol].sentimentAccuracy = sCount > 0 ? symbolSentAcc / sCount : 0;
    symbolStats[symbol].avgNewsArticles = sCount > 0 ? symbolNewsCount / sCount : 0;

    // Calculate neural agreement rate for this symbol
    if (neuralAgreementStats[symbol]) {
      const agreeStats = neuralAgreementStats[symbol];
      symbolStats[symbol].neuralAgreementRate = agreeStats.total > 0 ?
        (agreeStats.agreements / agreeStats.total) * 100 : 0;
    }
  });
  
  return {
    overview: {
      overallAccuracy: priceCount > 0 ? totalPriceAccuracy / priceCount : 0,
      directionAccuracy: directionCount > 0 ? totalDirectionAccuracy / directionCount : 0,
      sentimentAccuracy: sentimentCount > 0 ? totalSentimentAccuracy / sentimentCount : 0,
      neuralAgreementRate: agreementCount > 0 ? totalNeuralAgreement / agreementCount : 0,
      totalPredictions: recentPredictions.length,
      bestModel: bestModel,
      primaryModel: 'GPT-OSS-120B'
    },
    dailyAccuracy: dailyAccuracy,
    modelPerformance: modelStats,
    predictions: recentPredictions.map(record => ({
      date: record.date,
      symbol: record.symbol,
      model: record.primary_model || record.model || 'GPT-OSS-120B',
      predicted_price: record.predicted_price,
      actual_price: record.actual_price,
      direction: record.direction_prediction,
      direction_correct: record.direction_correct,
      confidence: record.primary_confidence || record.confidence,
      sentiment_score: record.sentiment_score,
      neural_agreement: record.neural_agreement,
      news_articles: record.news_articles,
      enhancement_method: record.enhancement_method
    })),
    symbolBreakdown: symbolStats
  };
}