// Shared Navigation Component - Left Sidebar
(function() {
    const navHTML = `
    <button class="mobile-nav-toggle" aria-label="Toggle navigation" type="button">
        ☰
    </button>
    <nav class="dashboard-navigation">
        <div class="nav-brand">
            <h1>CCT Trading System</h1>
        </div>

        <div class="nav-menu">
            <div class="nav-group">
                <a href="/dashboard.html" class="nav-item" data-page="dashboard">
                    <span class="nav-icon">📈</span>
                    <span class="nav-text">Dashboard</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">Reports</div>
                <a href="/pre-market-briefing" class="nav-item" data-page="pre-market">
                    <span class="nav-icon">🌅</span>
                    <span class="nav-text">Pre-Market</span>
                </a>
                <a href="/intraday-check" class="nav-item" data-page="intraday">
                    <span class="nav-icon">📊</span>
                    <span class="nav-text">Intraday</span>
                </a>
                <a href="/end-of-day-summary" class="nav-item" data-page="end-of-day">
                    <span class="nav-icon">🌆</span>
                    <span class="nav-text">End-of-Day</span>
                </a>
                <a href="/weekly-review" class="nav-item" data-page="weekly">
                    <span class="nav-icon">📋</span>
                    <span class="nav-text">Weekly</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">Portfolio</div>
                <a href="/portfolio-breakdown.html" class="nav-item" data-page="breakdown">
                    <span class="nav-icon">📊</span>
                    <span class="nav-text">Breakdown</span>
                </a>
                <a href="/portfolio-optimization-dashboard.html" class="nav-item" data-page="portfolio">
                    <span class="nav-icon">💼</span>
                    <span class="nav-text">Optimization</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">System</div>
                <a href="/system-status" class="nav-item" data-page="status">
                    <span class="nav-icon">🔍</span>
                    <span class="nav-text">Status</span>
                </a>
                <a href="/test-api.html" class="nav-item" data-page="api">
                    <span class="nav-icon">🧪</span>
                    <span class="nav-text">API Test</span>
                </a>
            </div>
        </div>

        <div class="nav-controls">
            <button class="api-status connected" id="nav-api-status" title="API Status">
                <span class="status-dot"></span>
                <span class="status-text">System Connected</span>
            </button>
        </div>
    </nav>`;

    function normalizePath(path) {
        if (path === '/') return '/dashboard.html';
        return path.replace(/\/$/, '');
    }

    function initNav() {
        // Insert nav at start of body
        document.body.insertAdjacentHTML('afterbegin', navHTML);
        document.body.classList.add('has-nav');

        // Set active state based on current page
        const path = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        const currentPath = normalizePath(path);

        navItems.forEach(item => {
            const itemPath = normalizePath(item.getAttribute('href') || '');
            if (currentPath === itemPath) {
                item.classList.add('active');
            }

            // Close nav on mobile after selection
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    document.querySelector('.dashboard-navigation')?.classList.remove('open');
                }
            });
        });

        // Mobile toggle behavior
        const toggle = document.querySelector('.mobile-nav-toggle');
        const nav = document.querySelector('.dashboard-navigation');
        if (toggle && nav) {
            toggle.addEventListener('click', () => {
                nav.classList.toggle('open');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNav);
    } else {
        initNav();
    }
})();
