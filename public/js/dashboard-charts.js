// SECURITY: Hardcoded API keys removed for security
/**
 * TFT Trading System Dashboard Charts
 * Interactive charts and visualizations using Chart.js
 */

class DashboardCharts {
    constructor(dashboardCore) {
        this.dashboard = dashboardCore;
        this.charts = new Map();
        this.defaultOptions = this.getDefaultChartOptions();

        // Initialize charts when DOM is ready
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeCharts();
            });
        } else {
            this.initializeCharts();
        }
    }

    /**
     * Initialize all dashboard charts
     */
    initializeCharts() {
        console.log('📊 Initializing dashboard charts...');

        this.initializeSentimentChart();
        this.initializeTechnicalChart();
        this.initializeSectorPerformanceChart();
        this.initializePredictiveChart();

        console.log('✅ Dashboard charts initialized');
    }

    /**
     * Get default chart options
     */
    getDefaultChartOptions() {
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';

        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: isDarkTheme ? '#e9ecef' : '#212529',
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: isDarkTheme ? '#2d2d2d' : '#ffffff',
                    titleColor: isDarkTheme ? '#e9ecef' : '#212529',
                    bodyColor: isDarkTheme ? '#adb5bd' : '#6c757d',
                    borderColor: isDarkTheme ? '#495057' : '#dee2e6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: isDarkTheme ? '#495057' : '#e9ecef',
                        borderColor: isDarkTheme ? '#6c757d' : '#adb5bd'
                    },
                    ticks: {
                        color: isDarkTheme ? '#adb5bd' : '#6c757d'
                    }
                },
                y: {
                    grid: {
                        color: isDarkTheme ? '#495057' : '#e9ecef',
                        borderColor: isDarkTheme ? '#6c757d' : '#adb5bd'
                    },
                    ticks: {
                        color: isDarkTheme ? '#adb5bd' : '#6c757d'
                    }
                }
            }
        };
    }

    /**
     * Initialize sentiment analysis chart
     */
    initializeSentimentChart() {
        const canvas = document.getElementById('sentiment-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const chartConfig = {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Overall Sentiment',
                        data: [],
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Confidence Score',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    title: {
                        display: false
                    }
                },
                scales: {
                    ...this.defaultOptions.scales,
                    y: {
                        ...this.defaultOptions.scales.y,
                        min: -1,
                        max: 1,
                        ticks: {
                            ...this.defaultOptions.scales.y.ticks,
                            callback: function(value) {
                                if (value === 1) return 'Bullish';
                                if (value === 0) return 'Neutral';
                                if (value === -1) return 'Bearish';
                                return value.toFixed(1);
                            }
                        }
                    }
                }
            }
        };

        const chart = new Chart(ctx, chartConfig);
        this.charts.set('sentiment', chart);

        // Add time frame selector listener
        const timeframeSelect = document.getElementById('sentiment-timeframe');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', (e) => {
                this.updateSentimentChartTimeframe(e.target.value);
            });
        }

        // Load initial data
        this.loadSentimentChartInitialData();
    }

    /**
     * Initialize technical analysis chart
     */
    initializeTechnicalChart() {
        const canvas = document.getElementById('technical-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const chartConfig = {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Price',
                        data: [],
                        borderColor: '#007bff',
                        backgroundColor: 'rgba(0, 123, 255, 0.1)',
                        borderWidth: 2,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Moving Average (20)',
                        data: [],
                        borderColor: '#ffc107',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.1,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    title: {
                        display: false
                    }
                },
                scales: {
                    ...this.defaultOptions.scales,
                    y: {
                        ...this.defaultOptions.scales.y,
                        ticks: {
                            ...this.defaultOptions.scales.y.ticks,
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        };

        const chart = new Chart(ctx, chartConfig);
        this.charts.set('technical', chart);

        // Add symbol selector listener
        const symbolSelect = document.getElementById('technical-symbol');
        if (symbolSelect) {
            symbolSelect.addEventListener('change', (e) => {
                this.updateTechnicalChartSymbol(e.target.value);
            });
        }

        // Load initial data
        this.loadTechnicalChartInitialData();
    }

    /**
     * Initialize sector performance chart
     */
    initializeSectorPerformanceChart() {
        // This could be added as a separate chart widget
        // For now, sector data is displayed as a heatmap
    }

    /**
     * Initialize predictive analytics chart
     */
    initializePredictiveChart() {
        // This could be added as a separate chart widget for prediction accuracy
    }

    /**
     * Update sentiment chart with new data
     */
    updateSentimentChart(data) {
        const chart = this.charts.get('sentiment');
        if (!chart) return;

        if (!data || !data.timeSeries) return;

        const labels = data.timeSeries.map(item =>
            new Date(item.timestamp).toLocaleTimeString()
        );

        const sentimentData = data.timeSeries.map(item => item.sentiment || 0);
        const confidenceData = data.timeSeries.map(item => item.confidence || 0);

        chart.data.labels = labels;
        chart.data.datasets[0].data = sentimentData;
        chart.data.datasets[1].data = confidenceData;

        chart.update('none'); // Update without animation for real-time data
    }

    /**
     * Update technical chart with new data
     */
    updateTechnicalChart(data) {
        const chart = this.charts.get('technical');
        if (!chart) return;

        if (!data || !data.prices) return;

        const labels = data.prices.map(item =>
            new Date(item.timestamp).toLocaleDateString()
        );

        const priceData = data.prices.map(item => item.price);
        const maData = data.prices.map(item => item.movingAverage);

        chart.data.labels = labels;
        chart.data.datasets[0].data = priceData;
        chart.data.datasets[1].data = maData;

        chart.update('none');
    }

    /**
     * Update sentiment chart timeframe
     */
    async updateSentimentChartTimeframe(timeframe) {
        try {
            console.log(`📊 Updating sentiment chart timeframe: ${timeframe}`);

            // Calculate date range based on timeframe
            const endDate = new Date();
            const startDate = new Date();

            switch (timeframe) {
                case '1D':
                    startDate.setHours(startDate.getHours() - 24);
                    break;
                case '1W':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '1M':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                default:
                    startDate.setHours(startDate.getHours() - 24);
            }

            // Fetch sentiment data for the timeframe
            const response = await this.dashboard.apiClient.getSentimentAnalysis([], {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                interval: this.getTimeframeInterval(timeframe)
            });

            if (response.success && response.data) {
                this.updateSentimentChart(response.data);
            }

        } catch (error) {
            console.error('Failed to update sentiment chart timeframe:', error);
        }
    }

    /**
     * Update technical chart symbol
     */
    async updateTechnicalChartSymbol(symbol) {
        try {
            console.log(`📊 Updating technical chart symbol: ${symbol}`);

            const response = await this.dashboard.apiClient.getSymbolHistory(symbol, {
                period: '1M',
                interval: '1d'
            });

            if (response.success && response.data) {
                this.updateTechnicalChart(response.data);
            }

        } catch (error) {
            console.error('Failed to update technical chart symbol:', error);
        }
    }

    /**
     * Load initial sentiment chart data
     */
    async loadSentimentChartInitialData() {
        try {
            const response = await this.dashboard.apiClient.getSentimentAnalysis([], {
                period: '1D',
                interval: '1h'
            });

            if (response.success && response.data) {
                this.updateSentimentChart(response.data);
            } else {
                this.showChartUnavailable('sentiment', 'Sentiment data unavailable');
            }

        } catch (error) {
            console.error('Failed to load initial sentiment data:', error);
            this.showChartUnavailable('sentiment', 'Sentiment data unavailable');
        }
    }

    /**
     * Load initial technical chart data
     */
    async loadTechnicalChartInitialData() {
        try {
            const symbol = document.getElementById('technical-symbol')?.value || 'SPY';

            const response = await this.dashboard.apiClient.getSymbolHistory(symbol, {
                period: '1M',
                interval: '1d'
            });

            if (response.success && response.data) {
                this.updateTechnicalChart(response.data);
            } else {
                this.showChartUnavailable('technical', 'Technical data unavailable');
            }

        } catch (error) {
            console.error('Failed to load initial technical data:', error);
            this.showChartUnavailable('technical', 'Technical data unavailable');
        }
    }

    /**
     * Show unavailable state for a chart
     */
    showChartUnavailable(chartKey, message) {
        const chart = this.charts.get(chartKey);
        if (chart) {
            chart.data.labels = [];
            chart.data.datasets.forEach(ds => ds.data = []);
            chart.options.plugins = chart.options.plugins || {};
            chart.options.plugins.title = { display: true, text: message, color: '#888' };
            chart.update();
        }
    }

    /**
     * Load mock sentiment data for demonstration
     */
    loadSentimentChartMockData() {
        const chart = this.charts.get('sentiment');
        if (!chart) return;

        const now = new Date();
        const labels = [];
        const sentimentData = [];
        const confidenceData = [];

        // Generate 24 hours of mock data
        for (let i = 23; i >= 0; i--) {
            const time = new Date(now - i * 3600000);
            labels.push(time.toLocaleTimeString());

            // Generate mock sentiment with some randomness
            const sentiment = (Math.sin(i / 4) * 0.5 + Math.random() * 0.3 - 0.15);
            const confidence = 0.6 + Math.random() * 0.3;

            sentimentData.push(sentiment);
            confidenceData.push(confidence);
        }

        chart.data.labels = labels;
        chart.data.datasets[0].data = sentimentData;
        chart.data.datasets[1].data = confidenceData;

        chart.update();
    }

    /**
     * Load mock technical data for demonstration
     */
    loadTechnicalChartMockData() {
        const chart = this.charts.get('technical');
        if (!chart) return;

        const labels = [];
        const priceData = [];
        const maData = [];

        // Generate 30 days of mock data
        let basePrice = 450;
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());

            // Generate mock price with trend and randomness
            basePrice = basePrice + (Math.random() - 0.48) * 10;
            const price = Math.max(basePrice, 400);

            // Calculate moving average
            const maStart = Math.max(0, i - 19);
            const maPrices = priceData.slice(maStart);
            const movingAverage = maPrices.length > 0
                ? maPrices.reduce((sum, p) => sum + p, 0) / maPrices.length
                : price;

            priceData.push(price);
            maData.push(movingAverage);
        }

        chart.data.labels = labels;
        chart.data.datasets[0].data = priceData;
        chart.data.datasets[1].data = maData;

        chart.update();
    }

    /**
     * Get interval for timeframe
     */
    getTimeframeInterval(timeframe) {
        switch (timeframe) {
            case '1D':
                return '1h';
            case '1W':
                return '1d';
            case '1M':
                return '1d';
            default:
                return '1h';
        }
    }

    /**
     * Create sector performance chart
     */
    createSectorPerformanceChart(containerId, sectorData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');

        const chartConfig = {
            type: 'bar',
            data: {
                labels: sectorData.map(sector => sector.name),
                datasets: [
                    {
                        label: 'Performance %',
                        data: sectorData.map(sector => sector.performance),
                        backgroundColor: sectorData.map(sector =>
                            sector.performance >= 0
                                ? 'rgba(40, 167, 69, 0.8)'
                                : 'rgba(220, 53, 69, 0.8)'
                        ),
                        borderColor: sectorData.map(sector =>
                            sector.performance >= 0
                                ? '#28a745'
                                : '#dc3545'
                        ),
                        borderWidth: 1
                    }
                ]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    }
                },
                scales: {
                    ...this.defaultOptions.scales,
                    y: {
                        ...this.defaultOptions.scales.y,
                        ticks: {
                            ...this.defaultOptions.scales.y.ticks,
                            callback: function(value) {
                                return value.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        };

        const chart = new Chart(ctx, chartConfig);
        this.charts.set(`sector-${containerId}`, chart);

        return chart;
    }

    /**
     * Update all charts theme
     */
    updateChartsTheme() {
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        const newOptions = this.getDefaultChartOptions();

        this.charts.forEach(chart => {
            // Update colors
            chart.options.plugins.legend.labels.color = newOptions.plugins.legend.labels.color;
            chart.options.plugins.tooltip.backgroundColor = newOptions.plugins.tooltip.backgroundColor;
            chart.options.plugins.tooltip.titleColor = newOptions.plugins.tooltip.titleColor;
            chart.options.plugins.tooltip.bodyColor = newOptions.plugins.tooltip.bodyColor;
            chart.options.plugins.tooltip.borderColor = newOptions.plugins.tooltip.borderColor;
            chart.options.scales.x.grid.color = newOptions.scales.x.grid.color;
            chart.options.scales.x.ticks.color = newOptions.scales.x.ticks.color;
            chart.options.scales.y.grid.color = newOptions.scales.y.grid.color;
            chart.options.scales.y.ticks.color = newOptions.scales.y.ticks.color;

            chart.update();
        });
    }

    /**
     * Destroy chart
     */
    destroyChart(chartId) {
        const chart = this.charts.get(chartId);
        if (chart) {
            chart.destroy();
            this.charts.delete(chartId);
        }
    }

    /**
     * Destroy all charts
     */
    destroyAllCharts() {
        this.charts.forEach(chart => chart.destroy());
        this.charts.clear();
    }

    /**
     * Export chart as image
     */
    exportChart(chartId, filename) {
        const chart = this.charts.get(chartId);
        if (chart) {
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.download = filename || `chart-${chartId}.png`;
            link.href = url;
            link.click();
        }
    }

    /**
     * Resize charts (useful for responsive design)
     */
    resizeCharts() {
        this.charts.forEach(chart => {
            chart.resize();
        });
    }
}

// Initialize charts module
document.addEventListener('DOMContentLoaded', () => {
    if (window.dashboard) {
        window.dashboardCharts = new DashboardCharts(window.dashboard);
    }
});

// Handle theme changes
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
            if (window.dashboardCharts) {
                window.dashboardCharts.updateChartsTheme();
            }
        }
    });
});

observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.dashboardCharts) {
        window.dashboardCharts.resizeCharts();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardCharts;
}