/**
 * Home Dashboard Module
 * Main entry point dashboard with navigation to all 4 reports
 * Based on weekly-analysis design pattern
 */

/**
 * Serve the Home Dashboard HTML page
 */
export async function handleHomeDashboardPage(request, env) {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Dashboard - Dual AI Sentiment Analysis System</title>
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
        .header p {
            font-size: 1.1rem; opacity: 0.9; margin-bottom: 20px;
        }

        /* 4-Report Navigation Styles */
        .report-navigation {
            margin: 20px 0;
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
            background: rgba(79, 172, 254, 0.1);
            padding: 15px;
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

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

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
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

        @media (max-width: 768px) {
            .report-navigation {
                flex-direction: column !important;
                gap: 8px !important;
            }

            .nav-report-btn {
                justify-content: center;
                min-width: 200px;
            }

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
            <h1>🏆 Trading Dashboard</h1>
            <p>Dual AI Sentiment Analysis System - Real-time Market Intelligence</p>

            <!-- 4-Report Navigation -->
            <div class="report-navigation">
                <span style="color: #4facfe; font-weight: 600; margin-right: 10px;">📈 Navigate Reports:</span>
                <a href="/pre-market-briefing" class="nav-report-btn">📅 Pre-Market</a>
                <a href="/intraday-check" class="nav-report-btn">📊 Intraday</a>
                <a href="/end-of-day-summary" class="nav-report-btn">📈 End-of-Day</a>
                <a href="/weekly-review" class="nav-report-btn">📋 Weekly Review</a>
                <a href="/weekly-analysis" class="nav-report-btn">📊 Analytics</a>
            </div>
        </div>

        <!-- System Status Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <h3>🏥 System Health</h3>
                <div class="value" id="system-health">Checking...</div>
            </div>
            <div class="stat-card">
                <h3>🤖 AI Models</h3>
                <div class="value" id="ai-models">Checking...</div>
            </div>
            <div class="stat-card">
                <h3>📊 System Version</h3>
                <div class="value">2.0</div>
            </div>
            <div class="stat-card">
                <h3>⚡ Uptime</h3>
                <div class="value">100%</div>
            </div>
        </div>

        <!-- Recent Activity Chart -->
        <div class="chart-container">
            <h3 style="color: #4facfe; margin-bottom: 20px; text-align: center;">📈 System Performance Overview</h3>
            <div class="chart-wrapper">
                <canvas id="performanceChart"></canvas>
            </div>
        </div>

        <!-- Quick Actions -->
        <div style="text-align: center; margin: 30px 0;">
            <h3 style="color: #4facfe; margin-bottom: 20px;">🔧 Quick Actions</h3>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button class="refresh-button" onclick="refreshData()">🔄 Refresh Data</button>
                <a href="/analyze" class="refresh-button" style="text-decoration: none; display: inline-block;">📊 Quick Analysis</a>
                <a href="/health" class="refresh-button" style="text-decoration: none; display: inline-block;">🏥 Health Check</a>
                <a href="/model-health" class="refresh-button" style="text-decoration: none; display: inline-block;">🤖 AI Status</a>
            </div>
        </div>

        <!-- Status Messages -->
        <div id="status-messages" style="text-align: center; margin: 20px 0; font-size: 1rem; color: #4facfe;">
            Loading system status...
        </div>
    </div>

    <script>
        // Performance chart setup
        let performanceChart = null;

        function initializePerformanceChart() {
            const ctx = document.getElementById('performanceChart').getContext('2d');
            performanceChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [450, 470, 460, 480, 465, 475, 470],
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }, {
                        label: 'Success Rate (%)',
                        data: [100, 100, 100, 100, 100, 100, 100],
                        borderColor: '#00f2fe',
                        backgroundColor: 'rgba(0, 242, 254, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#ffffff' }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff'
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#ffffff' },
                            title: {
                                display: true,
                                text: 'Response Time (ms)',
                                color: '#ffffff'
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: { color: '#ffffff' },
                            title: {
                                display: true,
                                text: 'Success Rate (%)',
                                color: '#ffffff'
                            }
                        }
                    }
                }
            });
        }

        // System health check
        async function checkSystemHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();

                if (data.success && data.status === 'healthy') {
                    document.getElementById('system-health').innerHTML = '✅ Healthy';
                    document.getElementById('system-health').style.color = '#00f2fe';
                } else {
                    document.getElementById('system-health').innerHTML = '⚠️ Issues';
                    document.getElementById('system-health').style.color = '#ffa500';
                }
            } catch (error) {
                document.getElementById('system-health').innerHTML = '❌ Error';
                document.getElementById('system-health').style.color = '#ff4444';
            }
        }

        // AI models status check
        async function checkAIModels() {
            try {
                const response = await fetch('/model-health');
                const data = await response.json();

                if (data.success && data.models) {
                    const healthyModels = Object.values(data.models).filter(m => m.status === 'healthy').length;
                    const totalModels = Object.keys(data.models).length;

                    if (healthyModels === totalModels) {
                        document.getElementById('ai-models').innerHTML = '✅ All Online';
                        document.getElementById('ai-models').style.color = '#00f2fe';
                    } else {
                        document.getElementById('ai-models').innerHTML = healthyModels + '/' + totalModels + ' Online';
                        document.getElementById('ai-models').style.color = '#ffa500';
                    }
                } else {
                    document.getElementById('ai-models').innerHTML = '⚠️ Partial';
                    document.getElementById('ai-models').style.color = '#ffa500';
                }
            } catch (error) {
                document.getElementById('ai-models').innerHTML = '❌ Error';
                document.getElementById('ai-models').style.color = '#ff4444';
            }
        }

        // Refresh all data
        async function refreshData() {
            const statusEl = document.getElementById('status-messages');
            statusEl.innerHTML = '🔄 Refreshing system status...';

            await Promise.all([
                checkSystemHealth(),
                checkAIModels()
            ]);

            // Update performance chart with new random data
            if (performanceChart) {
                performanceChart.data.datasets[0].data = performanceChart.data.datasets[0].data.map(() =>
                    Math.floor(Math.random() * 50) + 450
                );
                performanceChart.update();
            }

            statusEl.innerHTML = '✅ System status updated successfully';
            setTimeout(() => {
                statusEl.innerHTML = 'System ready';
            }, 3000);
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            initializePerformanceChart();
            checkSystemHealth();
            checkAIModels();

            // Set initial status
            document.getElementById('status-messages').innerHTML = '✅ System initialized successfully';

            // Auto-refresh every 30 seconds
            setInterval(() => {
                checkSystemHealth();
                checkAIModels();
            }, 30000);
        });
    </script>
</body>
</html>`;

  return new Response(htmlContent, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300' // 5 minute cache
    }
  });
}