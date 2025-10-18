/**
 * Predictive Analytics Dashboard Handler
 * Serves the enterprise-grade predictive analytics dashboard with AI capabilities
 */

import { createRequestLogger } from './logging.js';

/**
 * Serve the Predictive Analytics Dashboard HTML page
 */
export async function servePredictiveAnalyticsDashboard(request, env) {
  const requestLogger = createRequestLogger('dashboard');
  const startTime = Date.now();

  try {
    // Dashboard HTML content with enterprise-grade UI
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Predictive Analytics Dashboard - Enterprise Trading Intelligence</title>

    <!-- External Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/date-fns@2.30.0/index.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/luxon@3.4.3/build/global/luxon.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1.3.1/dist/chartjs-adapter-luxon.umd.min.js"></script>

    <!-- API Client -->
    <script src="/js/api-client.js?v=20251018-2"></script>
    <script src="/js/api-cache.js?v=20251018-2"></script>

    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            --warning-gradient: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            --danger-gradient: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            --dark-bg: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            --card-bg: rgba(255, 255, 255, 0.08);
            --card-border: rgba(255, 255, 255, 0.12);
            --text-primary: #ffffff;
            --text-secondary: rgba(255, 255, 255, 0.8);
            --text-muted: rgba(255, 255, 255, 0.6);
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--dark-bg);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }

        .dashboard-container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 20px;
        }

        /* Header Styles */
        .dashboard-header {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .dashboard-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--primary-gradient);
        }

        .dashboard-title {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .dashboard-subtitle {
            font-size: 1.1rem;
            color: var(--text-secondary);
            margin-bottom: 25px;
        }

        .controls-bar {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(255, 255, 255, 0.05);
            padding: 8px 16px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .control-group label {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .control-group input, .control-group select {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: var(--text-primary);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.9rem;
        }

        .btn {
            background: var(--primary-gradient);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 600;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.3);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn-success {
            background: var(--success-gradient);
        }

        .btn-warning {
            background: var(--warning-gradient);
        }

        /* Widget Grid */
        .widgets-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
        }

        .widget {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            border-radius: 20px;
            padding: 25px;
            transition: all 0.3s ease;
            position: relative;
        }

        .widget:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .widget-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .widget-icon {
            font-size: 1.5rem;
        }

        .widget-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;
            padding: 4px 12px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.1);
        }

        .status-healthy {
            color: #4facfe;
            border-color: rgba(79, 172, 254, 0.3);
        }

        .status-warning {
            color: #feca57;
            border-color: rgba(254, 202, 87, 0.3);
        }

        .status-error {
            color: #ff6b6b;
            border-color: rgba(255, 107, 107, 0.3);
        }

        /* Chart Container */
        .chart-container {
            position: relative;
            height: 300px;
            margin-bottom: 15px;
        }

        .chart-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 300px;
            background: rgba(255, 255, 255, 0.02);
            border: 2px dashed rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            color: var(--text-muted);
            font-size: 0.9rem;
        }

        /* Full-width Widget */
        .widget-full {
            grid-column: 1 / -1;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .dashboard-container {
                padding: 15px;
            }

            .dashboard-title {
                font-size: 2rem;
            }

            .widgets-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .controls-bar {
                flex-direction: column;
                align-items: stretch;
            }
        }

        /* Loading and Error States */
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top: 3px solid #4facfe;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .error-message {
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid rgba(244, 67, 54, 0.3);
            color: #ff6b6b;
            padding: 15px;
            border-radius: 12px;
            margin: 20px 0;
            text-align: center;
        }

        .hidden {
            display: none;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
            animation: fadeIn 0.6s ease-out;
        }
    </style>
</head>
<body>
    <!-- Loading Overlay -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-spinner"></div>
    </div>

    <div class="dashboard-container">
        <!-- Header -->
        <header class="dashboard-header fade-in">
            <h1 class="dashboard-title">🚀 Predictive Analytics Dashboard</h1>
            <p class="dashboard-subtitle">Enterprise-grade AI-driven market intelligence and forecasting</p>

            <div class="controls-bar">
                <div class="control-group">
                    <label for="symbolInput">Symbol:</label>
                    <input type="text" id="symbolInput" placeholder="AAPL, MSFT, GOOGL" value="AAPL,MSFT,NVDA">
                </div>

                <div class="control-group">
                    <label for="timeRange">Time Range:</label>
                    <select id="timeRange">
                        <option value="1D">1 Day</option>
                        <option value="1W" selected>1 Week</option>
                        <option value="1M">1 Month</option>
                        <option value="3M">3 Months</option>
                    </select>
                </div>

                <button class="btn btn-success" onclick="refreshAllData()">
                    <span>🔄</span> Refresh All
                </button>

                <button class="btn btn-warning" onclick="exportData()">
                    <span>📊</span> Export
                </button>

                <button class="btn" onclick="toggleAutoRefresh()">
                    <span id="autoRefreshIcon">⏸️</span> <span id="autoRefreshText">Auto-refresh: OFF</span>
                </button>
            </div>
        </header>

        <!-- Error Container -->
        <div id="errorContainer" class="error-message hidden"></div>

        <!-- Main Widgets Grid -->
        <div class="widgets-grid">
            <!-- Market Regime Widget -->
            <div class="widget fade-in">
                <div class="widget-header">
                    <h3 class="widget-title">
                        <span class="widget-icon">📈</span>
                        Market Regime Analysis
                    </h3>
                    <div class="widget-status status-healthy" id="regimeStatus">
                        <span>●</span> Live
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="regimeChart"></canvas>
                </div>
            </div>

            <!-- Sentiment Analysis Widget -->
            <div class="widget fade-in">
                <div class="widget-header">
                    <h3 class="widget-title">
                        <span class="widget-icon">🧠</span>
                        Dual AI Sentiment
                    </h3>
                    <div class="widget-status status-healthy" id="sentimentStatus">
                        <span>●</span> Live
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="sentimentChart"></canvas>
                </div>
            </div>

            <!-- Technical Analysis Widget -->
            <div class="widget fade-in">
                <div class="widget-header">
                    <h3 class="widget-title">
                        <span class="widget-icon">📊</span>
                        Technical Indicators
                    </h3>
                    <div class="widget-status status-healthy" id="technicalStatus">
                        <span>●</span> Live
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="technicalChart"></canvas>
                </div>
            </div>

            <!-- Sector Indicators Widget -->
            <div class="widget fade-in">
                <div class="widget-header">
                    <h3 class="widget-title">
                        <span class="widget-icon">💼</span>
                        Sector Rotation
                    </h3>
                    <div class="widget-status status-healthy" id="sectorStatus">
                        <span>●</span> Live
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="sectorChart"></canvas>
                </div>
            </div>

            <!-- Predictive Signals Widget -->
            <div class="widget widget-full fade-in">
                <div class="widget-header">
                    <h3 class="widget-title">
                        <span class="widget-icon">🎯</span>
                        Predictive Signals & Forecasts
                    </h3>
                    <div class="widget-status status-healthy" id="signalsStatus">
                        <span>●</span> Live
                    </div>
                </div>

                <div id="predictionsContainer">
                    <!-- Dynamic prediction cards will be populated here -->
                </div>

                <div class="chart-container">
                    <canvas id="predictionsChart"></canvas>
                </div>
            </div>

            <!-- Real-time Status Widget -->
            <div class="widget widget-full fade-in">
                <div class="widget-header">
                    <h3 class="widget-title">
                        <span class="widget-icon">⚡</span>
                        Real-time Data Status
                    </h3>
                    <div class="widget-status status-healthy" id="realtimeStatus">
                        <span>●</span> Live
                    </div>
                </div>

                <div class="chart-container">
                    <canvas id="realtimeChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Predictive Analytics Dashboard JavaScript
        class PredictiveAnalyticsDashboard {
            constructor() {
                this.charts = {};
                this.autoRefreshInterval = null;
                this.autoRefreshEnabled = false;
                this.apiCache = new Map();

                this.init();
            }

            async init() {
                console.log('🚀 Initializing Predictive Analytics Dashboard...');

                // Hide loading overlay
                setTimeout(() => {
                    document.getElementById('loadingOverlay').classList.add('hidden');
                }, 1000);

                // Initialize all charts
                await this.initializeCharts();

                // Load initial data
                await this.loadAllData();

                console.log('✅ Dashboard initialized successfully');
            }

            async initializeCharts() {
                const chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { color: '#ffffff' }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        }
                    }
                };

                // Market Regime Chart
                const regimeCtx = document.getElementById('regimeChart').getContext('2d');
                this.charts.regime = new Chart(regimeCtx, {
                    type: 'line',
                    data: {
                        labels: this.generateTimeLabels(),
                        datasets: [{
                            label: 'Market Regime',
                            data: this.generateMockData(20, 0, 100),
                            borderColor: '#4facfe',
                            backgroundColor: 'rgba(79, 172, 254, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: chartOptions
                });

                // Sentiment Chart
                const sentimentCtx = document.getElementById('sentimentChart').getContext('2d');
                this.charts.sentiment = new Chart(sentimentCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Bullish', 'Bearish', 'Neutral'],
                        datasets: [{
                            data: [65, 20, 15],
                            backgroundColor: ['#4caf50', '#f44336', '#ffc107']
                        }]
                    },
                    options: {
                        ...chartOptions,
                        scales: undefined
                    }
                });

                // Technical Chart
                const technicalCtx = document.getElementById('technicalChart').getContext('2d');
                this.charts.technical = new Chart(technicalCtx, {
                    type: 'line',
                    data: {
                        labels: this.generateTimeLabels(),
                        datasets: [{
                            label: 'RSI',
                            data: this.generateMockData(20, 30, 70),
                            borderColor: '#ff6b6b',
                            backgroundColor: 'rgba(255, 107, 107, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: chartOptions
                });

                // Sector Chart
                const sectorCtx = document.getElementById('sectorChart').getContext('2d');
                this.charts.sector = new Chart(sectorCtx, {
                    type: 'bar',
                    data: {
                        labels: ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer'],
                        datasets: [{
                            label: 'Sector Performance',
                            data: this.generateMockData(5, -10, 20),
                            backgroundColor: [
                                'rgba(79, 172, 254, 0.8)',
                                'rgba(254, 202, 87, 0.8)',
                                'rgba(76, 175, 80, 0.8)',
                                'rgba(255, 107, 107, 0.8)',
                                'rgba(156, 39, 176, 0.8)'
                            ]
                        }]
                    },
                    options: chartOptions
                });

                // Predictions Chart
                const predictionsCtx = document.getElementById('predictionsChart').getContext('2d');
                this.charts.predictions = new Chart(predictionsCtx, {
                    type: 'scatter',
                    data: {
                        datasets: [{
                            label: 'Buy Signals',
                            data: this.generateScatterData(5, 0, 10, 100, 150),
                            backgroundColor: '#4caf50'
                        }, {
                            label: 'Sell Signals',
                            data: this.generateScatterData(3, 0, 10, 80, 120),
                            backgroundColor: '#f44336'
                        }]
                    },
                    options: {
                        ...chartOptions,
                        scales: {
                            x: {
                                ...chartOptions.scales.x,
                                title: { display: true, text: 'Confidence', color: '#ffffff' }
                            },
                            y: {
                                ...chartOptions.scales.y,
                                title: { display: true, text: 'Target Price', color: '#ffffff' }
                            }
                        }
                    }
                });

                // Real-time Chart
                const realtimeCtx = document.getElementById('realtimeChart').getContext('2d');
                this.charts.realtime = new Chart(realtimeCtx, {
                    type: 'line',
                    data: {
                        labels: this.generateTimeLabels(30),
                        datasets: [{
                            label: 'API Response Time (ms)',
                            data: this.generateMockData(30, 10, 100),
                            borderColor: '#00f2fe',
                            backgroundColor: 'rgba(0, 242, 254, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: chartOptions
                });
            }

            async loadAllData() {
                console.log('📊 Loading dashboard data...');

                // Generate prediction cards
                await this.generatePredictionCards();

                // Update all charts with mock data for demonstration
                this.updateChartsWithLiveData();
            }

            async generatePredictionCards() {
                const predictions = [
                    { symbol: 'AAPL', direction: 'BULLISH', confidence: 85, target: 195, timeframe: '1W' },
                    { symbol: 'MSFT', direction: 'BULLISH', confidence: 78, target: 420, timeframe: '2W' },
                    { symbol: 'NVDA', direction: 'NEUTRAL', confidence: 65, target: 880, timeframe: '1W' }
                ];

                const container = document.getElementById('predictionsContainer');
                container.innerHTML = predictions.map(pred => \`
                    <div style="
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        padding: 15px;
                        margin-bottom: 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <strong style="font-size: 1.2rem;">\${pred.symbol}</strong>
                            <span style="
                                padding: 4px 8px;
                                border-radius: 4px;
                                margin-left: 10px;
                                font-size: 0.9rem;
                                background: \${pred.direction === 'BULLISH' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 193, 7, 0.2)'};
                                color: \${pred.direction === 'BULLISH' ? '#4caf50' : '#ffc107'};
                            ">\${pred.direction}</span>
                        </div>
                        <div style="text-align: right;">
                            <div>Confidence: <strong>\${pred.confidence}%</strong></div>
                            <div>Target: <strong>\$\${pred.target}</strong></div>
                            <div>Timeframe: <strong>\${pred.timeframe}</strong></div>
                        </div>
                    </div>
                \`).join('');
            }

            updateChartsWithLiveData() {
                // Simulate real-time updates
                setInterval(() => {
                    // Update real-time chart
                    const realtimeData = this.charts.realtime.data.datasets[0].data;
                    realtimeData.shift();
                    realtimeData.push(Math.random() * 90 + 10);

                    const realtimeLabels = this.charts.realtime.data.labels;
                    realtimeLabels.shift();
                    realtimeLabels.push(new Date().toLocaleTimeString());

                    this.charts.realtime.update('none');
                }, 2000);
            }

            generateTimeLabels(count = 20) {
                const labels = [];
                const now = new Date();
                for (let i = count - 1; i >= 0; i--) {
                    const time = new Date(now - i * 3600000);
                    labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
                return labels;
            }

            generateMockData(count, min, max) {
                return Array.from({ length: count }, () => Math.random() * (max - min) + min);
            }

            generateScatterData(count, xMin, xMax, yMin, yMax) {
                return Array.from({ length: count }, () => ({
                    x: Math.random() * (xMax - xMin) + xMin,
                    y: Math.random() * (yMax - yMin) + yMin
                }));
            }

            refresh() {
                console.log('🔄 Refreshing dashboard data...');
                this.loadAllData();
            }

            exportData() {
                console.log('📊 Exporting dashboard data...');
                // Implementation for data export
                alert('Export functionality would download dashboard data as CSV/JSON');
            }

            toggleAutoRefresh() {
                this.autoRefreshEnabled = !this.autoRefreshEnabled;

                if (this.autoRefreshEnabled) {
                    this.autoRefreshInterval = setInterval(() => {
                        this.refresh();
                    }, 30000); // Refresh every 30 seconds

                    document.getElementById('autoRefreshIcon').textContent = '▶️';
                    document.getElementById('autoRefreshText').textContent = 'Auto-refresh: ON';
                } else {
                    clearInterval(this.autoRefreshInterval);
                    document.getElementById('autoRefreshIcon').textContent = '⏸️';
                    document.getElementById('autoRefreshText').textContent = 'Auto-refresh: OFF';
                }
            }
        }

        // Global functions for button onclick handlers
        let dashboard;

        function refreshAllData() {
            dashboard.refresh();
        }

        function exportData() {
            dashboard.exportData();
        }

        function toggleAutoRefresh() {
            dashboard.toggleAutoRefresh();
        }

        // Initialize dashboard when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            dashboard = new PredictiveAnalyticsDashboard();
        });

        // Handle API errors gracefully
        window.addEventListener('error', (event) => {
            console.error('Dashboard error:', event.error);
            const errorContainer = document.getElementById('errorContainer');
            errorContainer.textContent = 'An error occurred. Please refresh the page.';
            errorContainer.classList.remove('hidden');
        });
    </script>
</body>
</html>`;

    const response = new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      }
    });

    // Log successful response
    requestLogger.logResponse(response, '/predictive-analytics', startTime);

    return response;

  } catch (error) {
    console.error('Error serving predictive analytics dashboard:', error);

    const errorResponse = new Response(JSON.stringify({
      success: false,
      error: 'Failed to load predictive analytics dashboard',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

    requestLogger.logResponse(errorResponse, '/predictive-analytics', startTime, {
      error: error.message
    });

    return errorResponse;
  }
}