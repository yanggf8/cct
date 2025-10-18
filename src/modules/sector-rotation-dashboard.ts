/**
 * Sector Rotation Dashboard Module
 * Comprehensive Sector Rotation Analysis page
 * Displays 11 SPDR ETFs with live data, technical indicators, and rotation signals
 */

interface Env {
  TRADING_RESULTS: KVNamespace;
  TRAINED_MODELS: R2Bucket;
  ENHANCED_MODELS: R2Bucket;
  AI: any;
  WORKER_VERSION?: string;
  TRADING_SYMBOLS?: string;
  LOG_LEVEL?: string;
  TIMEZONE?: string;
}

/**
 * Serve the Sector Rotation Dashboard HTML page
 */
export async function handleSectorRotationDashboardPage(request: Request, env: Env): Promise<Response> {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sector Rotation Analysis - Market Intelligence Platform</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* Header */
        .page-header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-bottom: 2px solid #4facfe;
            padding: 20px;
            text-align: center;
            position: relative;
        }

        .page-title {
            font-size: 2.5rem;
            font-weight: bold;
            color: #4facfe;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .page-subtitle {
            font-size: 1.1rem;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 20px;
        }

        .back-nav {
            position: absolute;
            left: 20px;
            top: 20px;
            color: #4facfe;
            text-decoration: none;
            font-size: 1rem;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: color 0.3s ease;
        }

        .back-nav:hover {
            color: #00f2fe;
            text-decoration: none;
        }

        /* Controls */
        .controls {
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 15px;
            padding: 20px;
            margin: 20px;
            backdrop-filter: blur(10px);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }

        .control-group {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .btn {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            border: none;
            color: #000;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(79, 172, 254, 0.4);
            text-decoration: none;
            color: #000;
        }

        .btn-secondary {
            background: rgba(79, 172, 254, 0.2);
            border: 1px solid #4facfe;
            color: #4facfe;
        }

        .btn-secondary:hover {
            background: rgba(79, 172, 254, 0.3);
            color: #00f2fe;
        }

        /* Status indicators */
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid rgba(0, 255, 136, 0.3);
            border-radius: 20px;
            font-size: 0.9rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff88;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Main Content */
        .main-content {
            padding: 0 20px 20px;
        }

        /* Summary Cards */
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .summary-card {
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }

        .summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(79, 172, 254, 0.2);
        }

        .summary-value {
            font-size: 2rem;
            font-weight: bold;
            color: #4facfe;
            margin-bottom: 5px;
        }

        .summary-label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
        }

        /* Sector Grid */
        .sectors-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .sector-card {
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .sector-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(79, 172, 254, 0.2);
        }

        .sector-card.bullish {
            border-color: rgba(0, 255, 136, 0.5);
            background: linear-gradient(135deg, rgba(0, 255, 136, 0.1) 0%, rgba(26, 26, 46, 0.8) 100%);
        }

        .sector-card.bearish {
            border-color: rgba(255, 71, 87, 0.5);
            background: linear-gradient(135deg, rgba(255, 71, 87, 0.1) 0%, rgba(26, 26, 46, 0.8) 100%);
        }

        .sector-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
        }

        .sector-title {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .sector-symbol {
            font-size: 1.5rem;
            font-weight: bold;
            color: #4facfe;
        }

        .sector-name {
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9rem;
        }

        .sector-signal {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .signal-bullish {
            background: rgba(0, 255, 136, 0.2);
            color: #00ff88;
        }

        .signal-bearish {
            background: rgba(255, 71, 87, 0.2);
            color: #ff4757;
        }

        .signal-neutral {
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        .sector-metrics {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 15px;
        }

        .metric {
            text-align: center;
        }

        .metric-value {
            font-size: 1.2rem;
            font-weight: bold;
            color: #4facfe;
        }

        .metric-label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.8rem;
        }

        .positive { color: #00ff88; }
        .negative { color: #ff4757; }

        /* Indicators */
        .indicators {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .indicator {
            flex: 1;
            text-align: center;
            padding: 8px;
            background: rgba(79, 172, 254, 0.1);
            border-radius: 8px;
        }

        .indicator-name {
            font-size: 0.7rem;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 4px;
        }

        .indicator-value {
            font-size: 0.9rem;
            font-weight: 600;
        }

        /* Chart Section */
        .chart-section {
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            margin-bottom: 30px;
        }

        .chart-container {
            height: 400px;
            position: relative;
        }

        /* Loading State */
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 1.1rem;
        }

        .error {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: #ff4757;
            background: rgba(255, 71, 87, 0.1);
            border-radius: 10px;
            border: 1px solid rgba(255, 71, 87, 0.3);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .page-title {
                font-size: 1.8rem;
            }

            .controls {
                flex-direction: column;
                align-items: stretch;
            }

            .control-group {
                justify-content: center;
            }

            .sectors-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <!-- Page Header -->
    <header class="page-header">
        <a href="/" class="back-nav">← Back to Dashboard</a>
        <div>
            <h1 class="page-title">🔄 Sector Rotation Analysis</h1>
            <p class="page-subtitle">Real-time analysis of 11 SPDR ETFs with institutional-grade money flow tracking</p>
        </div>
    </header>

    <!-- Controls -->
    <div class="controls">
        <div class="control-group">
            <button class="btn" onclick="refreshAllData()">
                🔄 Refresh Data
            </button>
            <button class="btn btn-secondary" onclick="runAnalysis()">
                📊 Run Analysis
            </button>
        </div>

        <div class="control-group">
            <div class="status-indicator">
                <div class="status-dot"></div>
                <span id="connection-status">Connected</span>
            </div>
            <span id="last-update" style="color: rgba(255, 255, 255, 0.6); font-size: 0.9rem;">
                Never updated
            </span>
        </div>
    </div>

    <!-- Main Content -->
    <main class="main-content">
        <!-- Summary Cards -->
        <div class="summary-grid" id="summary-grid">
            <div class="summary-card">
                <div class="summary-value" id="total-sectors">11</div>
                <div class="summary-label">Total Sectors</div>
            </div>
            <div class="summary-card">
                <div class="summary-value positive" id="bullish-sectors">0</div>
                <div class="summary-label">Bullish Sectors</div>
            </div>
            <div class="summary-card">
                <div class="summary-value negative" id="bearish-sectors">0</div>
                <div class="summary-label">Bearish Sectors</div>
            </div>
            <div class="summary-card">
                <div class="summary-value" id="top-performer">-</div>
                <div class="summary-label">Top Performer</div>
            </div>
        </div>

        <!-- Rotation Chart -->
        <div class="chart-section">
            <h2 style="color: #4facfe; margin-bottom: 20px; font-size: 1.3rem;">Sector Performance Chart</h2>
            <div class="chart-container">
                <canvas id="sectorChart"></canvas>
            </div>
        </div>

        <!-- Sectors Grid -->
        <div class="sectors-grid" id="sectors-grid">
            <div class="loading">Loading sector data...</div>
        </div>
    </main>

    <script>
        // Global variables
        let sectorChart = null;
        let currentSectorData = null;

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeSectorChart();
            loadSectorData();

            // Auto-refresh every 5 minutes
            setInterval(loadSectorData, 300000);
        });

        // Initialize sector performance chart
        function initializeSectorChart() {
            const ctx = document.getElementById('sectorChart').getContext('2d');
            sectorChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Daily Change %',
                        data: [],
                        backgroundColor: [],
                        borderColor: [],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#4facfe',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    const value = context.parsed.y;
                                    return value >= 0 ? \`+\${value.toFixed(2)}%\` : \`\${value.toFixed(2)}%\`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.8)',
                                font: { size: 11 }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.8)',
                                font: { size: 11 },
                                callback: function(value) {
                                    return value >= 0 ? \`+\${value}%\` : \`\${value}%\`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Load sector data from API
        async function loadSectorData() {
            try {
                updateConnectionStatus('Loading...', true);

                const response = await window.cctApi.getSectorSnapshot();

                if (response.success && response.data) {
                    currentSectorData = response.data;
                    updateDashboard(response.data);
                    updateConnectionStatus('Connected', false);
                    updateLastRefresh();
                } else {
                    throw new Error(response.message || 'Invalid response from API');
                }
            } catch (error) {
                console.error('Error loading sector data:', error);
                showError('Failed to load sector data. Please try again.');
                updateConnectionStatus('Error', false);
            }
        }

        // Update dashboard with sector data
        function updateDashboard(data) {
            // Update summary cards
            updateSummaryCards(data.summary);

            // Update sector cards
            updateSectorCards(data.sectors);

            // Update chart
            updateSectorChart(data.sectors);
        }

        // Update summary cards
        function updateSummaryCards(summary) {
            if (summary) {
                document.getElementById('bullish-sectors').textContent = summary.bullishSectors || 0;
                document.getElementById('bearish-sectors').textContent = summary.bearishSectors || 0;
                document.getElementById('top-performer').textContent = summary.topPerformer || '-';
            }
        }

        // Update sector cards
        function updateSectorCards(sectors) {
            const grid = document.getElementById('sectors-grid');

            if (!sectors || sectors.length === 0) {
                grid.innerHTML = '<div class="error">No sector data available</div>';
                return;
            }

            // Sort sectors by performance
            const sortedSectors = [...sectors].sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));

            const cardsHtml = sortedSectors.map(sector => {
                const changePercent = sector.changePercent || 0;
                const price = sector.price || 0;
                const volume = sector.volume || 0;
                const indicators = sector.indicators || {};

                // Determine signal based on indicators and performance
                let signal = 'neutral';
                let signalClass = 'signal-neutral';

                if (changePercent > 1.0) {
                    signal = 'bullish';
                    signalClass = 'signal-bullish';
                } else if (changePercent < -1.0) {
                    signal = 'bearish';
                    signalClass = 'signal-bearish';
                }

                // Format volume
                const volumeFormatted = volume > 1000000 ?
                    (volume / 1000000).toFixed(1) + 'M' :
                    volume > 1000 ? (volume / 1000).toFixed(1) + 'K' : volume.toString();

                return \`
                    <div class="sector-card \${signal === 'bullish' ? 'bullish' : signal === 'bearish' ? 'bearish' : ''}">
                        <div class="sector-header">
                            <div class="sector-title">
                                <div class="sector-symbol">\${sector.symbol}</div>
                                <div class="sector-name">\${sector.name}</div>
                            </div>
                            <div class="sector-signal \${signalClass}">\${signal}</div>
                        </div>

                        <div class="sector-metrics">
                            <div class="metric">
                                <div class="metric-value \${changePercent >= 0 ? 'positive' : 'negative'}">
                                    \${changePercent >= 0 ? '+' : ''}\${changePercent.toFixed(2)}%
                                </div>
                                <div class="metric-label">Daily Change</div>
                            </div>
                            <div class="metric">
                                <div class="metric-value">$\${price.toFixed(2)}</div>
                                <div class="metric-label">Current Price</div>
                            </div>
                            <div class="metric">
                                <div class="metric-value">\${volumeFormatted}</div>
                                <div class="metric-label">Volume</div>
                            </div>
                            <div class="metric">
                                <div class="metric-value" id="rs-\${sector.symbol}">-</div>
                                <div class="metric-label">Rel. Strength</div>
                            </div>
                        </div>

                        \${indicators.obv || indicators.cmf || indicators.relativeStrength ? \`
                            <div class="indicators">
                                \${indicators.obv ? \`
                                    <div class="indicator">
                                        <div class="indicator-name">OBV</div>
                                        <div class="indicator-value">\${indicators.obv.trend || 'N/A'}</div>
                                    </div>
                                \` : ''}
                                \${indicators.cmf ? \`
                                    <div class="indicator">
                                        <div class="indicator-name">CMF</div>
                                        <div class="indicator-value">\${indicators.cmf.signal || 'N/A'}</div>
                                    </div>
                                \` : ''}
                                \${indicators.relativeStrength ? \`
                                    <div class="indicator">
                                        <div class="indicator-name">RS</div>
                                        <div class="indicator-value">\${indicators.relativeStrength.trend || 'N/A'}</div>
                                    </div>
                                \` : ''}
                            </div>
                        \` : ''}
                    </div>
                \`;
            }).join('');

            grid.innerHTML = cardsHtml;

            // Update relative strength values with delay for animation
            setTimeout(() => {
                sectors.forEach(sector => {
                    if (sector.indicators && sector.indicators.relativeStrength) {
                        const rsElement = document.getElementById(\`rs-\${sector.symbol}\`);
                        if (rsElement) {
                            const rs = sector.indicators.relativeStrength.value || 0;
                            rsElement.textContent = rs.toFixed(2);
                            rsElement.className = \`metric-value \${rs > 1.0 ? 'positive' : rs < 1.0 ? 'negative' : ''}\`;
                        }
                    }
                });
            }, 500);
        }

        // Update sector chart
        function updateSectorChart(sectors) {
            if (!sectorChart || !sectors || sectors.length === 0) return;

            const labels = sectors.map(s => s.symbol);
            const data = sectors.map(s => s.changePercent || 0);
            const colors = data.map(value =>
                value >= 0 ? 'rgba(0, 255, 136, 0.8)' : 'rgba(255, 71, 87, 0.8)'
            );
            const borderColors = data.map(value =>
                value >= 0 ? 'rgba(0, 255, 136, 1)' : 'rgba(255, 71, 87, 1)'
            );

            sectorChart.data.labels = labels;
            sectorChart.data.datasets[0].data = data;
            sectorChart.data.datasets[0].backgroundColor = colors;
            sectorChart.data.datasets[0].borderColor = borderColors;
            sectorChart.update('active');
        }

        // Refresh all data
        async function refreshAllData() {
            await loadSectorData();
        }

        // Run comprehensive analysis
        async function runAnalysis() {
            try {
                const response = await window.cctApi.request('/api/v1/sector-rotation/analysis', {
                    method: 'POST'
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // Wait a moment then refresh data
                        setTimeout(loadSectorData, 2000);
                    }
                }
            } catch (error) {
                console.error('Error running analysis:', error);
            }
        }

        // Update connection status
        function updateConnectionStatus(status, isLoading) {
            const statusElement = document.getElementById('connection-status');
            const statusDot = document.querySelector('.status-dot');

            statusElement.textContent = status;

            if (isLoading) {
                statusDot.style.background = '#ffc107';
                statusDot.style.animation = 'pulse 1s infinite';
            } else if (status === 'Connected') {
                statusDot.style.background = '#00ff88';
                statusDot.style.animation = 'pulse 2s infinite';
            } else {
                statusDot.style.background = '#ff4757';
                statusDot.style.animation = 'none';
            }
        }

        // Update last refresh time
        function updateLastRefresh() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            document.getElementById('last-update').textContent = \`Last updated: \${timeString}\`;
        }

        // Show error message
        function showError(message) {
            const grid = document.getElementById('sectors-grid');
            grid.innerHTML = \`<div class="error">\${message}</div>\`;
        }
    </script>
    <script src="/js/api-client.js?v=20251018-2"></script>
    <script src="/js/api-cache.js?v=20251018-2"></script>
</body>
</html>`;

  try {
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300', // 5 minute cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('Error serving sector rotation dashboard:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: 'Failed to load sector rotation dashboard'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}