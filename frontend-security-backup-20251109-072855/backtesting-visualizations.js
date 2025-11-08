/**
 * Advanced Backtesting Visualizations Module
 * Provides sophisticated charting and analytics for backtesting results
 */

class BacktestingVisualizer {
    constructor() {
        this.charts = new Map();
        this.themes = {
            light: {
                background: '#ffffff',
                text: '#374151',
                grid: '#e5e7eb',
                positive: '#10b981',
                negative: '#ef4444',
                primary: '#6366f1',
                secondary: '#8b5cf6'
            },
            dark: {
                background: '#1f2937',
                text: '#f9fafb',
                grid: '#374151',
                positive: '#34d399',
                negative: '#f87171',
                primary: '#818cf8',
                secondary: '#a78bfa'
            }
        };
        this.currentTheme = 'light';
    }

    /**
     * Create comprehensive performance dashboard
     */
    createPerformanceDashboard(containerId, results, metrics) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="backtesting-dashboard">
                <div class="dashboard-header">
                    <h2>Backtesting Performance Analysis</h2>
                    <div class="controls">
                        <button onclick="visualizer.toggleTheme()" class="theme-toggle">
                            <i class="fas fa-adjust"></i>
                        </button>
                        <button onclick="visualizer.exportCharts()" class="export-charts">
                            <i class="fas fa-download"></i> Export Charts
                        </button>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <div class="chart-container large">
                        <canvas id="equity-chart"></canvas>
                    </div>
                    <div class="chart-container medium">
                        <canvas id="returns-heatmap"></canvas>
                    </div>
                    <div class="chart-container medium">
                        <canvas id="risk-reward-scatter"></canvas>
                    </div>
                    <div class="chart-container small">
                        <canvas id="win-loss-pie"></canvas>
                    </div>
                    <div class="chart-container small">
                        <canvas id="monthly-bar"></canvas>
                    </div>
                    <div class="chart-container full">
                        <canvas id="trade-timeline"></canvas>
                    </div>
                </div>
            </div>
        `;

        this.initializeCharts(results, metrics);
    }

    /**
     * Initialize all charts with data
     */
    initializeCharts(results, metrics) {
        const theme = this.themes[this.currentTheme];

        // Equity Curve with Moving Averages
        this.createEquityCurve('equity-chart', results.equityCurve || [], theme);

        // Returns Heatmap
        this.createReturnsHeatmap('returns-heatmap', results.returns || [], theme);

        // Risk-Reward Scatter Plot
        this.createRiskRewardScatter('risk-reward-scatter', results.trades || [], theme);

        // Win/Loss Pie Chart
        this.createWinLossPie('win-loss-pie', results.trades || [], theme);

        // Monthly Returns Bar Chart
        this.createMonthlyBar('monthly-bar', metrics.monthlyReturns || {}, theme);

        // Trade Timeline
        this.createTradeTimeline('trade-timeline', results.trades || [], theme);
    }

    /**
     * Create equity curve with moving averages
     */
    createEquityCurve(canvasId, equityData, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || equityData.length === 0) return;

        // Calculate moving averages
        const ma20 = this.calculateMovingAverage(equityData.map(d => d.value), 20);
        const ma50 = this.calculateMovingAverage(equityData.map(d => d.value), 50);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: equityData.map(d => new Date(d.date)),
                datasets: [
                    {
                        label: 'Portfolio Value',
                        data: equityData.map(d => d.value),
                        borderColor: theme.primary,
                        backgroundColor: `${theme.primary}20`,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: '20-Day MA',
                        data: ma20,
                        borderColor: theme.secondary,
                        borderWidth: 1,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: '50-Day MA',
                        data: ma50,
                        borderColor: theme.positive,
                        borderWidth: 1,
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Equity Curve with Moving Averages',
                        color: theme.text
                    },
                    legend: {
                        labels: { color: theme.text }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'month' },
                        grid: { color: theme.grid },
                        ticks: { color: theme.text }
                    },
                    y: {
                        grid: { color: theme.grid },
                        ticks: {
                            color: theme.text,
                            callback: (value) => `$${value.toLocaleString()}`
                        }
                    }
                }
            }
        });
    }

    /**
     * Create returns heatmap
     */
    createReturnsHeatmap(canvasId, returns, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || returns.length === 0) return;

        // Group returns by month and year
        const monthlyData = this.groupReturnsByMonth(returns);
        const heatmapData = this.convertToHeatmapData(monthlyData);

        new Chart(ctx, {
            type: 'matrix',
            data: {
                datasets: [{
                    label: 'Monthly Returns',
                    data: heatmapData,
                    backgroundColor: (ctx) => {
                        const value = ctx.dataset.data[ctx.dataIndex].v;
                        if (value > 0.05) return theme.positive;
                        if (value > 0.02) return '#86efac';
                        if (value > -0.02) return '#fef3c7';
                        if (value > -0.05) return '#fca5a5';
                        return theme.negative;
                    },
                    borderColor: theme.grid,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Returns Heatmap',
                        color: theme.text
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const data = context[0].dataset.data[context[0].dataIndex];
                                return `${data.y} ${data.x}`;
                            },
                            label: (context) => {
                                const value = context.dataset.data[context.dataIndex].v;
                                return `Return: ${(value * 100).toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                        grid: { display: false },
                        ticks: { color: theme.text }
                    },
                    y: {
                        type: 'category',
                        labels: [...new Set(heatmapData.map(d => d.y))].sort(),
                        grid: { display: false },
                        ticks: { color: theme.text }
                    }
                }
            }
        });
    }

    /**
     * Create risk-reward scatter plot
     */
    createRiskRewardScatter(canvasId, trades, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || trades.length === 0) return;

        const scatterData = trades.map(trade => ({
            x: Math.abs(trade.risk || trade.maxLoss || 0),
            y: trade.reward || trade.pnl || 0,
            symbol: trade.symbol,
            type: trade.type
        }));

        new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Risk vs Reward',
                    data: scatterData,
                    backgroundColor: scatterData.map(d => d.y > 0 ? theme.positive : theme.negative),
                    borderColor: theme.text,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Risk-Reward Analysis',
                        color: theme.text
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const point = context.raw;
                                return [
                                    `Symbol: ${point.symbol}`,
                                    `Risk: $${point.x.toFixed(2)}`,
                                    `Reward: $${point.y.toFixed(2)}`,
                                    `Type: ${point.type}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Risk ($)',
                            color: theme.text
                        },
                        grid: { color: theme.grid },
                        ticks: { color: theme.text }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Reward ($)',
                            color: theme.text
                        },
                        grid: { color: theme.grid },
                        ticks: { color: theme.text }
                    }
                }
            }
        });
    }

    /**
     * Create win/loss pie chart
     */
    createWinLossPie(canvasId, trades, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || trades.length === 0) return;

        const winningTrades = trades.filter(t => (t.pnl || 0) > 0).length;
        const losingTrades = trades.length - winningTrades;

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Winning Trades', 'Losing Trades'],
                datasets: [{
                    data: [winningTrades, losingTrades],
                    backgroundColor: [theme.positive, theme.negative],
                    borderColor: theme.background,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Win/Loss Distribution',
                        color: theme.text
                    },
                    legend: {
                        position: 'bottom',
                        labels: { color: theme.text }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create monthly returns bar chart
     */
    createMonthlyBar(canvasId, monthlyReturns, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || Object.keys(monthlyReturns).length === 0) return;

        const sortedMonths = Object.keys(monthlyReturns).sort();
        const returns = sortedMonths.map(month => monthlyReturns[month]);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedMonths.map(month =>
                    new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                ),
                datasets: [{
                    label: 'Monthly Return',
                    data: returns,
                    backgroundColor: returns.map(r => r > 0 ? theme.positive : theme.negative),
                    borderColor: theme.text,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Returns',
                        color: theme.text
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Return: ${(context.parsed.y * 100).toFixed(2)}%`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: theme.text }
                    },
                    y: {
                        grid: { color: theme.grid },
                        ticks: {
                            color: theme.text,
                            callback: (value) => `${(value * 100).toFixed(1)}%`
                        }
                    }
                }
            }
        });
    }

    /**
     * Create trade timeline visualization
     */
    createTradeTimeline(canvasId, trades, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || trades.length === 0) return;

        // Group trades by week and calculate cumulative P&L
        const weeklyData = this.groupTradesByWeek(trades);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: weeklyData.map(d => d.week),
                datasets: [{
                    label: 'Cumulative P&L',
                    data: weeklyData.map(d => d.cumulativePnL),
                    borderColor: theme.primary,
                    backgroundColor: `${theme.primary}20`,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }, {
                    label: 'Trade Count',
                    data: weeklyData.map(d => d.tradeCount),
                    borderColor: theme.secondary,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    fill: false,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Trade Timeline & Cumulative P&L',
                        color: theme.text
                    },
                    legend: {
                        labels: { color: theme.text }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                if (context.datasetIndex === 0) {
                                    return `Cumulative P&L: $${context.parsed.y.toFixed(2)}`;
                                } else {
                                    return `Trade Count: ${context.parsed.y}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: theme.grid },
                        ticks: { color: theme.text }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: theme.grid },
                        ticks: {
                            color: theme.text,
                            callback: (value) => `$${value.toFixed(0)}`
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: theme.text }
                    }
                }
            }
        });
    }

    /**
     * Calculate moving average
     */
    calculateMovingAverage(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else {
                const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                result.push(sum / period);
            }
        }
        return result;
    }

    /**
     * Group returns by month
     */
    groupReturnsByMonth(returns) {
        const grouped = {};
        returns.forEach(ret => {
            const date = new Date(ret.date);
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const year = date.getFullYear();
            const key = `${year}-${month}`;

            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(ret.value || ret.return || 0);
        });

        // Calculate average return for each month
        Object.keys(grouped).forEach(key => {
            const values = grouped[key];
            grouped[key] = values.reduce((a, b) => a + b, 0) / values.length;
        });

        return grouped;
    }

    /**
     * Convert returns data to heatmap format
     */
    convertToHeatmapData(monthlyData) {
        const heatmapData = [];
        const years = [...new Set(Object.keys(monthlyData).map(k => k.split('-')[0]))];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        years.forEach(year => {
            months.forEach((month, index) => {
                const key = `${year}-${month}`;
                const value = monthlyData[key] || 0;
                heatmapData.push({ x: month, y: year, v: value });
            });
        });

        return heatmapData;
    }

    /**
     * Group trades by week
     */
    groupTradesByWeek(trades) {
        const weeklyData = {};
        let cumulativePnL = 0;

        trades.forEach(trade => {
            const date = new Date(trade.date);
            const week = this.getWeekNumber(date);
            const year = date.getFullYear();
            const key = `${year}-W${week}`;

            if (!weeklyData[key]) {
                weeklyData[key] = { week: key, trades: [], cumulativePnL: 0 };
            }

            weeklyData[key].trades.push(trade);
            cumulativePnL += trade.pnl || 0;
            weeklyData[key].cumulativePnL = cumulativePnL;
        });

        return Object.values(weeklyData).map(w => ({
            week: w.week,
            cumulativePnL: w.cumulativePnL,
            tradeCount: w.trades.length
        }));
    }

    /**
     * Get week number from date
     */
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.body.classList.toggle('dark-theme');
        // Re-render charts with new theme
        this.refreshCharts();
    }

    /**
     * Export charts as images
     */
    exportCharts() {
        this.charts.forEach((chart, id) => {
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.download = `backtest-${id}.png`;
            link.href = url;
            link.click();
        });
    }

    /**
     * Refresh all charts
     */
    refreshCharts() {
        // Implementation would require storing current data and re-initializing charts
        console.log('Charts refreshed with new theme');
    }

    /**
     * Create performance comparison chart
     */
    createPerformanceComparison(canvasId, strategies, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const metrics = ['Total Return', 'Sharpe Ratio', 'Max Drawdown', 'Win Rate'];
        const datasets = strategies.map((strategy, index) => ({
            label: strategy.name,
            data: [
                strategy.totalReturn || 0,
                strategy.sharpeRatio || 0,
                Math.abs(strategy.maxDrawdown || 0),
                strategy.winRate || 0
            ],
            borderColor: theme.primary,
            backgroundColor: `${theme.primary}20`,
            borderWidth: 2
        }));

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: metrics,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Strategy Comparison',
                        color: theme.text
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: theme.grid },
                        pointLabels: { color: theme.text },
                        ticks: { color: theme.text }
                    }
                }
            }
        });
    }

    /**
     * Create correlation matrix heatmap
     */
    createCorrelationMatrix(canvasId, correlationData, theme) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const assets = Object.keys(correlationData);
        const matrixData = [];

        assets.forEach((asset1, i) => {
            assets.forEach((asset2, j) => {
                const correlation = correlationData[asset1][asset2] || 0;
                matrixData.push({
                    x: j,
                    y: i,
                    v: correlation
                });
            });
        });

        new Chart(ctx, {
            type: 'matrix',
            data: {
                datasets: [{
                    label: 'Correlation',
                    data: matrixData,
                    backgroundColor: (ctx) => {
                        const value = ctx.dataset.data[ctx.dataIndex].v;
                        const alpha = Math.abs(value);
                        return value > 0 ? `rgba(34, 197, 94, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Asset Correlation Matrix',
                        color: theme.text
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        labels: assets,
                        grid: { display: false },
                        ticks: { color: theme.text }
                    },
                    y: {
                        type: 'category',
                        labels: assets,
                        grid: { display: false },
                        ticks: { color: theme.text }
                    }
                }
            }
        });
    }
}

// Export for use in other modules
window.BacktestingVisualizer = BacktestingVisualizer;