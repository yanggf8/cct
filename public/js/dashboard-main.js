// SECURITY: Hardcoded API keys removed for security
/**
 * TFT Trading System Dashboard Main
 * Entry point and coordination of all dashboard components
 */

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 TFT Trading System Dashboard Starting...');

    try {
        // Initialize the core dashboard
        const dashboard = new DashboardCore();

        // Make dashboard globally available
        window.dashboard = dashboard;

        // Initialize market clock
        initializeMarketClock();

        // Initialize market status monitoring
        initializeMarketStatusMonitoring();

        // Initialize keyboard shortcuts
        initializeKeyboardShortcuts();

        // Initialize responsive behavior
        initializeResponsiveBehavior();

        console.log('✅ Dashboard loaded successfully');

        // Show welcome message for first-time users
        if (!localStorage.getItem('dashboard-visited')) {
            showWelcomeMessage();
            localStorage.setItem('dashboard-visited', 'true');
        }

    } catch (error) {
        console.error('❌ Failed to initialize dashboard:', error);
        showFatalError(error.message);
    }
});

/**
 * Initialize market clock
 */
function initializeMarketClock() {
    const clockTime = document.querySelector('.clock-time');
    const clockDate = document.querySelector('.clock-date');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');

    function updateClock() {
        const now = new Date();

        if (clockTime) {
            clockTime.textContent = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }

        if (clockDate) {
            clockDate.textContent = now.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }

        // Update market status
        updateMarketStatus(now, statusIndicator, statusText);
    }

    // Update immediately and then every second
    updateClock();
    setInterval(updateClock, 1000);
}

/**
 * Update market status based on current time
 */
function updateMarketStatus(now, indicator, text) {
    if (!indicator || !text) return;

    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Weekend
    if (day === 0 || day === 6) {
        indicator.className = 'status-indicator closed';
        text.textContent = 'Weekend';
        return;
    }

    // Pre-market (4:00 AM - 9:30 AM ET)
    if (hours >= 4 && (hours < 9 || (hours === 9 && minutes < 30))) {
        indicator.className = 'status-indicator pre-market';
        text.textContent = 'Pre-Market';
        return;
    }

    // Market hours (9:30 AM - 4:00 PM ET)
    if ((hours > 9 || (hours === 9 && minutes >= 30)) && hours < 16) {
        indicator.className = 'status-indicator open';
        text.textContent = 'Market Open';
        return;
    }

    // After-hours (4:00 PM - 8:00 PM ET)
    if (hours >= 16 && hours < 20) {
        indicator.className = 'status-indicator pre-market';
        text.textContent = 'After Hours';
        return;
    }

    // Closed
    indicator.className = 'status-indicator closed';
    text.textContent = 'Market Closed';
}

/**
 * Initialize market status monitoring
 */
function initializeMarketStatusMonitoring() {
    // Update market regime, VIX, and overall sentiment
    async function updateMarketIndicators() {
        try {
            if (!window.dashboard || !window.dashboard.apiClient) return;

            // Update market regime
            const regimeResponse = await window.dashboard.apiClient.getMarketRegime();
            if (regimeResponse.success && regimeResponse.data) {
                updateRegimeIndicator(regimeResponse.data);
            }

            // Update VIX (mock data for now)
            updateVIXIndicator(18.47 + Math.random() * 4 - 2);

            // Update overall sentiment (mock data for now)
            const sentiments = ['Bullish', 'Neutral', 'Bearish'];
            const sentimentClasses = ['positive', 'neutral', 'negative'];
            const randomIndex = Math.floor(Math.random() * sentiments.length);
            updateSentimentIndicator(sentiments[randomIndex], sentimentClasses[randomIndex]);

        } catch (error) {
            console.error('Failed to update market indicators:', error);
        }
    }

    // Update immediately and then every 30 seconds
    updateMarketIndicators();
    setInterval(updateMarketIndicators, 30000);
}

/**
 * Update regime indicator
 */
function updateRegimeIndicator(data) {
    const regimeIndicator = document.getElementById('regime-indicator');
    if (!regimeIndicator) return;

    const regime = data.regime || 'Neutral';
    const confidence = data.confidence || 0.5;

    regimeIndicator.textContent = regime;
    regimeIndicator.className = `value regime-indicator ${regime.toLowerCase()}`;

    // Add confidence indicator
    if (confidence) {
        regimeIndicator.title = `Confidence: ${Math.round(confidence * 100)}%`;
    }
}

/**
 * Update VIX indicator
 */
function updateVIXIndicator(value) {
    const vixValue = document.getElementById('vix-value');
    if (!vixValue) return;

    vixValue.textContent = value.toFixed(2);

    // Update color based on VIX level
    vixValue.className = 'value volatility-indicator';
    if (value > 30) {
        vixValue.classList.add('high');
    } else if (value < 15) {
        vixValue.classList.add('low');
    }
}

/**
 * Update sentiment indicator
 */
function updateSentimentIndicator(sentiment, sentimentClass) {
    const overallSentiment = document.getElementById('overall-sentiment');
    if (!overallSentiment) return;

    overallSentiment.textContent = sentiment;
    overallSentiment.className = `value sentiment-indicator ${sentimentClass}`;
}

/**
 * Initialize keyboard shortcuts
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Ignore when typing in inputs
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'r':
                    event.preventDefault();
                    if (window.dashboard) {
                        window.dashboard.refreshAllData();
                    }
                    break;
                case 'd':
                    event.preventDefault();
                    if (window.dashboard) {
                        window.dashboard.toggleTheme();
                    }
                    break;
                case 'f':
                    event.preventDefault();
                    if (window.dashboard) {
                        window.dashboard.toggleFullscreen();
                    }
                    break;
                case 's':
                    event.preventDefault();
                    if (window.dashboard) {
                        window.dashboard.openSettingsModal();
                    }
                    break;
            }
        }

        // Single key shortcuts
        switch (event.key) {
            case 'Escape':
                // Close any open modals
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
                break;
            case '?':
                event.preventDefault();
                showHelpModal();
                break;
        }
    });
}

/**
 * Initialize responsive behavior
 */
function initializeResponsiveBehavior() {
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Resize charts
            if (window.dashboardCharts) {
                window.dashboardCharts.resizeCharts();
            }

            // Update responsive classes
            updateResponsiveClasses();
        }, 250);
    });

    // Initial responsive update
    updateResponsiveClasses();
}

/**
 * Update responsive classes based on screen size
 */
function updateResponsiveClasses() {
    const width = window.innerWidth;
    const body = document.body;

    // Remove existing responsive classes
    body.classList.remove('mobile', 'tablet', 'desktop', 'large-desktop');

    // Add appropriate class
    if (width < 768) {
        body.classList.add('mobile');
    } else if (width < 1024) {
        body.classList.add('tablet');
    } else if (width < 1440) {
        body.classList.add('desktop');
    } else {
        body.classList.add('large-desktop');
    }
}

/**
 * Show welcome message
 */
function showWelcomeMessage() {
    const welcomeHtml = `
        <div class="modal active" id="welcome-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🎉 Welcome to TFT Trading System</h2>
                    <button class="modal-close" onclick="closeModal('welcome-modal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="welcome-content">
                        <h3>Real-Time Market Intelligence Dashboard</h3>
                        <p>Your professional trading dashboard provides:</p>
                        <ul>
                            <li>📊 Real-time market data and analytics</li>
                            <li>🧠 AI-powered sentiment analysis</li>
                            <li>📈 Sector rotation monitoring</li>
                            <li>🎯 Predictive analytics insights</li>
                            <li>⚠️ Customizable alert system</li>
                        </ul>
                        <h4>Quick Start Tips:</h4>
                        <ul>
                            <li><strong>Ctrl+R</strong> - Refresh all data</li>
                            <li><strong>Ctrl+D</strong> - Toggle dark/light theme</li>
                            <li><strong>Ctrl+F</strong> - Toggle fullscreen</li>
                            <li><strong>Ctrl+S</strong> - Open settings</li>
                            <li><strong>?</strong> - Show help</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="closeModal('welcome-modal')">Get Started</button>
                    <button class="btn-secondary" onclick="showHelpModal()">View Help</button>
                </div>
            </div>
        </div>
    `;

    // Add welcome modal to body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = welcomeHtml;
    document.body.appendChild(tempDiv.firstElementChild);
}

/**
 * Show help modal
 */
function showHelpModal() {
    const helpHtml = `
        <div class="modal active" id="help-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📚 Dashboard Help</h2>
                    <button class="modal-close" onclick="closeModal('help-modal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="help-content">
                        <h3>Keyboard Shortcuts</h3>
                        <div class="shortcut-list">
                            <div class="shortcut-item">
                                <kbd>Ctrl</kbd> + <kbd>R</kbd>
                                <span>Refresh all data</span>
                            </div>
                            <div class="shortcut-item">
                                <kbd>Ctrl</kbd> + <kbd>D</kbd>
                                <span>Toggle dark/light theme</span>
                            </div>
                            <div class="shortcut-item">
                                <kbd>Ctrl</kbd> + <kbd>F</kbd>
                                <span>Toggle fullscreen</span>
                            </div>
                            <div class="shortcut-item">
                                <kbd>Ctrl</kbd> + <kbd>S</kbd>
                                <span>Open settings</span>
                            </div>
                            <div class="shortcut-item">
                                <kbd>Esc</kbd>
                                <span>Close modal</span>
                            </div>
                            <div class="shortcut-item">
                                <kbd>?</kbd>
                                <span>Show help</span>
                            </div>
                        </div>

                        <h3>Dashboard Features</h3>
                        <ul>
                            <li><strong>Market Overview:</strong> Real-time indices and market status</li>
                            <li><strong>Predictive Analytics:</strong> AI-driven confidence scores and forecasts</li>
                            <li><strong>Sentiment Analysis:</strong> Market sentiment trends and patterns</li>
                            <li><strong>Sector Heatmap:</strong> Sector performance and rotation analysis</li>
                            <li><strong>Market Drivers:</strong> Key economic and geopolitical factors</li>
                            <li><strong>Technical Analysis:</strong> Price charts and technical indicators</li>
                            <li><strong>Real-Time Alerts:</strong> Customizable alerts and notifications</li>
                        </ul>

                        <h3>Troubleshooting</h3>
                        <ul>
                            <li>If data isn't updating, check your internet connection</li>
                            <li>Refresh the page (Ctrl+R) if dashboard becomes unresponsive</li>
                            <li>Clear browser cache if experiencing performance issues</li>
                            <li>Disable ad blockers that might interfere with data loading</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="closeModal('help-modal')">Got it</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing help modal if present
    const existingModal = document.getElementById('help-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add help modal to body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = helpHtml;
    document.body.appendChild(tempDiv.firstElementChild);
}

/**
 * Show fatal error message
 */
function showFatalError(message) {
    const errorHtml = `
        <div class="modal active" id="error-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>❌ Dashboard Error</h2>
                </div>
                <div class="modal-body">
                    <div class="error-content">
                        <p>Failed to initialize the TFT Trading System Dashboard:</p>
                        <div class="error-message">${message}</div>
                        <p>Please try the following:</p>
                        <ul>
                            <li>Refresh the page</li>
                            <li>Check your internet connection</li>
                            <li>Try again in a few minutes</li>
                            <li>Contact support if the problem persists</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="window.location.reload()">Refresh Page</button>
                </div>
            </div>
        </div>
    `;

    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    // Add error modal to body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = errorHtml;
    document.body.appendChild(tempDiv.firstElementChild);
}

// Performance monitoring
if (window.performance && window.performance.timing) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
            console.log(`📊 Dashboard load time: ${loadTime}ms`);
        }, 0);
    });
}

// Service Worker registration for offline support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Comment out service worker for now as it's not needed for this demo
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}

// Export functions for global access
window.showHelpModal = showHelpModal;
window.showWelcomeMessage = showWelcomeMessage;