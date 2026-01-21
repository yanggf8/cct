// Shared Navigation Component - Left Sidebar
// API key is loaded from sessionStorage (set via Settings page)
// No hardcoded API key - user must configure via Settings
window.CCT_API_KEY = sessionStorage.getItem('cct_api_key') || '';

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
                <div class="nav-group-title">Today's Reports</div>
                <a href="/pre-market-briefing" class="nav-item nav-today" data-page="pre-market" data-base="/pre-market-briefing">
                    <span class="nav-icon">🌅</span>
                    <span class="nav-text">Pre-Market</span>
                </a>
                <a href="/intraday-check" class="nav-item nav-today" data-page="intraday" data-base="/intraday-check">
                    <span class="nav-icon">📊</span>
                    <span class="nav-text">Intraday</span>
                </a>
                <a href="/end-of-day-summary" class="nav-item nav-today" data-page="end-of-day" data-base="/end-of-day-summary">
                    <span class="nav-icon">🌆</span>
                    <span class="nav-text">End-of-Day</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">Yesterday's Reports</div>
                <a href="/pre-market-briefing" class="nav-item nav-yesterday" data-page="pre-market-yesterday" data-base="/pre-market-briefing">
                    <span class="nav-icon">🌅</span>
                    <span class="nav-text">Pre-Market</span>
                </a>
                <a href="/intraday-check" class="nav-item nav-yesterday" data-page="intraday-yesterday" data-base="/intraday-check">
                    <span class="nav-icon">📊</span>
                    <span class="nav-text">Intraday</span>
                </a>
                <a href="/end-of-day-summary" class="nav-item nav-yesterday" data-page="end-of-day-yesterday" data-base="/end-of-day-summary">
                    <span class="nav-icon">🌆</span>
                    <span class="nav-text">End-of-Day</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">Weekly</div>
                <a href="/weekly-review" class="nav-item" data-page="weekly">
                    <span class="nav-icon">📋</span>
                    <span class="nav-text">This Week</span>
                </a>
                <a href="/weekly-review?week=last" class="nav-item" data-page="weekly-last">
                    <span class="nav-icon">📊</span>
                    <span class="nav-text">Last Week</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">System</div>
                <a href="/system-status" class="nav-item" data-page="status">
                    <span class="nav-icon">🔍</span>
                    <span class="nav-text">Status</span>
                </a>
                <a href="/portfolio-breakdown.html" class="nav-item" data-page="portfolio">
                    <span class="nav-icon">📊</span>
                    <span class="nav-text">Portfolio</span>
                </a>
                <a href="/test-api.html" class="nav-item" data-page="api">
                    <span class="nav-icon">🧪</span>
                    <span class="nav-text">API Test</span>
                </a>
                <a href="/settings.html" class="nav-item" data-page="settings">
                    <span class="nav-icon">⚙️</span>
                    <span class="nav-text">Settings</span>
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

    // NOTE: We use semantic date values (no date param for "today", ?date=yesterday for yesterday)
    // instead of computing local dates, because the server uses ET (Eastern Time) for all date logic.
    // Using local timezone dates could cause mismatches for users outside ET.

    function initNav() {
        // Insert nav at start of body
        document.body.insertAdjacentHTML('afterbegin', navHTML);
        document.body.classList.add('has-nav');

        // "Today" links: no date param - server defaults to ET today
        document.querySelectorAll('.nav-today').forEach(link => {
            const basePath = link.getAttribute('data-base');
            if (basePath) {
                link.setAttribute('href', basePath);  // No ?date= param - server uses ET today
            }
        });

        // "Yesterday" links: use semantic ?date=yesterday which server interprets in ET
        document.querySelectorAll('.nav-yesterday').forEach(link => {
            const basePath = link.getAttribute('data-base');
            if (basePath) {
                link.setAttribute('href', `${basePath}?date=yesterday`);
            }
        });

        // Set active state based on current page
        const path = window.location.pathname;
        const search = window.location.search;
        const navItems = document.querySelectorAll('.nav-item');
        const currentPath = normalizePath(path);

        // Get URL parameters
        const urlParams = new URLSearchParams(search);
        const dateParam = urlParams.get('date');
        const weekParam = urlParams.get('week');

        // Check context - compare with user's local dates (reuse todayDate/yesterdayDate from above)
        const isYesterday = dateParam === yesterdayDate;
        const isToday = !dateParam || dateParam === todayDate;
        const isLastWeek = weekParam === 'last';

        navItems.forEach(item => {
            const href = item.getAttribute('href') || '';
            const [itemPath, itemSearch] = href.split('?');
            const normalizedItemPath = normalizePath(itemPath);

            // Only match if paths are the same
            if (currentPath !== normalizedItemPath) return;

            // Parse item parameters
            const itemParams = new URLSearchParams(itemSearch || '');
            const itemHasLastWeek = itemParams.get('week') === 'last';
            const itemIsToday = item.classList.contains('nav-today');
            const itemIsYesterday = item.classList.contains('nav-yesterday');

            // Determine if this item should be active
            let shouldBeActive = false;

            // Daily reports: match yesterday/today based on date param
            if (currentPath === '/pre-market-briefing' || currentPath === '/intraday-check' || currentPath === '/end-of-day-summary') {
                shouldBeActive = (isYesterday && itemIsYesterday) || (isToday && itemIsToday);
            }
            // Weekly reports: match last week/this week
            else if (currentPath === '/weekly-review') {
                shouldBeActive = (isLastWeek && itemHasLastWeek) || (!isLastWeek && !itemHasLastWeek);
            }
            // Other pages: simple path match
            else {
                shouldBeActive = true;
            }

            if (shouldBeActive) {
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
