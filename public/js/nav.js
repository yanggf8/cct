// Shared Navigation Component
(function() {
    const navHTML = `
    <nav class="dashboard-navigation">
        <div class="nav-brand">
            <h1>CCT Trading System</h1>
        </div>
        <div class="nav-menu">
            <a href="/dashboard.html" class="nav-item" data-page="dashboard">
                <span class="nav-icon">📈</span>
                <span class="nav-text">Dashboard</span>
            </a>
            <a href="/predictive-analytics.html" class="nav-item" data-page="predictive">
                <span class="nav-icon">🔮</span>
                <span class="nav-text">Predictive</span>
            </a>
            <a href="/backtesting-dashboard.html" class="nav-item" data-page="backtesting">
                <span class="nav-icon">📉</span>
                <span class="nav-text">Backtesting</span>
            </a>
            <a href="/portfolio-optimization-dashboard.html" class="nav-item" data-page="portfolio">
                <span class="nav-icon">💼</span>
                <span class="nav-text">Portfolio</span>
            </a>
            <a href="/risk-dashboard.html" class="nav-item" data-page="risk">
                <span class="nav-icon">⚠️</span>
                <span class="nav-text">Risk</span>
            </a>
            <a href="/bi-dashboard.html" class="nav-item" data-page="bi">
                <span class="nav-icon">📊</span>
                <span class="nav-text">BI</span>
            </a>
            <a href="/test-api.html" class="nav-item" data-page="api">
                <span class="nav-icon">🧪</span>
                <span class="nav-text">API</span>
            </a>
        </div>
        <div class="nav-controls">
            <button class="api-status connected" id="nav-api-status" title="API Status">
                <span class="status-dot"></span>
                <span class="status-text">Connected</span>
            </button>
        </div>
    </nav>`;

    function initNav() {
        // Insert nav at start of body
        document.body.insertAdjacentHTML('afterbegin', navHTML);
        document.body.classList.add('has-nav');

        // Set active state based on current page
        const path = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.getAttribute('href') === path) {
                item.classList.add('active');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNav);
    } else {
        initNav();
    }
})();
