// Shared Navigation Component - Left Sidebar
// API key is loaded from sessionStorage (set via Settings page)
// No hardcoded API key - user must configure via Settings
window.CCT_API_KEY = sessionStorage.getItem('cct_api_key') || '';

(function() {
    // Status icons mapping
    const STATUS_ICONS = {
        success: '\u2705',   // ✅
        partial: '\u26A0\uFE0F', // ⚠️
        failed: '\u274C',    // ❌
        running: '\uD83D\uDD04', // 🔄
        missed: '\u26AA',    // ⚪
        'n/a': '\u2796'      // ➖
    };

    // Tooltips for status icons
    const STATUS_TOOLTIPS = {
        success: 'Completed successfully',
        partial: 'Completed with warnings',
        failed: 'Job failed',
        running: 'Currently running',
        missed: 'Job never started (post-cutover)',
        'n/a': 'No data (pre-cutover)'
    };

    // Report type icons
    const REPORT_ICONS = {
        'pre-market': '\uD83C\uDF05', // 🌅
        'intraday': '\uD83D\uDCCA',   // 📊
        'end-of-day': '\uD83C\uDF06'  // 🌆
    };

    // Base nav HTML (Reports section will be dynamically populated)
    const navHTML = `
    <button class="mobile-nav-toggle" aria-label="Toggle navigation" type="button">
        \u2630
    </button>
    <nav class="dashboard-navigation">
        <div class="nav-brand">
            <h1>CCT Trading System</h1>
        </div>

        <div class="nav-menu">
            <div class="nav-group">
                <a href="/dashboard.html" class="nav-item" data-page="dashboard">
                    <span class="nav-icon">\uD83D\uDCC8</span>
                    <span class="nav-text">Dashboard</span>
                </a>
            </div>

            <div class="nav-group" id="nav-reports-group">
                <div class="nav-group-title nav-expandable" data-target="reports-content">
                    <span>\uD83D\uDCCA Reports</span>
                    <span class="nav-expand-icon">\u25BC</span>
                </div>
                <div class="nav-expandable-content" id="reports-content">
                    <div class="nav-loading">Loading...</div>
                </div>
            </div>

            <div class="nav-group">
                <a href="/weekly-review" class="nav-item" data-page="weekly">
                    <span class="nav-icon">\uD83D\uDCCB</span>
                    <span class="nav-text">Weekly Review</span>
                </a>
            </div>

            <div class="nav-group">
                <div class="nav-group-title">System</div>
                <a href="/system-status" class="nav-item" data-page="status">
                    <span class="nav-icon">\uD83D\uDD0D</span>
                    <span class="nav-text">Status</span>
                </a>
                <a href="/portfolio-breakdown.html" class="nav-item" data-page="portfolio">
                    <span class="nav-icon">\uD83D\uDCCA</span>
                    <span class="nav-text">Portfolio</span>
                </a>
                <a href="/test-api.html" class="nav-item" data-page="api">
                    <span class="nav-icon">\uD83E\uDDEA</span>
                    <span class="nav-text">API Test</span>
                </a>
                <a href="/settings.html" class="nav-item" data-page="settings">
                    <span class="nav-icon">\u2699\uFE0F</span>
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

    // Render status icon with tooltip
    function renderStatusIcon(status, errors) {
        const icon = STATUS_ICONS[status] || STATUS_ICONS['n/a'];
        let tooltip = STATUS_TOOLTIPS[status] || '';
        if (errors && errors.length > 0) {
            tooltip = errors.join(', ');
        }
        return `<span class="status-icon" title="${tooltip}">${icon}</span>`;
    }

    // Render a single date's reports
    function renderDateReports(date, dateData, isExpanded) {
        const label = dateData.label || date;
        const expandedClass = isExpanded ? 'expanded' : '';
        const contentStyle = isExpanded ? '' : 'style="display: none;"';

        const reports = ['pre-market', 'intraday', 'end-of-day'].map(reportType => {
            const reportData = dateData[reportType] || { status: 'n/a' };
            const statusIcon = renderStatusIcon(reportData.status, reportData.errors);
            const icon = REPORT_ICONS[reportType];
            const displayName = reportType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
            const href = `/${reportType === 'pre-market' ? 'pre-market-briefing' : reportType === 'intraday' ? 'intraday-check' : 'end-of-day-summary'}?date=${date}`;

            return `
                <a href="${href}" class="nav-item nav-report-item" data-date="${date}" data-report="${reportType}">
                    <span class="nav-icon">${icon}</span>
                    <span class="nav-text">${displayName}</span>
                    ${statusIcon}
                </a>
            `;
        }).join('');

        return `
            <div class="nav-date-group ${expandedClass}" data-date="${date}">
                <div class="nav-date-header nav-expandable" data-target="date-${date}">
                    <span>${label}</span>
                    <span class="nav-expand-icon">${isExpanded ? '\u25BC' : '\u25B6'}</span>
                </div>
                <div class="nav-date-content" id="date-${date}" ${contentStyle}>
                    ${reports}
                </div>
            </div>
        `;
    }

    // Fetch and render reports status
    async function fetchAndRenderReportsStatus() {
        const container = document.getElementById('reports-content');
        if (!container) return;

        try {
            const response = await fetch('/api/v1/reports/status?days=3');
            if (!response.ok) throw new Error('API error');
            const result = await response.json();

            if (!result.success || !result.data) {
                throw new Error('Invalid response');
            }

            // Get saved expanded state from localStorage
            let expandedDates = {};
            try {
                const saved = localStorage.getItem('cct_nav_expanded_dates');
                if (saved) expandedDates = JSON.parse(saved);
            } catch (e) { /* ignore */ }

            // Render dates (first date auto-expanded if no saved state)
            const dates = Object.keys(result.data).sort().reverse(); // Most recent first
            let html = '';
            dates.forEach((date, index) => {
                const isExpanded = expandedDates[date] !== undefined ? expandedDates[date] : (index === 0);
                html += renderDateReports(date, result.data[date], isExpanded);
            });

            container.innerHTML = html;

            // Attach expand/collapse handlers for date headers
            container.querySelectorAll('.nav-date-header').forEach(header => {
                header.addEventListener('click', (e) => {
                    e.preventDefault();
                    const dateGroup = header.closest('.nav-date-group');
                    const date = dateGroup.dataset.date;
                    const content = document.getElementById(`date-${date}`);
                    const icon = header.querySelector('.nav-expand-icon');

                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        dateGroup.classList.add('expanded');
                        icon.textContent = '\u25BC';
                        saveExpandedState(date, true);
                    } else {
                        content.style.display = 'none';
                        dateGroup.classList.remove('expanded');
                        icon.textContent = '\u25B6';
                        saveExpandedState(date, false);
                    }
                });
            });

            // Set active state for current page
            setActiveState();

        } catch (e) {
            console.warn('Nav status fetch failed, showing fallback', e);
            container.innerHTML = '<div class="nav-error">Status unavailable</div>';
        }
    }

    // Save expanded state to localStorage
    function saveExpandedState(date, isExpanded) {
        try {
            const saved = localStorage.getItem('cct_nav_expanded_dates');
            const state = saved ? JSON.parse(saved) : {};
            state[date] = isExpanded;
            localStorage.setItem('cct_nav_expanded_dates', JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    // Set active state based on current URL
    function setActiveState() {
        const path = normalizePath(window.location.pathname);
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');

        // Clear existing active states
        document.querySelectorAll('.nav-item.active').forEach(el => el.classList.remove('active'));

        // Set active on matching report items
        document.querySelectorAll('.nav-report-item').forEach(item => {
            const itemDate = item.dataset.date;
            const itemReport = item.dataset.report;
            const itemPath = item.getAttribute('href')?.split('?')[0];

            if (path === itemPath && dateParam === itemDate) {
                item.classList.add('active');
            }
        });

        // Set active on other nav items (dashboard, weekly, system pages)
        document.querySelectorAll('.nav-item:not(.nav-report-item)').forEach(item => {
            const href = item.getAttribute('href') || '';
            const itemPath = normalizePath(href.split('?')[0]);
            if (path === itemPath) {
                item.classList.add('active');
            }
        });
    }

    // Check if we're in market hours (for polling frequency)
    // Uses Eastern Time via Intl.DateTimeFormat for accuracy across timezones
    function isMarketHours() {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(now);
        const get = (type) => parts.find(p => p.type === type)?.value || '';

        const weekday = get('weekday');
        const hour = parseInt(get('hour'), 10);
        const minute = parseInt(get('minute'), 10);

        // Weekend in ET
        if (weekday === 'Sat' || weekday === 'Sun') return false;

        // Market hours: 9:30 AM - 4:00 PM ET
        const totalMinutes = hour * 60 + minute;
        return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60;
    }

    // Start polling for status updates with dynamic interval
    function startPolling() {
        // Initial fetch
        fetchAndRenderReportsStatus();

        let currentIntervalId = null;
        let wasMarketHours = isMarketHours();

        function scheduleNext() {
            const inMarketHours = isMarketHours();
            const interval = inMarketHours ? 60000 : 300000;

            // Re-check interval on each poll to handle market open/close transitions
            currentIntervalId = setTimeout(() => {
                fetchAndRenderReportsStatus();
                scheduleNext();
            }, interval);
        }

        scheduleNext();
    }

    function initNav() {
        // Insert nav at start of body
        document.body.insertAdjacentHTML('afterbegin', navHTML);
        document.body.classList.add('has-nav');

        // Setup main Reports section expand/collapse
        const reportsTitle = document.querySelector('.nav-group-title[data-target="reports-content"]');
        const reportsContent = document.getElementById('reports-content');
        if (reportsTitle && reportsContent) {
            // Default expanded
            reportsContent.style.display = 'block';

            reportsTitle.addEventListener('click', () => {
                const icon = reportsTitle.querySelector('.nav-expand-icon');
                if (reportsContent.style.display === 'none') {
                    reportsContent.style.display = 'block';
                    icon.textContent = '\u25BC';
                } else {
                    reportsContent.style.display = 'none';
                    icon.textContent = '\u25B6';
                }
            });
        }

        // Mobile toggle behavior
        const toggle = document.querySelector('.mobile-nav-toggle');
        const nav = document.querySelector('.dashboard-navigation');
        if (toggle && nav) {
            toggle.addEventListener('click', () => {
                nav.classList.toggle('open');
            });
        }

        // Close nav on mobile after selection
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem && window.innerWidth <= 768) {
                document.querySelector('.dashboard-navigation')?.classList.remove('open');
            }
        });

        // Start polling for reports status
        startPolling();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNav);
    } else {
        initNav();
    }
})();
