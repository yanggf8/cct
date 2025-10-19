/**
 * Predictive Analytics Dashboard Handler
 * Serves the enterprise-grade predictive analytics dashboard with AI capabilities
 */

import { createRequestLogger } from './logging.js';
import type { CloudflareEnvironment } from '../../types.js';

/**
 * Serve the Predictive Analytics Dashboard HTML page
 */
export async function servePredictiveAnalyticsDashboard(
  request: Request,
  env: CloudflareEnvironment
): Promise<Response> {
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
            margin-bottom: 20px;
        }

        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: rgba(79, 172, 254, 0.1);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 20px;
            font-size: 0.9rem;
            color: #4facfe;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4facfe;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* KPI Cards Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .kpi-card {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .kpi-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
        }

        .kpi-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: var(--primary-gradient);
        }

        .kpi-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .kpi-title {
            font-size: 0.9rem;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .kpi-icon {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }

        .kpi-value {
            font-size: 2.2rem;
            font-weight: 700;
            margin-bottom: 8px;
            background: linear-gradient(45deg, #4facfe, #00f2fe);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .kpi-change {
            font-size: 0.9rem;
            margin-bottom: 12px;
        }

        .kpi-change.positive {
            color: #4facfe;
        }

        .kpi-change.negative {
            color: #ff6b6b;
        }

        .kpi-sparkline {
            height: 60px;
            margin-top: 12px;
        }

        /* Charts Section */
        .charts-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 30px;
        }

        .chart-container {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
        }

        .chart-container.full-width {
            grid-column: 1 / -1;
        }

        .chart-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .chart-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .chart-controls {
            display: flex;
            gap: 8px;
        }

        .chart-control {
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: var(--text-secondary);
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .chart-control:hover {
            background: rgba(255, 255, 255, 0.15);
            color: var(--text-primary);
        }

        .chart-control.active {
            background: var(--primary-gradient);
            color: white;
            border-color: transparent;
        }

        .chart-wrapper {
            height: 300px;
            position: relative;
        }

        /* Predictions Table */
        .predictions-container {
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 30px;
        }

        .predictions-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .predictions-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .predictions-filters {
            display: flex;
            gap: 12px;
        }

        .filter-select {
            padding: 8px 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.9rem;
        }

        .predictions-table {
            width: 100%;
            border-collapse: collapse;
        }

        .predictions-table th,
        .predictions-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .predictions-table th {
            background: rgba(255, 255, 255, 0.05);
            font-weight: 600;
            color: var(--text-secondary);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .predictions-table tr:hover {
            background: rgba(255, 255, 255, 0.03);
        }

        .prediction-confidence {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .confidence-high {
            background: rgba(79, 172, 254, 0.2);
            color: #4facfe;
        }

        .confidence-medium {
            background: rgba(254, 202, 87, 0.2);
            color: #feca57;
        }

        .confidence-low {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
        }

        .prediction-direction {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 600;
        }

        .direction-bullish {
            background: rgba(79, 172, 254, 0.2);
            color: #4facfe;
        }

        .direction-bearish {
            background: rgba(255, 107, 107, 0.2);
            color: #ff6b6b;
        }

        .direction-neutral {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-muted);
        }

        /* Loading States */
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
            z-index: 1000;
        }

        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-top-color: #4facfe;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .loading-text {
            position: absolute;
            top: 60%;
            color: var(--text-secondary);
            font-size: 1rem;
        }

        /* Error States */
        .error-container {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            color: #ff6b6b;
        }

        .error-icon {
            font-size: 2rem;
            margin-bottom: 12px;
        }

        .error-message {
            font-size: 1rem;
            margin-bottom: 16px;
        }

        .retry-button {
            padding: 10px 20px;
            background: var(--primary-gradient);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: transform 0.3s ease;
        }

        .retry-button:hover {
            transform: translateY(-2px);
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
            .charts-grid {
                grid-template-columns: 1fr;
            }

            .kpi-grid {
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            }
        }

        @media (max-width: 768px) {
            .dashboard-container {
                padding: 12px;
            }

            .dashboard-title {
                font-size: 2rem;
            }

            .kpi-grid {
                grid-template-columns: 1fr;
            }

            .predictions-table {
                font-size: 0.9rem;
            }

            .predictions-table th,
            .predictions-table td {
                padding: 8px;
            }
        }

        /* Utility Classes */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .mb-0 { margin-bottom: 0; }
        .mb-1 { margin-bottom: 8px; }
        .mb-2 { margin-bottom: 16px; }
        .mb-3 { margin-bottom: 24px; }
        .mt-1 { margin-top: 8px; }
        .mt-2 { margin-top: 16px; }
        .mt-3 { margin-top: 24px; }
        .hidden { display: none; }
        .visible { display: block; }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
            <h1 class="dashboard-title">🚀 Predictive Analytics Dashboard</h1>
            <p class="dashboard-subtitle">Enterprise Trading Intelligence with AI-Powered Insights</p>
            <div class="status-indicator">
                <span class="status-dot"></span>
                <span>System Operational</span>
            </div>
        </div>

        <!-- KPI Cards Grid -->
        <div class="kpi-grid" id="kpi-grid">
            <!-- KPI cards will be dynamically inserted here -->
        </div>

        <!-- Charts Grid -->
        <div class="charts-grid">
            <div class="chart-container">
                <div class="chart-header">
                    <h3 class="chart-title">📈 Prediction Accuracy Trends</h3>
                    <div class="chart-controls">
                        <button class="chart-control active" data-period="7d">7D</button>
                        <button class="chart-control" data-period="30d">30D</button>
                        <button class="chart-control" data-period="90d">90D</button>
                    </div>
                </div>
                <div class="chart-wrapper">
                    <canvas id="accuracy-chart"></canvas>
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-header">
                    <h3 class="chart-title">🎯 Confidence Distribution</h3>
                    <div class="chart-controls">
                        <button class="chart-control active" data-view="current">Current</button>
                        <button class="chart-control" data-view="historical">Historical</button>
                    </div>
                </div>
                <div class="chart-wrapper">
                    <canvas id="confidence-chart"></canvas>
                </div>
            </div>

            <div class="chart-container full-width">
                <div class="chart-header">
                    <h3 class="chart-title">⚡ Real-Time Performance Metrics</h3>
                    <div class="chart-controls">
                        <button class="chart-control active" data-metric="all">All</button>
                        <button class="chart-control" data-metric="accuracy">Accuracy</button>
                        <button class="chart-control" data-metric="latency">Latency</button>
                        <button class="chart-control" data-metric="volume">Volume</button>
                    </div>
                </div>
                <div class="chart-wrapper">
                    <canvas id="performance-chart"></canvas>
                </div>
            </div>
        </div>

        <!-- Predictions Table -->
        <div class="predictions-container">
            <div class="predictions-header">
                <h3 class="predictions-title">🔮 Active Predictions</h3>
                <div class="predictions-filters">
                    <select class="filter-select" id="symbol-filter">
                        <option value="">All Symbols</option>
                    </select>
                    <select class="filter-select" id="confidence-filter">
                        <option value="">All Confidence Levels</option>
                        <option value="high">High (>80%)</option>
                        <option value="medium">Medium (60-80%)</option>
                        <option value="low">Low (<60%)</option>
                    </select>
                    <select class="filter-select" id="direction-filter">
                        <option value="">All Directions</option>
                        <option value="bullish">Bullish</option>
                        <option value="bearish">Bearish</option>
                        <option value="neutral">Neutral</option>
                    </select>
                </div>
            </div>
            <div id="predictions-table-container">
                <!-- Predictions table will be dynamically inserted here -->
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loading-overlay">
        <div>
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading dashboard data...</div>
        </div>
    </div>

    <script>
        // Global state
        let accuracyChart, confidenceChart, performanceChart;
        let currentData = {
            predictions: [],
            metrics: {},
            kpiData: {}
        };

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeDashboard();
        });

        /**
         * Initialize the predictive analytics dashboard
         */
        async function initializeDashboard() {
            try {
                showLoading(true);

                // Initialize charts
                initializeCharts();

                // Load initial data
                await loadDashboardData();

                // Setup event listeners
                setupEventListeners();

                // Render dashboard components
                renderKPIGrid();
                renderPredictionsTable();
                updateCharts();

                showLoading(false);

                console.log('🚀 Predictive Analytics Dashboard initialized successfully');

            } catch (error) {
                console.error('❌ Failed to initialize dashboard:', error);
                showError('Failed to initialize dashboard. Please try again.');
                showLoading(false);
            }
        }

        /**
         * Initialize Chart.js charts
         */
        function initializeCharts() {
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            };

            // Accuracy Chart
            const accuracyCtx = document.getElementById('accuracy-chart').getContext('2d');
            accuracyChart = new Chart(accuracyCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Prediction Accuracy (%)',
                        data: [],
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        tension: 0.4
                    }]
                },
                options: chartOptions
            });

            // Confidence Distribution Chart
            const confidenceCtx = document.getElementById('confidence-chart').getContext('2d');
            confidenceChart = new Chart(confidenceCtx, {
                type: 'doughnut',
                data: {
                    labels: ['High (>80%)', 'Medium (60-80%)', 'Low (<60%)'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: [
                            '#4facfe',
                            '#feca57',
                            '#ff6b6b'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    ...chartOptions,
                    scales: undefined
                }
            });

            // Performance Chart
            const performanceCtx = document.getElementById('performance-chart').getContext('2d');
            performanceChart = new Chart(performanceCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Accuracy (%)',
                            data: [],
                            borderColor: '#4facfe',
                            backgroundColor: 'rgba(79, 172, 254, 0.1)',
                            tension: 0.4
                        },
                        {
                            label: 'Latency (ms)',
                            data: [],
                            borderColor: '#feca57',
                            backgroundColor: 'rgba(254, 202, 87, 0.1)',
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    ...chartOptions,
                    scales: {
                        ...chartOptions.scales,
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            ticks: { color: '#ffffff' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }

        /**
         * Load dashboard data from API
         */
        async function loadDashboardData() {
            try {
                // Load predictions data
                const predictionsResponse = await window.cctApi.request('/api/predictions');
                if (predictionsResponse.ok) {
                    const predictionsResult = await predictionsResponse.json();
                    currentData.predictions = predictionsResult.data || [];
                }

                // Load metrics data
                const metricsResponse = await window.cctApi.request('/api/metrics');
                if (metricsResponse.ok) {
                    const metricsResult = await metricsResponse.json();
                    currentData.metrics = metricsResult.data || {};
                }

                // Load KPI data
                const kpiResponse = await window.cctApi.request('/test-kpi');
                if (kpiResponse.ok) {
                    const kpiResult = await kpiResponse.json();
                    currentData.kpiData = kpiResult.data || {};
                }

            } catch (error) {
                console.error('Error loading dashboard data:', error);
                throw error;
            }
        }

        /**
         * Setup event listeners
         */
        function setupEventListeners() {
            // Chart control buttons
            document.querySelectorAll('.chart-control').forEach(button => {
                button.addEventListener('click', function() {
                    // Remove active class from siblings
                    this.parentElement.querySelectorAll('.chart-control').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    // Add active class to clicked button
                    this.classList.add('active');

                    // Update corresponding chart
                    updateChartByControl(this);
                });
            });

            // Filter controls
            document.querySelectorAll('.filter-select').forEach(select => {
                select.addEventListener('change', function() {
                    renderPredictionsTable();
                });
            });

            // Auto-refresh every 30 seconds
            setInterval(async () => {
                try {
                    await loadDashboardData();
                    updateCharts();
                    renderKPIGrid();
                    renderPredictionsTable();
                } catch (error) {
                    console.error('Error refreshing dashboard:', error);
                }
            }, 30000);
        }

        /**
         * Update chart based on control clicked
         */
        function updateChartByControl(control) {
            const period = control.dataset.period;
            const view = control.dataset.view;
            const metric = control.dataset.metric;

            if (period) {
                updateAccuracyChart(period);
            } else if (view) {
                updateConfidenceChart(view);
            } else if (metric) {
                updatePerformanceChart(metric);
            }
        }

        /**
         * Render KPI grid
         */
        function renderKPIGrid() {
            const kpiGrid = document.getElementById('kpi-grid');
            const kpiData = currentData.kpiData;

            const kpiCards = [
                {
                    title: 'Prediction Accuracy',
                    value: kpiData.prediction_accuracy?.current ?
                           Math.round(kpiData.prediction_accuracy.current) + '%' : '0%',
                    change: '+2.3%',
                    changeType: 'positive',
                    icon: '📈',
                    iconBg: 'linear-gradient(135deg, #4facfe, #00f2fe)'
                },
                {
                    title: 'Response Time',
                    value: kpiData.response_time?.current ?
                           kpiData.response_time.current + 'ms' : '0ms',
                    change: '-15ms',
                    changeType: 'positive',
                    icon: '⚡',
                    iconBg: 'linear-gradient(135deg, #feca57, #ff9ff3)'
                },
                {
                    title: 'Active Predictions',
                    value: currentData.predictions.length.toString(),
                    change: '+12',
                    changeType: 'positive',
                    icon: '🎯',
                    iconBg: 'linear-gradient(135deg, #667eea, #764ba2)'
                },
                {
                    title: 'System Health',
                    value: kpiData.overall_health || 'Unknown',
                    change: 'Stable',
                    changeType: 'positive',
                    icon: '🔄',
                    iconBg: 'linear-gradient(135deg, #4facfe, #00f2fe)'
                }
            ];

            kpiGrid.innerHTML = kpiCards.map(kpi => \`
                <div class="kpi-card">
                    <div class="kpi-header">
                        <div class="kpi-title">\${kpi.title}</div>
                        <div class="kpi-icon" style="background: \${kpi.iconBg}">
                            \${kpi.icon}
                        </div>
                    </div>
                    <div class="kpi-value">\${kpi.value}</div>
                    <div class="kpi-change \${kpi.changeType}">
                        \${kpi.change}
                    </div>
                    <canvas class="kpi-sparkline" id="sparkline-\${kpi.title.toLowerCase().replace(/\\s+/g, '-')}"></canvas>
                </div>
            \`).join('');
        }

        /**
         * Render predictions table
         */
        function renderPredictionsTable() {
            const container = document.getElementById('predictions-table-container');
            let predictions = [...currentData.predictions];

            // Apply filters
            const symbolFilter = document.getElementById('symbol-filter').value;
            const confidenceFilter = document.getElementById('confidence-filter').value;
            const directionFilter = document.getElementById('direction-filter').value;

            if (symbolFilter) {
                predictions = predictions.filter(p => p.symbol === symbolFilter);
            }

            if (confidenceFilter) {
                predictions = predictions.filter(p => {
                    const confidence = p.confidence * 100;
                    if (confidenceFilter === 'high') return confidence > 80;
                    if (confidenceFilter === 'medium') return confidence >= 60 && confidence <= 80;
                    if (confidenceFilter === 'low') return confidence < 60;
                    return true;
                });
            }

            if (directionFilter) {
                predictions = predictions.filter(p => p.direction === directionFilter);
            }

            // Populate symbol filter
            const symbolFilter = document.getElementById('symbol-filter');
            const symbols = [...new Set(currentData.predictions.map(p => p.symbol))];
            symbolFilter.innerHTML = '<option value="">All Symbols</option>' +
                symbols.map(symbol => \`<option value="\${symbol}">\${symbol}</option>\`).join('');

            if (predictions.length === 0) {
                container.innerHTML = '<div class="text-center" style="padding: 40px; color: var(--text-muted);">No predictions match the current filters.</div>';
                return;
            }

            const tableHTML = \`
                <table class="predictions-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Direction</th>
                            <th>Confidence</th>
                            <th>Target Price</th>
                            <th>Timeframe</th>
                            <th>Created</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${predictions.map(prediction => \`
                            <tr>
                                <td><strong>\${prediction.symbol}</strong></td>
                                <td>
                                    <span class="prediction-direction direction-\${prediction.direction}">
                                        \${prediction.direction === 'bullish' ? '📈' :
                                          prediction.direction === 'bearish' ? '📉' : '➡️'}
                                        \${prediction.direction.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <span class="prediction-confidence confidence-\${getConfidenceLevel(prediction.confidence)}">
                                        \${Math.round(prediction.confidence * 100)}%
                                    </span>
                                </td>
                                <td>\$\${prediction.target_price || 'N/A'}</td>
                                <td>\${prediction.timeframe || 'N/A'}</td>
                                <td>\${formatDate(prediction.created_at)}</td>
                                <td>
                                    <span class="prediction-status status-\${prediction.status}">
                                        \${prediction.status || 'Active'}
                                    </span>
                                </td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;

            container.innerHTML = tableHTML;
        }

        /**
         * Update all charts
         */
        function updateCharts() {
            updateAccuracyChart('7d');
            updateConfidenceChart('current');
            updatePerformanceChart('all');
        }

        /**
         * Update accuracy chart
         */
        function updateAccuracyChart(period) {
            // Generate sample data for demonstration
            const labels = [];
            const data = [];
            const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString());
                data.push(70 + Math.random() * 25); // Mock accuracy data
            }

            accuracyChart.data.labels = labels;
            accuracyChart.data.datasets[0].data = data;
            accuracyChart.update();
        }

        /**
         * Update confidence chart
         */
        function updateConfidenceChart(view) {
            if (view === 'current') {
                // Calculate from current predictions
                const confidenceLevels = {
                    high: 0,
                    medium: 0,
                    low: 0
                };

                currentData.predictions.forEach(prediction => {
                    const confidence = prediction.confidence * 100;
                    if (confidence > 80) confidenceLevels.high++;
                    else if (confidence >= 60) confidenceLevels.medium++;
                    else confidenceLevels.low++;
                });

                confidenceChart.data.datasets[0].data = [
                    confidenceLevels.high,
                    confidenceLevels.medium,
                    confidenceLevels.low
                ];
            } else {
                // Historical data (mock)
                confidenceChart.data.datasets[0].data = [45, 30, 25];
            }

            confidenceChart.update();
        }

        /**
         * Update performance chart
         */
        function updatePerformanceChart(metric) {
            // Generate sample time series data
            const labels = [];
            const accuracyData = [];
            const latencyData = [];

            for (let i = 23; i >= 0; i--) {
                const date = new Date();
                date.setHours(date.getHours() - i);
                labels.push(date.getHours() + ':00');
                accuracyData.push(70 + Math.random() * 25);
                latencyData.push(50 + Math.random() * 100);
            }

            performanceChart.data.labels = labels;

            if (metric === 'all' || metric === 'accuracy') {
                performanceChart.data.datasets[0].hidden = false;
            } else {
                performanceChart.data.datasets[0].hidden = true;
            }

            if (metric === 'all' || metric === 'latency') {
                performanceChart.data.datasets[1].hidden = false;
            } else {
                performanceChart.data.datasets[1].hidden = true;
            }

            performanceChart.data.datasets[0].data = accuracyData;
            performanceChart.data.datasets[1].data = latencyData;
            performanceChart.update();
        }

        /**
         * Utility functions
         */
        function getConfidenceLevel(confidence) {
            const percentage = confidence * 100;
            if (percentage > 80) return 'high';
            if (percentage >= 60) return 'medium';
            return 'low';
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        }

        function showLoading(show) {
            const overlay = document.getElementById('loading-overlay');
            overlay.style.display = show ? 'flex' : 'none';
        }

        function showError(message) {
            const container = document.querySelector('.dashboard-container');
            container.innerHTML = \`
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <div class="error-message">\${message}</div>
                    <button class="retry-button" onclick="location.reload()">Retry</button>
                </div>
            \`;
        }
    </script>
</body>
</html>`;

    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // 5 minute cache
      }
    });

  } catch (error: any) {
    requestLogger.error('Error serving predictive analytics dashboard', {
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });

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