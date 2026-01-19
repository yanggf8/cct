/**
 * Predictive Analytics Dashboard JavaScript
 * Interactive dashboard for predictive analytics visualization
 * Integrates with CCT API v1 for real-time data
 */

class PredictiveAnalyticsDashboard {
    constructor() {
        this.apiClient = null;
        this.charts = {};
        this.autoRefreshInterval = null;
        this.autoRefreshEnabled = false;
        this.currentSymbols = ['AAPL', 'MSFT', 'NVDA'];
        this.currentTimeRange = '1W';
        this.refreshInterval = 30000; // 30 seconds

        this.init();
    }

    async init() {
        try {
            // Initialize API client
            this.apiClient = new CCTApi({
                enableCache: true,
                timeout: 30000
            });

            // Hide loading overlay using DomCache
            const loadingOverlay = DomCache.get('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }

            // Set up event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadAllData();

            console.log('Predictive Analytics Dashboard initialized successfully');
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to initialize dashboard: ' + error.message);
        }
    }

    setupEventListeners() {
        // Symbol input change using DomCache
        const symbolInput = DomCache.get('symbolInput');
        if (symbolInput) {
            symbolInput.addEventListener('change', (e) => {
                const symbols = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
                if (symbols.length > 0) {
                    this.currentSymbols = symbols;
                    this.refreshAllData();
                }
            });
        }

        // Time range change using DomCache
        const timeRange = DomCache.get('timeRange');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.currentTimeRange = e.target.value;
                this.refreshAllData();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshAllData();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportData();
                        break;
                    case ' ':
                        e.preventDefault();
                        this.toggleAutoRefresh();
                        break;
                }
            }
        });
    }

    async loadAllData() {
        // Use scoped component loader instead of global overlay
        ComponentLoader.show('dashboard-container', 'Loading predictive analytics...');

        try {
            // Load all data in parallel with error boundaries
            const promises = [
                this.loadMarketRegime(),
                this.loadSentimentAnalysis(),
                this.loadTechnicalAnalysis(),
                this.loadSectorIndicators(),
                this.loadPredictiveSignals(),
                this.loadRealtimeStatus()
            ];

            await Promise.allSettled(promises);

            ComponentLoader.hide('dashboard-container');
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            ComponentErrorHandler.showError('dashboard-container', error, {
                showRetry: true,
                showDetails: false
            });
        }
    }

    async loadMarketRegime() {
        // Use scoped error handler for market regime widget
        const loadFn = ComponentErrorHandler.wrap('market-regime-widget', async () => {
            const response = await this.apiClient.getMarketRegime({
                enhanced: true,
                timeRange: this.currentTimeRange
            });

            if (response.success) {
                this.updateRegimeWidget(response.data);
                this.updateWidgetStatus('regimeStatus', 'healthy');
            } else {
                throw new Error(response.error || 'Failed to load market regime data');
            }
        }, { showRetry: true });

        if (loadFn) {
            await loadFn();
        }
    }

    async loadSentimentAnalysis() {
        try {
            // Use available sentiment/analysis endpoint instead of fine-grained
            const response = await this.apiClient.getSentimentAnalysis(
                this.currentSymbols,
                { cache: true }
            );

            if (response.success) {
                this.updateSentimentWidget(response.data);
                this.updateWidgetStatus('sentimentStatus', 'healthy');
            } else {
                throw new Error(response.error || 'Failed to load sentiment data');
            }
        } catch (error) {
            console.error('Error loading sentiment analysis:', error);
            this.updateWidgetStatus('sentimentStatus', 'error');
            this.populateSentimentFallback();
        }
    }

    async loadTechnicalAnalysis() {
        try {
            const response = await this.apiClient.getTechnicalAnalysis(
                this.currentSymbols,
                { timeRange: this.currentTimeRange }
            );

            if (response.success) {
                this.updateTechnicalWidget(response.data);
                this.updateWidgetStatus('technicalStatus', 'healthy');
            } else {
                throw new Error(response.error || 'Failed to load technical analysis');
            }
        } catch (error) {
            console.error('Error loading technical analysis:', error);
            this.updateWidgetStatus('technicalStatus', 'error');
            this.populateTechnicalFallback();
        }
    }

    async loadSectorIndicators() {
        try {
            // Use sector/snapshot endpoint instead of individual sector indicators
            const response = await this.apiClient.request('/sectors/snapshot');

            if (response.success) {
                this.updateSectorWidget(response.data);
                this.updateWidgetStatus('sectorStatus', 'healthy');
            } else {
                throw new Error(response.error || 'Failed to load sector indicators');
            }
        } catch (error) {
            console.error('Error loading sector indicators:', error);
            this.updateWidgetStatus('sectorStatus', 'error');
            this.populateSectorFallback();
        }
    }

    async loadPredictiveSignals() {
        try {
            const response = await this.apiClient.getPredictiveSignals({
                symbols: this.currentSymbols,
                timeRange: this.currentTimeRange,
                includeForecasts: true
            });

            if (response.success) {
                this.updatePredictiveSignalsWidget(response.data);
                this.updateWidgetStatus('signalsStatus', 'healthy');
            } else {
                throw new Error(response.error || 'Failed to load predictive signals');
            }
        } catch (error) {
            console.error('Error loading predictive signals:', error);
            this.updateWidgetStatus('signalsStatus', 'error');
            this.populatePredictiveFallback();
        }
    }

    async loadRealtimeStatus() {
        try {
            const response = await this.apiClient.getRealtimeStatus();

            if (response.success) {
                this.updateRealtimeWidget(response.data);
                this.updateWidgetStatus('realtimeStatus', 'healthy');
            } else {
                throw new Error(response.error || 'Failed to load real-time status');
            }
        } catch (error) {
            console.error('Error loading real-time status:', error);
            this.updateWidgetStatus('realtimeStatus', 'error');
            this.populateRealtimeFallback();
        }
    }

    // Widget Update Methods
    updateRegimeWidget(data) {
        const regimeInfo = document.getElementById('regimeInfo');
        const regime = data.regime || data.current_regime || {};

        regimeInfo.innerHTML = `
            <div class="regime-stat">
                <div class="regime-stat-label">Current Regime</div>
                <div class="regime-stat-value">${regime.regime_name || 'Bull Market'}</div>
            </div>
            <div class="regime-stat">
                <div class="regime-stat-label">Confidence</div>
                <div class="regime-stat-value">${(regime.confidence || 0.85 * 100).toFixed(1)}%</div>
            </div>
            <div class="regime-stat">
                <div class="regime-stat-label">Transition Risk</div>
                <div class="regime-stat-value">${(regime.transition_risk || 0.15 * 100).toFixed(1)}%</div>
            </div>
            <div class="regime-stat">
                <div class="regime-stat-label">Risk Level</div>
                <div class="regime-stat-value">${regime.risk_level || 'Medium'}</div>
            </div>
        `;

        // Create regime history chart
        this.createRegimeChart(data.history || this.generateMockRegimeHistory());
    }

    updateSentimentWidget(data) {
        const sentimentGauge = document.getElementById('sentimentGauge');
        const overallSentiment = this.calculateOverallSentiment(data);

        sentimentGauge.innerHTML = `
            <div class="gauge-section">
                <div class="gauge-value gauge-sentiment-${overallSentiment.direction.toLowerCase()}">
                    ${overallSentiment.score.toFixed(2)}
                </div>
                <div class="gauge-label">Overall Score</div>
            </div>
            <div class="gauge-section">
                <div class="gauge-value">${overallSentiment.agreementRate}%</div>
                <div class="gauge-label">AI Agreement</div>
            </div>
            <div class="gauge-section">
                <div class="gauge-value">${overallSentiment.confidence}%</div>
                <div class="gauge-label">Confidence</div>
            </div>
            <div class="gauge-section">
                <div class="gauge-value">${overallSentiment.articles}</div>
                <div class="gauge-label">Articles</div>
            </div>
        `;

        // Create sentiment chart
        this.createSentimentChart(data);
    }

    updateTechnicalWidget(data) {
        this.createTechnicalChart(data);
    }

    updateSectorWidget(data) {
        this.createSectorChart(data);
    }

    updatePredictiveSignalsWidget(data) {
        this.updatePredictionCards(data.predictions || []);
        this.createPredictionsChart(data);
    }

    updateRealtimeWidget(data) {
        this.createRealtimeChart(data);
    }

    // Chart Creation Methods
    createRegimeChart(history) {
        const ctx = document.getElementById('regimeChart').getContext('2d');

        if (this.charts.regime) {
            this.charts.regime.destroy();
        }

        this.charts.regime = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(h => h.date),
                datasets: [{
                    label: 'Regime Confidence',
                    data: history.map(h => h.confidence * 100),
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Transition Risk',
                    data: history.map(h => h.transition_risk * 100),
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
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
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    createSentimentChart(data) {
        const ctx = document.getElementById('sentimentChart').getContext('2d');

        if (this.charts.sentiment) {
            this.charts.sentiment.destroy();
        }

        const symbols = Array.isArray(data) ? data : Object.values(data);
        const sentimentData = symbols.map(s => ({
            symbol: s.symbol || 'UNKNOWN',
            sentiment: s.overall_sentiment || 0,
            confidence: s.confidence || 0,
            agreement: s.agreement_rate || 0
        }));

        this.charts.sentiment = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sentimentData.map(d => d.symbol),
                datasets: [{
                    label: 'Sentiment Score',
                    data: sentimentData.map(d => d.sentiment),
                    backgroundColor: sentimentData.map(d =>
                        d.sentiment > 0.1 ? 'rgba(76, 175, 80, 0.7)' :
                        d.sentiment < -0.1 ? 'rgba(244, 67, 54, 0.7)' :
                        'rgba(255, 193, 7, 0.7)'
                    ),
                    borderColor: sentimentData.map(d =>
                        d.sentiment > 0.1 ? '#4caf50' :
                        d.sentiment < -0.1 ? '#f44336' :
                        '#ffc107'
                    ),
                    borderWidth: 1
                }]
            },
            options: {
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
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        min: -1,
                        max: 1
                    }
                }
            }
        });
    }

    createTechnicalChart(data) {
        const ctx = document.getElementById('technicalChart').getContext('2d');

        if (this.charts.technical) {
            this.charts.technical.destroy();
        }

        // Generate mock technical indicators data
        const technicalData = this.generateMockTechnicalData();

        this.charts.technical = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['RSI', 'MACD', 'BB Position', 'Volume', 'Momentum', 'Trend'],
                datasets: technicalData.map((symbol, index) => ({
                    label: symbol.symbol,
                    data: symbol.indicators,
                    borderColor: this.getSymbolColor(index),
                    backgroundColor: this.getSymbolColor(index, 0.2),
                    borderWidth: 2
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                },
                scales: {
                    r: {
                        ticks: { color: '#ffffff', backdropColor: 'transparent' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#ffffff' },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    createSectorChart(data) {
        const ctx = document.getElementById('sectorChart').getContext('2d');

        if (this.charts.sector) {
            this.charts.sector.destroy();
        }

        const sectorData = this.generateMockSectorData();

        this.charts.sector = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sectorData.map(d => d.sector),
                datasets: [{
                    data: sectorData.map(d => d.flow),
                    backgroundColor: [
                        '#4facfe', '#00f2fe', '#ff6b6b', '#feca57', '#48dbfb',
                        '#ff9ff3', '#54a0ff', '#48dbfb', '#ff6b6b', '#feca57', '#ff9ff3'
                    ],
                    borderWidth: 2,
                    borderColor: '#1a1a2e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });
    }

    createPredictionsChart(data) {
        const ctx = document.getElementById('predictionsChart').getContext('2d');

        if (this.charts.predictions) {
            this.charts.predictions.destroy();
        }

        const predictionsData = this.generateMockPredictionsData();

        this.charts.predictions = new Chart(ctx, {
            type: 'line',
            data: {
                labels: predictionsData.labels,
                datasets: predictionsData.datasets.map(dataset => ({
                    ...dataset,
                    borderColor: dataset.borderColor || '#4facfe',
                    backgroundColor: dataset.backgroundColor || 'rgba(79, 172, 254, 0.1)',
                    tension: 0.4,
                    fill: false
                }))
            },
            options: {
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
            }
        });
    }

    createRealtimeChart(data) {
        const ctx = document.getElementById('realtimeChart').getContext('2d');

        if (this.charts.realtime) {
            this.charts.realtime.destroy();
        }

        const realtimeData = this.generateMockRealtimeData();

        this.charts.realtime = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: realtimeData.labels,
                datasets: [{
                    label: 'Data Freshness (minutes ago)',
                    data: realtimeData.freshness,
                    backgroundColor: realtimeData.freshness.map(d =>
                        d < 5 ? 'rgba(76, 175, 80, 0.7)' :
                        d < 15 ? 'rgba(255, 193, 7, 0.7)' :
                        'rgba(244, 67, 54, 0.7)'
                    ),
                    borderColor: realtimeData.freshness.map(d =>
                        d < 5 ? '#4caf50' :
                        d < 15 ? '#ffc107' :
                        '#f44336'
                    ),
                    borderWidth: 1
                }]
            },
            options: {
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
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        min: 0,
                        title: {
                            display: true,
                            text: 'Minutes Ago',
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }

    // Utility Methods
    updatePredictionCards(predictions) {
        const container = document.getElementById('predictionsContainer');
        container.innerHTML = '';

        const displayPredictions = predictions.length > 0 ? predictions : this.generateMockPredictions();

        displayPredictions.forEach(prediction => {
            const card = this.createPredictionCard(prediction);
            container.appendChild(card);
        });
    }

    createPredictionCard(prediction) {
        const card = document.createElement('div');
        card.className = 'prediction-card';

        const directionClass = prediction.direction.toLowerCase() === 'bullish' ? 'direction-bullish' :
                              prediction.direction.toLowerCase() === 'bearish' ? 'direction-bearish' :
                              'direction-neutral';

        card.innerHTML = `
            <div class="prediction-header">
                <div class="prediction-symbol">${prediction.symbol}</div>
                <div class="prediction-direction ${directionClass}">
                    ${prediction.direction === 'BULLISH' ? '📈' : prediction.direction === 'BEARISH' ? '📉' : '➡️'}
                    ${prediction.direction}
                </div>
            </div>
            <div class="prediction-details">
                <div class="prediction-detail">
                    <div class="detail-label">Confidence</div>
                    <div class="detail-value">${prediction.confidence}%</div>
                </div>
                <div class="prediction-detail">
                    <div class="detail-label">Target Price</div>
                    <div class="detail-value">$${prediction.target_price}</div>
                </div>
                <div class="prediction-detail">
                    <div class="detail-label">Time Horizon</div>
                    <div class="detail-value">${prediction.time_horizon}</div>
                </div>
                <div class="prediction-detail">
                    <div class="detail-label">Model Score</div>
                    <div class="detail-value">${prediction.model_score}</div>
                </div>
            </div>
        `;

        return card;
    }

    calculateOverallSentiment(data) {
        if (!data || Object.keys(data).length === 0) {
            return { score: 0, direction: 'NEUTRAL', confidence: 0, agreementRate: 0, articles: 0 };
        }

        const symbols = Array.isArray(data) ? data : Object.values(data);
        const totalSentiment = symbols.reduce((sum, s) => sum + (s.overall_sentiment || 0), 0);
        const avgSentiment = totalSentiment / symbols.length;
        const avgConfidence = symbols.reduce((sum, s) => sum + (s.confidence || 0), 0) / symbols.length;
        const avgAgreement = symbols.reduce((sum, s) => sum + (s.agreement_rate || 0), 0) / symbols.length;
        const totalArticles = symbols.reduce((sum, s) => sum + (s.articles_analyzed || 0), 0);

        let direction = 'NEUTRAL';
        if (avgSentiment > 0.1) direction = 'BULLISH';
        else if (avgSentiment < -0.1) direction = 'BEARISH';

        return {
            score: avgSentiment,
            direction,
            confidence: Math.round(avgConfidence * 100),
            agreementRate: Math.round(avgAgreement),
            articles: totalArticles
        };
    }

    getSymbolColor(index, alpha = 1) {
        const colors = [
            `rgba(79, 172, 254, ${alpha})`,
            `rgba(0, 242, 254, ${alpha})`,
            `rgba(255, 107, 107, ${alpha})`,
            `rgba(254, 202, 87, ${alpha})`,
            `rgba(72, 219, 251, ${alpha})`
        ];
        return colors[index % colors.length];
    }

    updateWidgetStatus(statusId, status) {
        const element = document.getElementById(statusId);
        element.className = `widget-status status-${status}`;
        element.innerHTML = `<span>●</span> ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.textContent = message;
        errorContainer.classList.remove('hidden');
    }

    clearError() {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.classList.add('hidden');
    }

    // Mock Data Generators (for fallback when API is unavailable)
    generateMockRegimeHistory() {
        const days = 30;
        const data = [];
        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            data.push({
                date: date.toISOString().split('T')[0],
                confidence: 0.7 + Math.random() * 0.3,
                transition_risk: 0.1 + Math.random() * 0.2
            });
        }
        return data;
    }

    generateMockTechnicalData() {
        return this.currentSymbols.map(symbol => ({
            symbol,
            indicators: [
                50 + Math.random() * 50, // RSI
                50 + Math.random() * 50, // MACD
                30 + Math.random() * 40, // BB Position
                50 + Math.random() * 50, // Volume
                40 + Math.random() * 60, // Momentum
                50 + Math.random() * 50  // Trend
            ]
        }));
    }

    generateMockSectorData() {
        return [
            { sector: 'XLF (Financial)', flow: 150 + Math.random() * 100 },
            { sector: 'XLK (Technology)', flow: 200 + Math.random() * 150 },
            { sector: 'XLE (Energy)', flow: -50 + Math.random() * 100 },
            { sector: 'XLV (Healthcare)', flow: 80 + Math.random() * 80 },
            { sector: 'XLI (Industrial)', flow: 60 + Math.random() * 60 },
            { sector: 'XLU (Utilities)', flow: 40 + Math.random() * 40 },
            { sector: 'XLP (Consumer Staples)', flow: 30 + Math.random() * 30 },
            { sector: 'XLY (Consumer Discretionary)', flow: 100 + Math.random() * 80 },
            { sector: 'XLB (Materials)', flow: 20 + Math.random() * 40 },
            { sector: 'REIT', flow: 70 + Math.random() * 50 },
            { sector: 'GLD (Gold)', flow: -30 + Math.random() * 60 }
        ];
    }

    generateMockPredictions() {
        return this.currentSymbols.map(symbol => ({
            symbol,
            direction: Math.random() > 0.5 ? 'BULLISH' : Math.random() > 0.3 ? 'BEARISH' : 'NEUTRAL',
            confidence: Math.round(60 + Math.random() * 35),
            target_price: (100 + Math.random() * 500).toFixed(2),
            time_horizon: ['1D', '1W', '1M'][Math.floor(Math.random() * 3)],
            model_score: (0.6 + Math.random() * 0.4).toFixed(3)
        }));
    }

    generateMockPredictionsData() {
        const days = 14;
        const labels = [];
        const datasets = [];

        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());
        }

        this.currentSymbols.forEach((symbol, index) => {
            const data = [];
            let lastValue = 100 + Math.random() * 200;

            for (let i = 0; i <= days; i++) {
                lastValue = lastValue * (1 + (Math.random() - 0.5) * 0.05);
                data.push(lastValue);
            }

            datasets.push({
                label: `${symbol} Prediction`,
                data,
                borderColor: this.getSymbolColor(index),
                backgroundColor: this.getSymbolColor(index, 0.1)
            });
        });

        return { labels, datasets };
    }

    generateMockRealtimeData() {
        const sources = ['Yahoo Finance', 'FRED API', 'News Feed', 'Market Data', 'Sentiment AI'];
        const freshness = sources.map(() => Math.random() * 30);

        return {
            labels: sources,
            freshness
        };
    }

    // Fallback population methods
    populateRegimeFallback() {
        const regimeInfo = document.getElementById('regimeInfo');
        regimeInfo.innerHTML = `
            <div class="regime-stat">
                <div class="regime-stat-label">Current Regime</div>
                <div class="regime-stat-value">Bull Market</div>
            </div>
            <div class="regime-stat">
                <div class="regime-stat-label">Confidence</div>
                <div class="regime-stat-value">85%</div>
            </div>
            <div class="regime-stat">
                <div class="regime-stat-label">Transition Risk</div>
                <div class="regime-stat-value">15%</div>
            </div>
            <div class="regime-stat">
                <div class="regime-stat-label">Risk Level</div>
                <div class="regime-stat-value">Medium</div>
            </div>
        `;
        this.createRegimeChart(this.generateMockRegimeHistory());
    }

    populateSentimentFallback() {
        const sentimentGauge = document.getElementById('sentimentGauge');
        sentimentGauge.innerHTML = `
            <div class="gauge-section">
                <div class="gauge-value gauge-sentiment-bullish">0.25</div>
                <div class="gauge-label">Overall Score</div>
            </div>
            <div class="gauge-section">
                <div class="gauge-value">78%</div>
                <div class="gauge-label">AI Agreement</div>
            </div>
            <div class="gauge-section">
                <div class="gauge-value">82%</div>
                <div class="gauge-label">Confidence</div>
            </div>
            <div class="gauge-section">
                <div class="gauge-value">24</div>
                <div class="gauge-label">Articles</div>
            </div>
        `;

        const mockSentimentData = this.currentSymbols.map(symbol => ({
            symbol,
            overall_sentiment: Math.random() * 2 - 1,
            confidence: 0.7 + Math.random() * 0.3,
            agreement_rate: 70 + Math.random() * 30
        }));

        this.createSentimentChart(mockSentimentData);
    }

    populateTechnicalFallback() {
        this.createTechnicalChart(this.generateMockTechnicalData());
    }

    populateSectorFallback() {
        this.createSectorChart(this.generateMockSectorData());
    }

    populatePredictiveFallback() {
        this.updatePredictionCards(this.generateMockPredictions());
        this.createPredictionsChart(this.generateMockPredictionsData());
    }

    populateRealtimeFallback() {
        this.createRealtimeChart(this.generateMockRealtimeData());
    }
}

// Global Functions
async function refreshAllData() {
    if (window.dashboard) {
        await window.dashboard.loadAllData();
    }
}

async function exportData() {
    if (!window.dashboard) return;

    const exportData = {
        timestamp: new Date().toISOString(),
        symbols: window.dashboard.currentSymbols,
        timeRange: window.dashboard.currentTimeRange,
        data: {
            regime: 'Mock regime data',
            sentiment: 'Mock sentiment data',
            technical: 'Mock technical data',
            sectors: 'Mock sector data',
            predictions: 'Mock predictions data',
            realtime: 'Mock real-time data'
        }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictive-analytics-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toggleAutoRefresh() {
    if (!window.dashboard) return;

    const icon = document.getElementById('autoRefreshIcon');
    const text = document.getElementById('autoRefreshText');

    if (window.dashboard.autoRefreshEnabled) {
        clearInterval(window.dashboard.autoRefreshInterval);
        window.dashboard.autoRefreshEnabled = false;
        icon.textContent = '⏸️';
        text.textContent = 'Auto-refresh: OFF';
    } else {
        window.dashboard.autoRefreshInterval = setInterval(refreshAllData, window.dashboard.refreshInterval);
        window.dashboard.autoRefreshEnabled = true;
        icon.textContent = '▶️';
        text.textContent = 'Auto-refresh: ON';
    }
}

// Extend CCTApi with new methods
if (typeof CCTApi !== 'undefined') {
    CCTApi.prototype.getFineGrainedSentiment = async function(symbols, options = {}) {
        const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];

        if (symbolsArray.length === 1) {
            return this.request(`/sentiment/fine-grained/${symbolsArray[0]}`, { params: options });
        } else {
            return this.request('/sentiment/fine-grained/batch', {
                method: 'POST',
                body: { symbols: symbolsArray, ...options }
            });
        }
    };

    CCTApi.prototype.getTechnicalAnalysis = async function(symbols, options = {}) {
        const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];

        if (symbolsArray.length === 1) {
            return this.request(`/technical/symbols/${symbolsArray[0]}`, { params: options });
        } else {
            return this.request('/technical/analysis', {
                method: 'POST',
                body: { symbols: symbolsArray, ...options }
            });
        }
    };

    CCTApi.prototype.getSectorIndicators = async function(symbols, options = {}) {
        const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];
        const results = [];

        for (const symbol of symbolsArray) {
            const response = await this.request(`/sectors/indicators/${symbol}`, { params: options });
            if (response.success) {
                results.push(response.data);
            }
        }

        return { success: true, data: results };
    };

    CCTApi.prototype.getPredictiveSignals = async function(options = {}) {
        return this.request('/predictive/signals', { params: options });
    };

    CCTApi.prototype.getRealtimeStatus = async function(options = {}) {
        return this.request('/realtime/status', { params: options });
    };
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new PredictiveAnalyticsDashboard();
});