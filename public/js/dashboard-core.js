/**
 * TFT Trading System Dashboard Core
 * Real-time data streaming and component management
 */

class DashboardCore {
    constructor(options = {}) {
        this.apiClient = null;
        this.sseConnection = null;
        this.isConnected = false;
        this.refreshInterval = 60000; // 1 minute default
        this.refreshTimer = null;
        this.widgets = new Map();
        this.settings = this.loadSettings();
        this.theme = this.settings.theme || 'light';
        this.alerts = [];
        this.maxAlerts = 50;

        // Initialize dashboard
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing TFT Dashboard...');

            // Initialize API client
            this.initApiClient();

            // Set up theme
            this.applyTheme(this.theme);

            // Set up event listeners
            this.setupEventListeners();

            // Connect to real-time data streams
            await this.connectRealtime();

            // Start auto-refresh
            this.startAutoRefresh();

            // Hide loading screen
            this.hideLoadingScreen();

            console.log('✅ Dashboard initialized successfully');

        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            this.showError('Failed to initialize dashboard: ' + error.message);
        }
    }

    /**
     * Initialize API client
     */
    initApiClient() {
        this.apiClient = new CCTApiClient({
            baseUrl: '/api/v1',
            enableCache: this.settings.useCache !== false,
            timeout: 30000
        });

        // Set API key if available
        if (this.settings.apiKey) {
            this.apiClient.setApiKey(this.settings.apiKey);
        }
    }

    /**
     * Connect to real-time data streams
     */
    async connectRealtime() {
        if (!this.settings.enableRealtime) {
            console.log('📡 Real-time streaming disabled');
            return;
        }

        try {
            console.log('📡 Connecting to real-time data streams...');

            // Check SSE support
            if (!window.EventSource) {
                throw new Error('Server-Sent Events not supported');
            }

            // Connect to SSE endpoint
            this.sseConnection = new EventSource('/api/v1/realtime/stream');

            // Set up event handlers
            this.sseConnection.onopen = () => {
                console.log('📡 Connected to real-time stream');
                this.isConnected = true;
                this.updateConnectionStatus(true);
            };

            this.sseConnection.onmessage = (event) => {
                this.handleRealtimeData(JSON.parse(event.data));
            };

            this.sseConnection.onerror = (error) => {
                console.error('📡 SSE connection error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);

                // Attempt to reconnect after delay
                setTimeout(() => {
                    if (this.settings.enableRealtime) {
                        this.connectRealtime();
                    }
                }, 5000);
            };

            // Set up specific event type handlers
            this.sseConnection.addEventListener('sentiment', (event) => {
                this.handleSentimentUpdate(JSON.parse(event.data));
            });

            this.sseConnection.addEventListener('market', (event) => {
                this.handleMarketUpdate(JSON.parse(event.data));
            });

            this.sseConnection.addEventListener('alert', (event) => {
                this.handleAlert(JSON.parse(event.data));
            });

            this.sseConnection.addEventListener('sector', (event) => {
                this.handleSectorUpdate(JSON.parse(event.data));
            });

        } catch (error) {
            console.error('❌ Failed to connect to real-time stream:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
        }
    }

    /**
     * Handle real-time data updates
     */
    handleRealtimeData(data) {
        const { type, payload, timestamp } = data;

        console.log(`📡 Real-time update: ${type}`, payload);

        switch (type) {
            case 'sentiment':
                this.updateSentimentData(payload);
                break;
            case 'market':
                this.updateMarketData(payload);
                break;
            case 'sector':
                this.updateSectorData(payload);
                break;
            case 'predictive':
                this.updatePredictiveData(payload);
                break;
            case 'alert':
                this.addAlert(payload);
                break;
            default:
                console.log(`📡 Unknown data type: ${type}`);
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshAllData());
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettingsModal());
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Window focus/blur events
        window.addEventListener('focus', () => {
            if (this.settings.enableRealtime && !this.isConnected) {
                this.connectRealtime();
            }
        });

        window.addEventListener('blur', () => {
            // Optional: Pause updates when window loses focus
        });

        // Visibility change for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAutoRefresh();
            } else {
                this.resumeAutoRefresh();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'r':
                        event.preventDefault();
                        this.refreshAllData();
                        break;
                    case 'd':
                        event.preventDefault();
                        this.toggleTheme();
                        break;
                    case 'f':
                        event.preventDefault();
                        this.toggleFullscreen();
                        break;
                }
            }
        });
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        if (this.refreshInterval <= 0) return;

        this.refreshTimer = setInterval(() => {
            if (!document.hidden) {
                this.refreshAllData();
            }
        }, this.refreshInterval);

        console.log(`⏰ Auto-refresh started: ${this.refreshInterval / 1000}s`);
    }

    /**
     * Pause auto-refresh
     */
    pauseAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log('⏸️ Auto-refresh paused');
        }
    }

    /**
     * Resume auto-refresh
     */
    resumeAutoRefresh() {
        if (!this.refreshTimer && this.refreshInterval > 0) {
            this.startAutoRefresh();
        }
    }

    /**
     * Refresh all dashboard data
     */
    async refreshAllData() {
        console.log('🔄 Refreshing dashboard data...');

        try {
            // Batch API requests for efficiency
            const refreshTasks = [
                () => this.refreshMarketOverview(),
                () => this.refreshSentimentData(),
                () => this.refreshSectorData(),
                () => this.refreshPredictiveData(),
                () => this.refreshMarketDrivers(),
                () => this.refreshAlerts()
            ];

            await Promise.all(refreshTasks.map(task => {
                return task().catch(error => {
                    console.error('Refresh task failed:', error);
                });
            }));

            console.log('✅ Dashboard data refreshed');

        } catch (error) {
            console.error('❌ Failed to refresh dashboard data:', error);
            this.showError('Failed to refresh data: ' + error.message);
        }
    }

    /**
     * Refresh market overview data
     */
    async refreshMarketOverview() {
        try {
            // Get market indices
            const response = await this.apiClient.getSystemHealth();

            if (response.success) {
                // Update indices (mock data for now)
                this.updateIndices({
                    sp500: { value: 4567.18, change: +1.23 },
                    nasdaq: { value: 14234.56, change: +2.45 },
                    dow: { value: 35678.90, change: -0.67 }
                });
            }
        } catch (error) {
            console.error('Failed to refresh market overview:', error);
        }
    }

    /**
     * Refresh sentiment data
     */
    async refreshSentimentData() {
        try {
            const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA'];
            const response = await this.apiClient.getSentimentAnalysis(symbols);

            if (response.success) {
                this.updateSentimentData(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh sentiment data:', error);
        }
    }

    /**
     * Refresh sector data
     */
    async refreshSectorData() {
        try {
            const response = await this.apiClient.getSectorSnapshot();

            if (response.success) {
                this.updateSectorData(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh sector data:', error);
        }
    }

    /**
     * Refresh predictive analytics data
     */
    async refreshPredictiveData() {
        try {
            const response = await this.apiClient.getPredictiveInsights();

            if (response.success) {
                this.updatePredictiveData(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh predictive data:', error);
        }
    }

    /**
     * Refresh market drivers data
     */
    async refreshMarketDrivers() {
        try {
            const response = await this.apiClient.getMarketDriversSnapshot();

            if (response.success) {
                this.updateMarketDrivers(response.data);
            }
        } catch (error) {
            console.error('Failed to refresh market drivers:', error);
        }
    }

    /**
     * Refresh alerts
     */
    async refreshAlerts() {
        try {
            // For now, alerts are handled via SSE
            this.updateAlertsDisplay();
        } catch (error) {
            console.error('Failed to refresh alerts:', error);
        }
    }

    /**
     * Update market indices display
     */
    updateIndices(indices) {
        const updateIndex = (id, data) => {
            const valueEl = document.getElementById(id + '-value');
            const changeEl = document.getElementById(id + '-change');

            if (valueEl) valueEl.textContent = data.value.toLocaleString();
            if (changeEl) {
                changeEl.textContent = `${data.change >= 0 ? '+' : ''}${data.change}%`;
                changeEl.className = `index-change ${data.change >= 0 ? 'positive' : data.change <= 0 ? 'negative' : 'neutral'}`;
            }
        };

        updateIndex('sp500', indices.sp500);
        updateIndex('nasdaq', indices.nasdaq);
        updateIndex('dow', indices.dow);
    }

    /**
     * Update sentiment data display
     */
    updateSentimentData(data) {
        // Update overall sentiment indicator
        const overallSentiment = document.getElementById('overall-sentiment');
        if (overallSentiment && data.overallSentiment) {
            overallSentiment.textContent = data.overallSentiment.label || 'Neutral';
            overallSentiment.className = `value sentiment-indicator ${data.overallSentiment.sentiment || 'neutral'}`;
        }

        // Update sentiment chart if available
        this.updateSentimentChart(data);

        // Trigger widget refresh
        this.refreshWidget('sentiment-chart');
    }

    /**
     * Update sector data display
     */
    updateSectorData(data) {
        if (data.sectors) {
            this.renderSectorHeatmap(data.sectors);
        }

        this.refreshWidget('sector-heatmap');
    }

    /**
     * Update predictive analytics display
     */
    updatePredictiveData(data) {
        // Update confidence gauge
        if (data.confidence !== undefined) {
            this.updateConfidenceGauge(data.confidence);
        }

        // Update market direction
        if (data.direction) {
            this.updateMarketDirection(data.direction);
        }

        // Update risk level
        if (data.riskLevel) {
            this.updateRiskLevel(data.riskLevel);
        }

        this.refreshWidget('predictive-analytics');
    }

    /**
     * Update market drivers display
     */
    updateMarketDrivers(data) {
        const driversGrid = document.getElementById('drivers-grid');
        if (!driversGrid || !data.drivers) return;

        driversGrid.innerHTML = data.drivers.map(driver => `
            <div class="driver-item">
                <div class="driver-label">${driver.label}</div>
                <div class="driver-value ${driver.impact}">${driver.value}</div>
            </div>
        `).join('');

        this.refreshWidget('market-drivers');
    }

    /**
     * Update confidence gauge
     */
    updateConfidenceGauge(confidence) {
        const gauge = document.getElementById('confidence-gauge');
        if (!gauge) return;

        const fill = gauge.querySelector('.gauge-fill');
        const text = gauge.querySelector('.gauge-text');

        if (fill && text) {
            const percentage = Math.round(confidence * 100);
            fill.style.width = `${percentage}%`;
            text.textContent = `${percentage}%`;
        }
    }

    /**
     * Update market direction indicator
     */
    updateMarketDirection(direction) {
        const indicator = document.getElementById('market-direction');
        if (!indicator) return;

        const icon = indicator.querySelector('.direction-icon');
        const text = indicator.querySelector('.direction-text');

        if (icon && text) {
            const icons = {
                bullish: '📈',
                bearish: '📉',
                neutral: '➡️'
            };

            icon.textContent = icons[direction] || '➡️';
            text.textContent = direction.charAt(0).toUpperCase() + direction.slice(1);
        }
    }

    /**
     * Update risk level indicator
     */
    updateRiskLevel(riskLevel) {
        const indicator = document.getElementById('risk-level');
        if (!indicator) return;

        const text = indicator.querySelector('.risk-text');
        if (text) {
            text.textContent = riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1);
            indicator.className = `risk-indicator ${riskLevel}`;
        }
    }

    /**
     * Add new alert
     */
    addAlert(alert) {
        if (!this.settings.enableAlerts) return;

        const alertWithTimestamp = {
            ...alert,
            id: Date.now(),
            timestamp: new Date().toISOString()
        };

        this.alerts.unshift(alertWithTimestamp);

        // Limit alerts count
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(0, this.maxAlerts);
        }

        // Show alert banner for high-priority alerts
        if (alert.priority === 'high') {
            this.showAlertBanner(alert.message);
        }

        this.updateAlertsDisplay();
    }

    /**
     * Update alerts display
     */
    updateAlertsDisplay() {
        const alertsList = document.getElementById('alerts-list');
        if (!alertsList) return;

        if (this.alerts.length === 0) {
            alertsList.innerHTML = '<div class="no-alerts">No active alerts</div>';
            return;
        }

        alertsList.innerHTML = this.alerts.slice(0, 10).map(alert => `
            <div class="alert-item ${alert.priority}">
                <span class="alert-icon">${this.getAlertIcon(alert.priority)}</span>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-description">${alert.message}</div>
                    <div class="alert-time">${this.formatTime(alert.timestamp)}</div>
                </div>
            </div>
        `).join('');

        this.refreshWidget('real-time-alerts');
    }

    /**
     * Get alert icon based on priority
     */
    getAlertIcon(priority) {
        const icons = {
            high: '🚨',
            medium: '⚠️',
            low: 'ℹ️'
        };
        return icons[priority] || 'ℹ️';
    }

    /**
     * Show alert banner
     */
    showAlertBanner(message) {
        const banner = document.getElementById('alert-banner');
        const messageEl = document.getElementById('alert-message');

        if (banner && messageEl) {
            messageEl.textContent = message;
            banner.style.display = 'block';

            // Auto-hide after 10 seconds
            setTimeout(() => {
                this.hideAlertBanner();
            }, 10000);
        }
    }

    /**
     * Hide alert banner
     */
    hideAlertBanner() {
        const banner = document.getElementById('alert-banner');
        if (banner) {
            banner.style.display = 'none';
        }
    }

    /**
     * Render sector heatmap
     */
    renderSectorHeatmap(sectors) {
        const heatmap = document.getElementById('sector-heatmap');
        if (!heatmap) return;

        heatmap.innerHTML = sectors.map(sector => {
            const changeClass = sector.change >= 0 ? 'positive' : sector.change <= 0 ? 'negative' : 'neutral';
            return `
                <div class="sector-cell ${changeClass}">
                    <div class="sector-name">${sector.symbol}</div>
                    <div class="sector-value">${sector.price?.toFixed(2) || '--'}</div>
                    <div class="sector-change">${sector.change >= 0 ? '+' : ''}${sector.change?.toFixed(2) || '--'}%</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Update sentiment chart
     */
    updateSentimentChart(data) {
        // This will be implemented in the charts module
        if (window.dashboardCharts) {
            window.dashboardCharts.updateSentimentChart(data);
        }
    }

    /**
     * Update connection status
     */
    updateConnectionStatus(connected) {
        const status = document.getElementById('connection-status');
        if (!status) return;

        const dot = status.querySelector('.status-dot');
        const text = status.lastChild;

        if (connected) {
            dot.className = 'status-dot connected';
            text.textContent = ' Connected';
        } else {
            dot.className = 'status-dot disconnected';
            text.textContent = ' Disconnected';
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.theme);
        this.saveSettings();
    }

    /**
     * Apply theme
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.icon');
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Open settings modal
     */
    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('active');
            this.populateSettingsForm();
        }
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Populate settings form
     */
    populateSettingsForm() {
        const form = document.getElementById('settings-form');
        if (!form) return;

        // Set refresh interval
        const refreshInterval = document.getElementById('refresh-interval');
        if (refreshInterval) {
            refreshInterval.value = this.refreshInterval / 1000;
        }

        // Set checkboxes
        const enableAlerts = document.getElementById('enable-alerts');
        if (enableAlerts) {
            enableAlerts.checked = this.settings.enableAlerts !== false;
        }

        const useCache = document.getElementById('use-cache');
        if (useCache) {
            useCache.checked = this.settings.useCache !== false;
        }

        const enableRealtime = document.getElementById('enable-realtime');
        if (enableRealtime) {
            enableRealtime.checked = this.settings.enableRealtime !== false;
        }

        const alertThreshold = document.getElementById('alert-threshold');
        if (alertThreshold) {
            alertThreshold.value = this.settings.alertThreshold || 70;
        }
    }

    /**
     * Save settings
     */
    saveSettings() {
        const refreshInterval = document.getElementById('refresh-interval');
        const enableAlerts = document.getElementById('enable-alerts');
        const useCache = document.getElementById('use-cache');
        const enableRealtime = document.getElementById('enable-realtime');
        const alertThreshold = document.getElementById('alert-threshold');

        // Update settings
        if (refreshInterval) {
            this.refreshInterval = parseInt(refreshInterval.value) * 1000;
            this.settings.refreshInterval = this.refreshInterval;
        }

        if (enableAlerts) {
            this.settings.enableAlerts = enableAlerts.checked;
        }

        if (useCache) {
            this.settings.useCache = useCache.checked;
        }

        if (enableRealtime) {
            this.settings.enableRealtime = enableRealtime.checked;
        }

        if (alertThreshold) {
            this.settings.alertThreshold = parseInt(alertThreshold.value);
        }

        this.settings.theme = this.theme;

        // Save to localStorage
        localStorage.setItem('dashboard-settings', JSON.stringify(this.settings));

        // Restart auto-refresh with new interval
        this.pauseAutoRefresh();
        this.startAutoRefresh();

        // Reconnect to real-time stream if setting changed
        if (this.settings.enableRealtime && !this.isConnected) {
            this.connectRealtime();
        } else if (!this.settings.enableRealtime && this.sseConnection) {
            this.sseConnection.close();
        }

        this.closeModal('settings-modal');
        console.log('✅ Settings saved');
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const saved = localStorage.getItem('dashboard-settings');
        return saved ? JSON.parse(saved) : {
            theme: 'light',
            refreshInterval: 60000,
            enableAlerts: true,
            useCache: true,
            enableRealtime: true,
            alertThreshold: 70
        };
    }

    /**
     * Refresh specific widget
     */
    refreshWidget(widgetId) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (widget) {
            // Add visual feedback
            widget.classList.add('refreshing');
            setTimeout(() => {
                widget.classList.remove('refreshing');
            }, 1000);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('Dashboard Error:', message);
        this.showAlertBanner(`Error: ${message}`);
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    /**
     * Format time for display
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return 'Just now';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}m ago`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Cleanup on page unload
     */
    cleanup() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }

        if (this.sseConnection) {
            this.sseConnection.close();
        }

        console.log('🧹 Dashboard cleaned up');
    }
}

// Global function for dismissing alerts
function dismissAlert() {
    if (window.dashboard) {
        window.dashboard.hideAlertBanner();
    }
}

// Global function for closing modals
function closeModal(modalId) {
    if (window.dashboard) {
        window.dashboard.closeModal(modalId);
    }
}

// Global function for saving settings
function saveSettings() {
    if (window.dashboard) {
        window.dashboard.saveSettings();
    }
}

// Global function for refreshing widgets
function refreshWidget(widgetId) {
    if (window.dashboard) {
        window.dashboard.refreshWidget(widgetId);
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardCore();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.dashboard) {
            window.dashboard.cleanup();
        }
    });
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardCore;
}