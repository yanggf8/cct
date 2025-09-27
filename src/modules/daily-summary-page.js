/**
 * Daily Summary Page Module
 * Handles serving the daily summary HTML page
 */

/**
 * Handle daily summary page requests
 */
export async function handleDailySummaryPage(request, env) {
  try {
    // In Cloudflare Workers, we'll embed the HTML directly
    // This is the same pattern used by weekly-analysis.js
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Analysis Summary - TFT Trading System</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ffffff;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 30px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .header h1 {
            font-size: 2.8rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 20px;
        }

        .date-navigation {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-top: 20px;
        }

        .date-picker {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 8px 12px;
            color: #ffffff;
            font-size: 1rem;
        }

        .nav-button {
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.3s ease;
        }

        .nav-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3);
        }

        .nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
        }

        .stat-card h3 {
            font-size: 1.1rem;
            margin-bottom: 10px;
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .stat-card .value {
            font-size: 2.5rem;
            font-weight: bold;
            color: #00f2fe;
            margin-bottom: 5px;
        }

        .stat-card .label {
            font-size: 0.9rem;
            opacity: 0.7;
        }

        .charts-section {
            display: grid;
            grid-template-columns: 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }

        .chart-container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .chart-container h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            text-align: center;
            color: #4facfe;
        }

        .chart-wrapper {
            position: relative;
            height: 400px;
            margin-bottom: 20px;
        }

        .symbol-analysis {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 30px;
        }

        .symbol-analysis h2 {
            margin-bottom: 20px;
            font-size: 1.5rem;
            color: #4facfe;
            text-align: center;
        }

        .symbol-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }

        .symbol-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: transform 0.3s ease;
        }

        .symbol-card:hover {
            transform: translateY(-3px);
            background: rgba(255, 255, 255, 0.08);
        }

        .symbol-card h4 {
            color: #4facfe;
            margin-bottom: 15px;
            font-size: 1.3rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .prediction-section {
            margin-bottom: 15px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            border-left: 3px solid #4facfe;
        }

        .prediction-section h5 {
            color: #00f2fe;
            margin-bottom: 8px;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .prediction-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 0.9rem;
        }

        .prediction-row .label {
            opacity: 0.8;
        }

        .prediction-row .value {
            font-weight: 600;
            color: #ffffff;
        }

        .confidence-bar {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            margin: 8px 0;
            overflow: hidden;
        }

        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff6b6b 0%, #feca57 50%, #48dbfb 100%);
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .conflict-indicator {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .conflict-indicator.conflict {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
        }

        .conflict-indicator.aligned {
            background: rgba(72, 219, 251, 0.2);
            color: #48dbfb;
        }

        .loading {
            text-align: center;
            padding: 40px;
            font-size: 1.1rem;
            opacity: 0.8;
        }

        .error {
            text-align: center;
            padding: 40px;
            background: rgba(255, 0, 0, 0.1);
            border-radius: 15px;
            border: 1px solid rgba(255, 0, 0, 0.3);
            color: #ff6b6b;
        }

        .refresh-button {
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            margin: 20px auto;
            display: block;
            transition: all 0.3s ease;
        }

        .refresh-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3);
        }

        .weekly-link {
            text-align: center;
            margin-top: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .weekly-link a {
            color: #4facfe;
            text-decoration: none;
            font-weight: 600;
            font-size: 1.1rem;
            transition: color 0.3s ease;
        }

        .weekly-link a:hover {
            color: #00f2fe;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }

            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .stat-card .value {
                font-size: 2rem;
            }

            .chart-wrapper {
                height: 300px;
            }

            .symbol-grid {
                grid-template-columns: 1fr;
            }

            .date-navigation {
                flex-direction: column;
                gap: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Trading Analysis</h1>
            <p>Comprehensive daily sentiment analysis and prediction tracking</p>

            <div class="date-navigation">
                <button class="nav-button" id="prev-day" onclick="navigateDate(-1)">← Previous Day</button>
                <input type="date" id="date-picker" class="date-picker" onchange="loadDataForDate()">
                <button class="nav-button" id="next-day" onclick="navigateDate(1)">Next Day →</button>
                <button class="refresh-button" onclick="loadData()">🔄 Refresh</button>
            </div>
        </div>

        <div id="loading" class="loading">
            Loading daily analysis data...
        </div>

        <div id="error" class="error" style="display: none;">
            <h3>⚠️ Error Loading Data</h3>
            <p id="error-message"></p>
            <button class="refresh-button" onclick="loadData()">Try Again</button>
        </div>

        <div id="content" style="display: none;">
            <!-- Stats Overview -->
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Daily Accuracy</h3>
                    <div class="value" id="daily-accuracy">-</div>
                    <div class="label">Predictions Correct</div>
                </div>
                <div class="stat-card">
                    <h3>Total Predictions</h3>
                    <div class="value" id="total-predictions">-</div>
                    <div class="label">Symbols Analyzed</div>
                </div>
                <div class="stat-card">
                    <h3>Average Confidence</h3>
                    <div class="value" id="average-confidence">-</div>
                    <div class="label">AI Confidence</div>
                </div>
                <div class="stat-card">
                    <h3>Conflicts Detected</h3>
                    <div class="value" id="conflicts-count">-</div>
                    <div class="label">AI vs Technical</div>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="charts-section">
                <div class="chart-container">
                    <h2>📈 Confidence Trend Analysis</h2>
                    <div class="chart-wrapper">
                        <canvas id="confidenceChart"></canvas>
                    </div>
                </div>

                <div class="chart-container">
                    <h2>⚖️ Conflict Analysis</h2>
                    <div class="chart-wrapper">
                        <canvas id="conflictChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Symbol Analysis -->
            <div class="symbol-analysis">
                <h2>🔍 Detailed Symbol Analysis</h2>
                <div id="symbol-breakdown" class="symbol-grid">
                    <!-- Dynamic content -->
                </div>
            </div>

            <!-- Weekly Analysis Link -->
            <div class="weekly-link">
                <p>📊 View broader trends and weekly performance analysis</p>
                <a href="/weekly-analysis">Go to Weekly Analysis Dashboard →</a>
            </div>
        </div>
    </div>

    <script>
        let confidenceChart, conflictChart;
        let currentDate = null;

        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            initializeDatePicker();
            loadData();
        });

        function initializeDatePicker() {
            const datePicker = document.getElementById('date-picker');
            const today = new Date().toISOString().split('T')[0];
            datePicker.value = today;
            datePicker.max = today; // Don't allow future dates
            currentDate = today;
        }

        function navigateDate(direction) {
            const datePicker = document.getElementById('date-picker');
            const current = new Date(datePicker.value);
            current.setDate(current.getDate() + direction);

            const today = new Date().toISOString().split('T')[0];
            const newDate = current.toISOString().split('T')[0];

            // Don't allow future dates
            if (newDate <= today) {
                datePicker.value = newDate;
                loadDataForDate();
            }
        }

        function loadDataForDate() {
            const datePicker = document.getElementById('date-picker');
            currentDate = datePicker.value;
            loadData();

            // Update navigation buttons
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('next-day').disabled = (currentDate >= today);
        }

        async function loadData() {
            try {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('error').style.display = 'none';
                document.getElementById('content').style.display = 'none';

                // Fetch daily summary data from the API
                const apiUrl = currentDate ?
                    '/api/daily-summary?date=' + currentDate :
                    '/api/daily-summary';

                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }

                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'API returned error');
                }

                const data = result.data;

                // Update page title with date
                if (data.display_date) {
                    document.querySelector('.header h1').textContent = '📊 Daily Analysis - ' + data.display_date;
                }

                // Update overview stats
                updateOverviewStats(data.summary);

                // Create charts
                createConfidenceChart(data.charts_data.confidence_trend || []);
                createConflictChart(data.charts_data.conflict_analysis || []);

                // Update symbol breakdown
                updateSymbolBreakdown(data.symbols || []);

                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';

            } catch (error) {
                console.error('Error loading daily data:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('error-message').textContent = error.message;
            }
        }

        function updateOverviewStats(summary) {
            document.getElementById('daily-accuracy').textContent =
                summary.overall_accuracy ? Math.round(summary.overall_accuracy * 100) + '%' : '-';

            document.getElementById('total-predictions').textContent =
                summary.total_predictions || '0';

            document.getElementById('average-confidence').textContent =
                summary.average_confidence ? Math.round(summary.average_confidence * 100) + '%' : '-';

            document.getElementById('conflicts-count').textContent =
                summary.major_conflicts ? summary.major_conflicts.length : '0';
        }

        function createConfidenceChart(confidenceData) {
            const ctx = document.getElementById('confidenceChart').getContext('2d');

            if (confidenceChart) {
                confidenceChart.destroy();
            }

            const symbols = confidenceData.map(function(d) { return d.symbol; });
            const morningConf = confidenceData.map(function(d) { return (d.morning || 0) * 100; });
            const middayAI = confidenceData.map(function(d) { return (d.midday_ai || 0) * 100; });
            const middayTech = confidenceData.map(function(d) { return (d.midday_technical || 0) * 100; });

            confidenceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: symbols,
                    datasets: [{
                        label: 'Morning Prediction (%)',
                        data: morningConf,
                        backgroundColor: 'rgba(79, 172, 254, 0.8)',
                        borderColor: '#4facfe',
                        borderWidth: 1
                    }, {
                        label: 'Midday AI (%)',
                        data: middayAI,
                        backgroundColor: 'rgba(0, 242, 254, 0.8)',
                        borderColor: '#00f2fe',
                        borderWidth: 1
                    }, {
                        label: 'Midday Technical (%)',
                        data: middayTech,
                        backgroundColor: 'rgba(255, 107, 107, 0.8)',
                        borderColor: '#ff6b6b',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            min: 0,
                            max: 100
                        }
                    }
                }
            });
        }

        function createConflictChart(conflictData) {
            const ctx = document.getElementById('conflictChart').getContext('2d');

            if (conflictChart) {
                conflictChart.destroy();
            }

            if (conflictData.length === 0) {
                // Show "No conflicts" message
                ctx.fillStyle = '#ffffff';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('No conflicts detected today', ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }

            const symbols = conflictData.map(function(d) { return d.symbol; });
            const differences = conflictData.map(function(d) { return (d.difference || 0) * 100; });
            const colors = conflictData.map(function(d) {
                const severity = d.severity || 'none';
                switch (severity) {
                    case 'high': return 'rgba(255, 107, 107, 0.8)';
                    case 'moderate': return 'rgba(254, 202, 87, 0.8)';
                    default: return 'rgba(72, 219, 251, 0.8)';
                }
            });

            conflictChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: symbols,
                    datasets: [{
                        label: 'Confidence Difference (%)',
                        data: differences,
                        backgroundColor: colors,
                        borderColor: colors.map(function(c) { return c.replace('0.8', '1'); }),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            min: 0,
                            max: 50
                        }
                    }
                }
            });
        }

        function updateSymbolBreakdown(symbols) {
            const container = document.getElementById('symbol-breakdown');
            container.innerHTML = '';

            if (symbols.length === 0) {
                container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No symbol data available for this date.</p>';
                return;
            }

            symbols.forEach(function(symbol) {
                const card = document.createElement('div');
                card.className = 'symbol-card';

                const directionEmoji = getDirectionEmoji(symbol.morning_prediction ? symbol.morning_prediction.direction : null);
                const sentimentEmoji = getSentimentEmoji(symbol.morning_prediction ? symbol.morning_prediction.sentiment : null);

                card.innerHTML = '<h4>' + symbol.symbol + ' ' + directionEmoji + '</h4>' +

                    '<div class="prediction-section">' +
                        '<h5>🌅 Morning Prediction</h5>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Direction:</span>' +
                            '<span class="value">' + (symbol.morning_prediction ? symbol.morning_prediction.direction || 'N/A' : 'N/A') + '</span>' +
                        '</div>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Sentiment:</span>' +
                            '<span class="value">' + sentimentEmoji + ' ' + (symbol.morning_prediction ? symbol.morning_prediction.sentiment || 'N/A' : 'N/A') + '</span>' +
                        '</div>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Confidence:</span>' +
                            '<span class="value">' + Math.round((symbol.morning_prediction ? symbol.morning_prediction.confidence || 0 : 0) * 100) + '%</span>' +
                        '</div>' +
                        '<div class="confidence-bar">' +
                            '<div class="confidence-fill" style="width: ' + ((symbol.morning_prediction ? symbol.morning_prediction.confidence || 0 : 0) * 100) + '%"></div>' +
                        '</div>' +
                    '</div>' +

                    '<div class="prediction-section">' +
                        '<h5>🔄 Midday Update</h5>' +
                        '<div class="prediction-row">' +
                            '<span class="label">AI Confidence:</span>' +
                            '<span class="value">' + Math.round((symbol.midday_update ? symbol.midday_update.ai_confidence || 0 : 0) * 100) + '%</span>' +
                        '</div>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Technical:</span>' +
                            '<span class="value">' + Math.round((symbol.midday_update ? symbol.midday_update.technical_confidence || 0 : 0) * 100) + '%</span>' +
                        '</div>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Status:</span>' +
                            '<span class="value">' +
                                '<span class="conflict-indicator ' + (symbol.midday_update && symbol.midday_update.conflict ? 'conflict' : 'aligned') + '">' +
                                    (symbol.midday_update && symbol.midday_update.conflict ? '⚠️ Conflict' : '✅ Aligned') +
                                '</span>' +
                            '</span>' +
                        '</div>' +
                    '</div>' +

                    '<div class="prediction-section">' +
                        '<h5>🌅 Next Day Outlook</h5>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Direction:</span>' +
                            '<span class="value">' + (symbol.next_day_outlook ? symbol.next_day_outlook.direction || 'N/A' : 'N/A') + '</span>' +
                        '</div>' +
                        '<div class="prediction-row">' +
                            '<span class="label">Confidence:</span>' +
                            '<span class="value">' + Math.round((symbol.next_day_outlook ? symbol.next_day_outlook.confidence || 0 : 0) * 100) + '%</span>' +
                        '</div>' +
                    '</div>';

                container.appendChild(card);
            });
        }

        function getDirectionEmoji(direction) {
            if (!direction) return '❓';
            switch (direction.toUpperCase()) {
                case 'BULLISH':
                case 'UP': return '↗️';
                case 'BEARISH':
                case 'DOWN': return '↘️';
                case 'NEUTRAL':
                case 'FLAT': return '➡️';
                default: return '❓';
            }
        }

        function getSentimentEmoji(sentiment) {
            if (!sentiment) return '❓';
            switch (sentiment.toLowerCase()) {
                case 'bullish': return '🔥';
                case 'bearish': return '🧊';
                case 'neutral': return '⚖️';
                default: return '❓';
            }
        }
    </script>
</body>
</html>`;

    return new Response(htmlContent, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('Error serving daily summary page:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}