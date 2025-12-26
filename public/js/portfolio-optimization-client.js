// SECURITY: Hardcoded API keys removed for security
/**
 * Portfolio Optimization Client
 * Advanced portfolio construction and optimization visualization
 * Phase 2C: Multi-Asset Correlation Analysis & Portfolio Optimization
 */

class PortfolioOptimizationClient {
    constructor() {
        this.apiClient = new CCTApi({
            enableCache: true,
            timeout: 30000
        });
        this.charts = new Map();
        this.currentData = null;
        this.themes = {
            light: {
                background: 'rgba(255, 255, 255, 0.95)',
                text: '#333',
                grid: '#e1e8ed',
                primary: '#667eea',
                secondary: '#764ba2',
                positive: '#10b981',
                negative: '#ef4444'
            },
            dark: {
                background: 'rgba(255, 255, 255, 0.1)',
                text: '#fff',
                grid: 'rgba(255, 255, 255, 0.2)',
                primary: '#818cf8',
                secondary: '#a78bfa',
                positive: '#34d399',
                negative: '#f87171'
            }
        };
        this.currentTheme = 'light';
        this.initializeCharts();
    }

    /**
     * Initialize all charts with default settings
     */
    initializeCharts() {
        this.createEfficientFrontierChart();
        this.createCorrelationMatrixChart();
        this.createStressTestChart();
        this.createRiskContributionChart();
    }

    /**
     * Run portfolio optimization
     */
    async runOptimization() {
        const symbols = this.getSymbols();
        const objective = document.getElementById('objectiveSelect').value;
        const lookback = parseInt(document.getElementById('lookbackSelect').value);

        if (!symbols || symbols.length < 2) {
            this.showStatus('Please enter at least 2 symbols', 'error');
            return;
        }

        this.showStatus('Running portfolio optimization...', 'warning');
        this.showLoading();

        try {
            // Run correlation analysis first
            const correlationResult = await this.apiClient.request('/portfolio/correlation', {
                method: 'POST',
                body: {
                    symbols,
                    lookbackPeriod: lookback
                }
            });

            if (!correlationResult.success) {
                throw new Error(correlationResult.error || 'Correlation analysis failed');
            }

            // Run portfolio optimization
            const optimizationResult = await this.apiClient.request('/portfolio/optimize', {
                method: 'POST',
                body: {
                    symbols,
                    objective,
                    lookbackPeriod: lookback,
                    constraints: {}
                }
            });

            if (!optimizationResult.success) {
                throw new Error(optimizationResult.error || 'Portfolio optimization failed');
            }

            // Get risk metrics
            const riskResult = await this.apiClient.request('/portfolio/risk-metrics', {
                method: 'POST',
                body: {
                    weights: optimizationResult.data.weights,
                    symbols,
                    lookbackPeriod: lookback
                }
            });

            // Update visualizations
            await this.updateVisualization({
                correlation: correlationResult.data,
                optimization: optimizationResult.data,
                riskMetrics: riskResult.success ? riskResult.data : null
            });

            this.showStatus('Portfolio optimization completed successfully!', 'success');

        } catch (error) {
            console.error('Portfolio optimization failed:', error);
            this.showStatus(`Optimization failed: ${error.message}`, 'error');
        }
    }

    /**
     * Generate efficient frontier
     */
    async generateEfficientFrontier() {
        const symbols = this.getSymbols();
        const lookback = parseInt(document.getElementById('lookbackSelect').value);

        if (!symbols || symbols.length < 2) {
            this.showStatus('Please enter at least 2 symbols', 'error');
            return;
        }

        this.showStatus('Generating efficient frontier...', 'warning');

        try {
            const result = await this.apiClient.request('/portfolio/efficient-frontier', {
                method: 'POST',
                body: {
                    symbols,
                    lookbackPeriod: lookback,
                    numPortfolios: 50
                }
            });

            if (!result.success) {
                throw new Error(result.error || 'Efficient frontier calculation failed');
            }

            this.updateEfficientFrontierChart(result.data);
            this.showStatus('Efficient frontier generated successfully!', 'success');

        } catch (error) {
            console.error('Efficient frontier generation failed:', error);
            this.showStatus(`Efficient frontier failed: ${error.message}`, 'error');
        }
    }

    /**
     * Update all visualizations with new data
     */
    async updateVisualization(data) {
        this.currentData = data;

        // Update correlation matrix
        if (data.correlation) {
            this.updateCorrelationMatrixChart(data.correlation);
        }

        // Update portfolio weights
        if (data.optimization) {
            this.updatePortfolioWeights(data.optimization);
        }

        // Update risk metrics
        if (data.riskMetrics) {
            this.updateRiskMetrics(data.riskMetrics);
        }

        // Run stress test
        await this.runStressTest(data.optimization.weights, data.optimization.symbols);

        // Generate efficient frontier
        await this.generateEfficientFrontier();
    }

    /**
     * Create efficient frontier chart
     */
    createEfficientFrontierChart() {
        const ctx = document.getElementById('efficientFrontierChart');
        if (!ctx) return;

        this.charts.set('efficientFrontier', new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Efficient Frontier',
                        data: [],
                        borderColor: this.themes[this.currentTheme].primary,
                        backgroundColor: `${this.themes[this.currentTheme].primary}20`,
                        showLine: true,
                        tension: 0.4
                    },
                    {
                        label: 'Optimal Portfolio',
                        data: [],
                        borderColor: this.themes[this.currentTheme].positive,
                        backgroundColor: this.themes[this.currentTheme].positive,
                        pointRadius: 8,
                        pointHoverRadius: 10
                    },
                    {
                        label: 'Individual Assets',
                        data: [],
                        borderColor: this.themes[this.currentTheme].secondary,
                        backgroundColor: this.themes[this.currentTheme].secondary,
                        pointRadius: 6,
                        pointHoverRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            color: this.themes[this.currentTheme].text
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = context.raw;
                                if (context.dataset.label === 'Individual Assets') {
                                    return [
                                        `${point.symbol}`,
                                        `Return: ${(point.expectedReturn * 100).toFixed(2)}%`,
                                        `Volatility: ${(point.volatility * 100).toFixed(2)}%`,
                                        `Sharpe: ${point.sharpeRatio.toFixed(2)}`
                                    ];
                                }
                                return [
                                    `Return: ${(point.expectedReturn * 100).toFixed(2)}%`,
                                    `Volatility: ${(point.volatility * 100).toFixed(2)}%`,
                                    `Sharpe: ${point.sharpeRatio.toFixed(2)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Volatility (Risk)',
                            color: this.themes[this.currentTheme].text
                        },
                        grid: {
                            color: this.themes[this.currentTheme].grid
                        },
                        ticks: {
                            color: this.themes[this.currentTheme].text,
                            callback: (value) => `${(value * 100).toFixed(1)}%`
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Expected Return',
                            color: this.themes[this.currentTheme].text
                        },
                        grid: {
                            color: this.themes[this.currentTheme].grid
                        },
                        ticks: {
                            color: this.themes[this.currentTheme].text,
                            callback: (value) => `${(value * 100).toFixed(1)}%`
                        }
                    }
                }
            }
        }));
    }

    /**
     * Create correlation matrix chart
     */
    createCorrelationMatrixChart() {
        const ctx = document.getElementById('correlationMatrixChart');
        if (!ctx) return;

        this.charts.set('correlationMatrix', new Chart(ctx, {
            type: 'matrix',
            data: {
                datasets: [{
                    label: 'Correlation',
                    data: [],
                    backgroundColor: (ctx) => {
                        const value = ctx.dataset.data[ctx.dataIndex].v;
                        const alpha = Math.abs(value);
                        if (value > 0.7) return `rgba(16, 185, 129, ${alpha})`;
                        if (value > 0.3) return `rgba(129, 140, 248, ${alpha})`;
                        if (value > -0.3) return `rgba(156, 163, 175, ${alpha})`;
                        if (value > -0.7) return `rgba(251, 146, 60, ${alpha})`;
                        return `rgba(239, 68, 68, ${alpha})`;
                    },
                    borderColor: this.themes[this.currentTheme].grid,
                    borderWidth: 1
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
                        callbacks: {
                            title: (context) => {
                                const data = context[0].dataset.data[context[0].dataIndex];
                                return `${data.y} - ${data.x}`;
                            },
                            label: (context) => {
                                const value = context.dataset.data[context.dataIndex].v;
                                return `Correlation: ${value.toFixed(3)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        labels: [],
                        grid: { display: false },
                        ticks: { color: this.themes[this.currentTheme].text }
                    },
                    y: {
                        type: 'category',
                        labels: [],
                        grid: { display: false },
                        ticks: { color: this.themes[this.currentTheme].text }
                    }
                }
            }
        }));
    }

    /**
     * Create stress test chart
     */
    createStressTestChart() {
        const ctx = document.getElementById('stressTestChart');
        if (!ctx) return;

        this.charts.set('stressTest', new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Expected Return',
                        data: [],
                        backgroundColor: this.themes[this.currentTheme].primary,
                        yAxisID: 'y'
                    },
                    {
                        label: 'VaR (95%)',
                        data: [],
                        backgroundColor: this.themes[this.currentTheme].negative,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Performance Impact',
                        data: [],
                        backgroundColor: this.themes[this.currentTheme].secondary,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: this.themes[this.currentTheme].text
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: this.themes[this.currentTheme].text }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Return (%)',
                            color: this.themes[this.currentTheme].text
                        },
                        grid: {
                            color: this.themes[this.currentTheme].grid
                        },
                        ticks: {
                            color: this.themes[this.currentTheme].text,
                            callback: (value) => `${(value * 100).toFixed(1)}%`
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Impact (%)',
                            color: this.themes[this.currentTheme].text
                        },
                        grid: { drawOnChartArea: false },
                        ticks: {
                            color: this.themes[this.currentTheme].text,
                            callback: (value) => `${(value * 100).toFixed(1)}%`
                        }
                    }
                }
            }
        }));
    }

    /**
     * Create risk contribution chart
     */
    createRiskContributionChart() {
        const ctx = document.getElementById('riskContributionChart');
        if (!ctx) return;

        this.charts.set('riskContribution', new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#667eea', '#764ba2', '#10b981', '#f59e0b', '#ef4444',
                        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'
                    ],
                    borderColor: this.themes[this.currentTheme].background,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: this.themes[this.currentTheme].text
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${percentage}%`;
                            }
                        }
                    }
                }
            }
        }));
    }

    /**
     * Update efficient frontier chart
     */
    updateEfficientFrontierChart(frontierData) {
        const chart = this.charts.get('efficientFrontier');
        if (!chart || !frontierData) return;

        // Update efficient frontier points
        const frontierPoints = frontierData.frontier.map(point => ({
            x: point.volatility,
            y: point.expectedReturn,
            sharpeRatio: point.sharpeRatio
        }));

        // Update optimal portfolio point
        const optimalPoint = frontierData.maxSharpePortfolio ? {
            x: frontierData.maxSharpePortfolio.volatility,
            y: frontierData.maxSharpePortfolio.expectedReturn,
            sharpeRatio: frontierData.maxSharpePortfolio.sharpeRatio
        } : null;

        // Update individual assets (mock data for now)
        const assetPoints = this.currentData?.correlation?.symbols.map((symbol, i) => ({
            x: 0.1 + Math.random() * 0.3,
            y: 0.05 + Math.random() * 0.15,
            sharpeRatio: 0.5 + Math.random() * 1.0,
            symbol: symbol
        })) || [];

        chart.data.datasets[0].data = frontierPoints;
        chart.data.datasets[1].data = optimalPoint ? [optimalPoint] : [];
        chart.data.datasets[2].data = assetPoints;
        chart.update();
    }

    /**
     * Update correlation matrix chart
     */
    updateCorrelationMatrixChart(correlationData) {
        const chart = this.charts.get('correlationMatrix');
        if (!chart || !correlationData) return;

        const { symbols, matrix } = correlationData.correlationMatrix;
        const matrixData = [];

        for (let i = 0; i < symbols.length; i++) {
            for (let j = 0; j < symbols.length; j++) {
                matrixData.push({
                    x: symbols[j],
                    y: symbols[i],
                    v: matrix[i][j]
                });
            }
        }

        chart.data.datasets[0].data = matrixData;
        chart.options.scales.x.labels = symbols;
        chart.options.scales.y.labels = symbols;
        chart.update();
    }

    /**
     * Update portfolio weights display
     */
    updatePortfolioWeights(optimizationData) {
        const container = document.getElementById('portfolioWeights');
        if (!container || !optimizationData) return;

        const { weights, symbols } = optimizationData;

        // Create sorted weight items
        const weightItems = symbols.map((symbol, i) => ({
            symbol,
            weight: weights[i],
            percentage: (weights[i] * 100).toFixed(2)
        })).sort((a, b) => b.weight - a.weight);

        container.innerHTML = weightItems.map(item => `
            <div class="weight-item">
                <span class="weight-symbol">${item.symbol}</span>
                <div class="weight-bar">
                    <div class="weight-fill" style="width: ${item.percentage}%"></div>
                </div>
                <span class="weight-value">${item.percentage}%</span>
            </div>
        `).join('');

        // Update risk contribution chart with weights
        this.updateRiskContributionChart(weightItems);
    }

    /**
     * Update risk metrics display
     */
    updateRiskMetrics(riskData) {
        if (!riskData) return;

        const metrics = [
            { key: 'portfolioExpectedReturn', label: 'Expected Return', format: 'percent' },
            { key: 'portfolioVolatility', label: 'Volatility', format: 'percent' },
            { key: 'sharpeRatio', label: 'Sharpe Ratio', format: 'number' },
            { key: 'maxDrawdown', label: 'Max Drawdown', format: 'percent' },
            { key: 'var95', label: 'VaR (95%)', format: 'percent' },
            { key: 'cvar95', label: 'CVaR (95%)', format: 'percent' }
        ];

        const container = document.getElementById('riskMetrics');
        const metricCards = container.querySelectorAll('.metric-card');

        metrics.forEach((metric, index) => {
            if (metricCards[index]) {
                const valueElement = metricCards[index].querySelector('.metric-value');
                const labelElement = metricCards[index].querySelector('.metric-label');

                const value = riskData[metric.key];
                let formattedValue = '--';

                if (value !== undefined && value !== null) {
                    if (metric.format === 'percent') {
                        formattedValue = `${(value * 100).toFixed(2)}%`;
                    } else if (metric.format === 'number') {
                        formattedValue = value.toFixed(2);
                    }
                }

                valueElement.textContent = formattedValue;
                labelElement.textContent = metric.label;
            }
        });
    }

    /**
     * Run stress test
     */
    async runStressTest(weights, symbols) {
        if (!weights || !symbols) return;

        try {
            const result = await this.apiClient.request('/portfolio/stress-test', {
                method: 'POST',
                body: {
                    weights,
                    symbols,
                    scenarios: [] // Use default scenarios
                }
            });

            if (result.success) {
                this.updateStressTestChart(result.data);
            }
        } catch (error) {
            console.warn('Stress test failed:', error);
        }
    }

    /**
     * Update stress test chart
     */
    updateStressTestChart(stressData) {
        const chart = this.charts.get('stressTest');
        if (!chart || !stressData) return;

        const scenarios = stressData.scenarios || [];

        chart.data.labels = scenarios.map(s => s.scenario);
        chart.data.datasets[0].data = scenarios.map(s => s.expectedReturn);
        chart.data.datasets[1].data = scenarios.map(s => s.var95);
        chart.data.datasets[2].data = scenarios.map(s => s.performanceImpact);
        chart.update();
    }

    /**
     * Update risk contribution chart
     */
    updateRiskContributionChart(weightItems) {
        const chart = this.charts.get('riskContribution');
        if (!chart) return;

        chart.data.labels = weightItems.map(item => item.symbol);
        chart.data.datasets[0].data = weightItems.map(item => item.weight);
        chart.update();
    }

    /**
     * Get symbols from input
     */
    getSymbols() {
        const input = document.getElementById('symbolsInput').value;
        return input.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
    }

    /**
     * Show loading state
     */
    showLoading() {
        // Add loading states to charts
        document.getElementById('portfolioWeights').innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                Calculating optimal weights...
            </div>
        `;
    }

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        const container = document.getElementById('statusMessage');
        const className = type === 'error' ? 'error-message' :
                         type === 'success' ? 'success-message' :
                         'loading';

        container.innerHTML = `
            <div class="${className}">
                <span class="status-indicator status-${type}"></span>
                ${message}
            </div>
        `;

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                container.innerHTML = '';
            }, 5000);
        }
    }

    /**
     * Update charts for theme change
     */
    updateTheme() {
        const theme = this.themes[this.currentTheme];

        this.charts.forEach(chart => {
            if (chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = theme.text;
            }
            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.title) scale.title.color = theme.text;
                    if (scale.ticks) scale.ticks.color = theme.text;
                    if (scale.grid) scale.grid.color = theme.grid;
                });
            }
            chart.update();
        });
    }
}

/**
 * Theme toggle functionality
 */
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');

    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');

    icon.textContent = isDark ? '☀️' : '🌙';
    portfolioOptimizer.currentTheme = isDark ? 'dark' : 'light';
    portfolioOptimizer.updateTheme();
}

/**
 * Initialize portfolio optimizer
 */
let portfolioOptimizer;

document.addEventListener('DOMContentLoaded', () => {
    portfolioOptimizer = new PortfolioOptimizationClient();

    // Add enter key support for symbols input
    document.getElementById('symbolsInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runOptimization();
        }
    });

    // Auto-run optimization on load with default symbols
    setTimeout(() => {
        portfolioOptimizer.runOptimization();
    }, 1000);
});

/**
 * Global functions for onclick handlers
 */
function runOptimization() {
    portfolioOptimizer.runOptimization();
}

function generateEfficientFrontier() {
    portfolioOptimizer.generateEfficientFrontier();
}

function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');

    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');

    icon.textContent = isDark ? '☀️' : '🌙';
    portfolioOptimizer.currentTheme = isDark ? 'dark' : 'light';
    portfolioOptimizer.updateTheme();
}