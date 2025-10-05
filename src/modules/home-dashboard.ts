/**
 * Home Dashboard Module
 * Professional trading dashboard following UX/UI design document specifications
 * Role-based hybrid architecture: Dashboard for traders, Console for admins
 */

interface Env {
  TRADING_RESULTS: KVNamespace;
  TRAINED_MODELS: R2Bucket;
  ENHANCED_MODELS: R2Bucket;
  AI: any;
  WORKER_VERSION?: string;
  TRADING_SYMBOLS?: string;
  LOG_LEVEL?: string;
  TIMEZONE?: string;
}

interface DashboardData {
  marketMetrics: {
    spy: { value: number; change: number; changePercent: number };
    vix: { value: number; change: number; changePercent: number };
    aapl: { value: number; change: number; changePercent: number };
  };
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    responseTime: number;
    uptime: string;
    lastAnalysis: string;
    errorCount: number;
  };
  latestReports: Array<{
    type: string;
    title: string;
    time: string;
    confidence: number;
    url: string;
  }>;
  topMovers: Array<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    sentiment: string;
  }>;
  sectorPerformance: Array<{
    sector: string;
    symbol: string;
    value: number;
    change: number;
    changePercent: number;
  }>;
}

/**
 * Serve the Home Dashboard HTML page
 */
export async function handleHomeDashboardPage(request: Request, env: Env): Promise<Response> {
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trading Dashboard - Market Intelligence Platform</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a; /* Dark theme base */
            color: #ffffff;
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* Top Navigation Bar */
        .top-nav {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-bottom: 1px solid rgba(79, 172, 254, 0.3);
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 1000;
            backdrop-filter: blur(10px);
        }

        .nav-left {
            display: flex;
            align-items: center;
            gap: 30px;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: bold;
            color: #4facfe;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .logo:hover {
            color: #00f2fe;
            text-decoration: none;
        }

        .global-search {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            padding: 8px 16px;
            color: #ffffff;
            width: 250px;
            font-size: 0.9rem;
        }

        .global-search::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }

        .nav-right {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .health-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #00ff88;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .health-indicator:hover {
            box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
        }

        .notification-bell {
            font-size: 1.2rem;
            color: #ffffff;
            cursor: pointer;
            position: relative;
        }

        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: #ff4757;
            color: #ffffff;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            font-size: 0.7rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Main Layout */
        .main-container {
            display: flex;
            min-height: calc(100vh - 60px);
        }

        /* Sidebar Navigation */
        .sidebar {
            width: 250px;
            background: linear-gradient(180deg, #1a1a2e 0%, #0f3460 100%);
            border-right: 1px solid rgba(79, 172, 254, 0.3);
            padding: 20px 0;
            overflow-y: auto;
        }

        .nav-section {
            margin-bottom: 30px;
        }

        .nav-section-title {
            color: #4facfe;
            font-weight: 600;
            font-size: 0.9rem;
            text-transform: uppercase;
            padding: 10px 20px;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .nav-section-title:hover {
            background: rgba(79, 172, 254, 0.1);
        }

        .nav-items {
            list-style: none;
        }

        .nav-item {
            padding: 10px 20px 10px 35px;
            color: rgba(255, 255, 255, 0.8);
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
            font-size: 0.9rem;
        }

        .nav-item:hover {
            background: rgba(79, 172, 254, 0.1);
            color: #ffffff;
            text-decoration: none;
        }

        .nav-item.active {
            background: rgba(79, 172, 254, 0.2);
            color: #4facfe;
            border-left: 3px solid #4facfe;
        }

        /* Main Content Area */
        .main-content {
            flex: 1;
            padding: 20px;
            background: #0a0a0a;
        }

        /* At-a-Glance Top Row */
        .at-a-glance {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .metric-card {
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }

        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(79, 172, 254, 0.2);
        }

        .metric-label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.8rem;
            text-transform: uppercase;
            margin-bottom: 8px;
        }

        .metric-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #4facfe;
            margin-bottom: 5px;
        }

        .metric-change {
            font-size: 0.8rem;
            color: #00ff88;
        }

        .metric-change.negative {
            color: #ff4757;
        }

        /* Main Dashboard Grid */
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 20px;
        }

        /* Optimized layout for 5 widgets: 2-2-1 arrangement */
        @media (min-width: 1200px) {
            .dashboard-grid {
                grid-template-columns: repeat(3, 1fr);
            }
            .dashboard-grid .widget:first-child {
                grid-column: 1 / 3;
            }
        }

        @media (max-width: 1199px) and (min-width: 800px) {
            .dashboard-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .widget {
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(15, 52, 96, 0.8) 100%);
            border: 1px solid rgba(79, 172, 254, 0.3);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }

        .widget:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(79, 172, 254, 0.2);
        }

        .widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .widget-title {
            color: #4facfe;
            font-size: 1.2rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .widget-actions {
            display: flex;
            gap: 10px;
        }

        .widget-action {
            background: rgba(79, 172, 254, 0.2);
            border: 1px solid rgba(79, 172, 254, 0.3);
            color: #4facfe;
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .widget-action:hover {
            background: rgba(79, 172, 254, 0.3);
            color: #00f2fe;
        }

        .widget-content {
            min-height: 200px;
        }

        /* Chart Containers */
        .chart-container {
            height: 250px;
            position: relative;
        }

        /* Report List Widget */
        .report-list {
            list-style: none;
        }

        .report-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .report-item:last-child {
            border-bottom: none;
        }

        .report-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .report-icon {
            font-size: 1.2rem;
        }

        .report-name {
            color: #ffffff;
            font-weight: 500;
        }

        .report-time {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.8rem;
        }

        .report-status {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: 600;
        }

        .report-status.ready {
            background: rgba(0, 255, 136, 0.2);
            color: #00ff88;
        }

        .report-status.pending {
            background: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .sidebar {
                position: fixed;
                left: -250px;
                top: 60px;
                height: calc(100vh - 60px);
                z-index: 999;
                transition: left 0.3s ease;
            }

            .sidebar.mobile-open {
                left: 0;
            }

            .main-content {
                margin-left: 0;
            }

            .at-a-glance {
                grid-template-columns: repeat(2, 1fr);
            }

            .dashboard-grid {
                grid-template-columns: 1fr;
            }

            .global-search {
                width: 150px;
            }
        }

        /* Loading States */
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: rgba(255, 255, 255, 0.6);
        }

        .error {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: #ff4757;
            background: rgba(255, 71, 87, 0.1);
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <!-- Top Navigation Bar -->
    <nav class="top-nav">
        <div class="nav-left">
            <a href="/" class="logo">
                🏆 Trading Dashboard
            </a>
            <input type="text" class="global-search" placeholder="Search symbols, reports...">
        </div>
        <div class="nav-right">
            <div class="health-indicator" title="System Healthy"></div>
            <div class="notification-bell">
                🔔
                <span class="notification-badge">3</span>
            </div>
            <div class="user-profile">
                👤 Admin
            </div>
        </div>
    </nav>

    <!-- Main Container -->
    <div class="main-container">
        <!-- Sidebar Navigation -->
        <aside class="sidebar" id="sidebar">
            <!-- Dashboard Section -->
            <div class="nav-section">
                <div class="nav-section-title" onclick="toggleSection('dashboard')">
                    📊 Dashboard
                </div>
                <ul class="nav-items" id="dashboard-items">
                    <li><a href="/" class="nav-item active">🏠 Overview</a></li>
                    <li><a href="/weekly-analysis" class="nav-item">📈 Analytics</a></li>
                </ul>
            </div>

            <!-- Reports Section -->
            <div class="nav-section">
                <div class="nav-section-title" onclick="toggleSection('reports')">
                    📈 Reports
                </div>
                <ul class="nav-items" id="reports-items">
                    <li><a href="/pre-market-briefing" class="nav-item">🌅 Pre-Market Briefing</a></li>
                    <li><a href="/intraday-check" class="nav-item">📊 Intraday Check</a></li>
                    <li><a href="/end-of-day-summary" class="nav-item">🌆 End-of-Day Summary</a></li>
                    <li><a href="/weekly-review" class="nav-item">📅 Weekly Review</a></li>
                </ul>
            </div>

            <!-- Analytics Section (Future) -->
            <div class="nav-section">
                <div class="nav-section-title" onclick="toggleSection('analytics')">
                    🔬 Analytics
                </div>
                <ul class="nav-items" id="analytics-items" style="display: none;">
                    <li><a href="#" class="nav-item">🔄 Sector Rotation</a></li>
                    <li><a href="#" class="nav-item">🎯 Market Drivers</a></li>
                </ul>
            </div>

            <!-- System Section -->
            <div class="nav-section">
                <div class="nav-section-title" onclick="toggleSection('system')">
                    ⚙️ System
                </div>
                <ul class="nav-items" id="system-items" style="display: none;">
                    <li><a href="/health" class="nav-item">🏥 Health Dashboard</a></li>
                    <li><a href="/model-health" class="nav-item">🤖 AI Status</a></li>
                    <li><a href="#" class="nav-item">🖥️ Live Console</a></li>
                    <li><a href="#" class="nav-item">⚙️ Settings</a></li>
                </ul>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="main-content">
            <!-- At-a-Glance Top Row -->
            <div class="at-a-glance" role="status" aria-live="polite" aria-label="Market metrics at a glance">
                <div class="metric-card" role="status" aria-label="S&P 500 Index">
                    <div class="metric-label">SPY</div>
                    <div class="metric-value" id="spy-value" aria-label="S&P 500 value: 452.34 points">452.34</div>
                    <div class="metric-change" aria-label="Positive change of 1.23 percent">+1.23%</div>
                </div>
                <div class="metric-card" role="status" aria-label="VIX Volatility Index">
                    <div class="metric-label">VIX</div>
                    <div class="metric-value" id="vix-value" aria-label="VIX value: 16.82 points">16.82</div>
                    <div class="metric-change negative" aria-label="Negative change of 0.45 percent">-0.45%</div>
                </div>
                <div class="metric-card" role="status" aria-label="Apple Inc Stock">
                    <div class="metric-label">AAPL</div>
                    <div class="metric-value" id="aapl-value" aria-label="Apple stock value: $178.45">178.45</div>
                    <div class="metric-change" aria-label="Positive change of 2.15 percent">+2.15%</div>
                </div>
                <div class="metric-card" role="timer" aria-label="Current market time">
                    <div class="metric-label">Time</div>
                    <div class="metric-value" id="time-value" aria-label="Current time: 09:30">09:30</div>
                    <div class="metric-change" aria-label="Market status: Open">Market Open</div>
                </div>
            </div>

            <!-- Main Dashboard Grid -->
            <div class="dashboard-grid">
                <!-- Latest Report Widget -->
                <div class="widget">
                    <div class="widget-header">
                        <div class="widget-title">
                            📊 Latest Reports
                        </div>
                        <div class="widget-actions">
                            <button class="widget-action">Refresh</button>
                        </div>
                    </div>
                    <div class="widget-content">
                        <ul class="report-list" id="report-list">
                            <li class="report-item">
                                <div class="report-info">
                                    <div class="report-icon">🌅</div>
                                    <div>
                                        <div class="report-name">Pre-Market Briefing</div>
                                        <div class="report-time">Today, 8:30 AM</div>
                                    </div>
                                </div>
                                <div class="report-status ready">Ready</div>
                            </li>
                            <li class="report-item">
                                <div class="report-info">
                                    <div class="report-icon">📊</div>
                                    <div>
                                        <div class="report-name">Intraday Check</div>
                                        <div class="report-time">Today, 12:00 PM</div>
                                    </div>
                                </div>
                                <div class="report-status pending">Pending</div>
                            </li>
                            <li class="report-item">
                                <div class="report-info">
                                    <div class="report-icon">🌆</div>
                                    <div>
                                        <div class="report-name">End-of-Day Summary</div>
                                        <div class="report-time">Today, 4:05 PM</div>
                                    </div>
                                </div>
                                <div class="report-status pending">Pending</div>
                            </li>
                            <li class="report-item">
                                <div class="report-info">
                                    <div class="report-icon">📅</div>
                                    <div>
                                        <div class="report-name">Weekly Review</div>
                                        <div class="report-time">Sunday, 10:00 AM</div>
                                    </div>
                                </div>
                                <div class="report-status pending">Pending</div>
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Market Performance Widget -->
                <div class="widget">
                    <div class="widget-header">
                        <div class="widget-title">
                            📈 Market Performance
                        </div>
                        <div class="widget-actions">
                            <button class="widget-action">1D</button>
                            <button class="widget-action">1W</button>
                            <button class="widget-action">1M</button>
                        </div>
                    </div>
                    <div class="widget-content">
                        <div class="chart-container">
                            <canvas id="marketChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- System Status Widget -->
                <div class="widget">
                    <div class="widget-header">
                        <div class="widget-title">
                            🏥 System Status
                        </div>
                        <div class="widget-actions">
                            <button class="widget-action">Details</button>
                        </div>
                    </div>
                    <div class="widget-content">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            <div style="text-align: center;">
                                <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.8rem; margin-bottom: 5px;">AI Models</div>
                                <div style="color: #00ff88; font-size: 1.5rem; font-weight: bold;" id="ai-status">2/2 Online</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.8rem; margin-bottom: 5px;">Response Time</div>
                                <div style="color: #4facfe; font-size: 1.5rem; font-weight: bold;" id="response-time">470ms</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.8rem; margin-bottom: 5px;">Success Rate</div>
                                <div style="color: #4facfe; font-size: 1.5rem; font-weight: bold;">100%</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="color: rgba(255, 255, 255, 0.7); font-size: 0.8rem; margin-bottom: 5px;">Uptime</div>
                                <div style="color: #4facfe; font-size: 1.5rem; font-weight: bold;">100%</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sector Performance Widget -->
                <div class="widget">
                    <div class="widget-header">
                        <div class="widget-title">
                            📈 Sector Performance
                        </div>
                        <div class="widget-actions">
                            <button class="widget-action" onclick="refreshSectorData()">Refresh</button>
                        </div>
                    </div>
                    <div class="widget-content">
                        <div id="sector-performance">
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                <div>
                                    <div style="font-weight: 600;">XLK</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">Technology</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #00ff88; font-weight: 600;" id="xlk-change">+1.23%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;" id="xlk-value">$245.67</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                <div>
                                    <div style="font-weight: 600;">XLF</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">Financials</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #ff4757; font-weight: 600;" id="xlf-change">-0.45%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;" id="xlf-value">$41.23</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                <div>
                                    <div style="font-weight: 600;">XLV</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">Health Care</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #00ff88; font-weight: 600;" id="xlv-change">+0.89%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;" id="xlv-value">$156.78</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                                <div>
                                    <div style="font-weight: 600;">XLE</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.75rem;">Energy</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #ff4757; font-weight: 600;" id="xle-change">-1.67%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;" id="xle-value">$87.34</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Top Movers Widget -->
                <div class="widget">
                    <div class="widget-header">
                        <div class="widget-title">
                            🚀 Top Movers
                        </div>
                        <div class="widget-actions">
                            <button class="widget-action" onclick="refreshTopMovers()">Refresh</button>
                        </div>
                    </div>
                    <div class="widget-content">
                        <div id="top-movers">
                            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                <div>
                                    <div style="font-weight: 600;">NVDA</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">NVIDIA Corp</div>
                                    <div style="color: #4facfe; font-size: 0.7rem;">🟢 Strong Buy</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #00ff88; font-weight: 600;">+3.45%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">$462.89</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                <div>
                                    <div style="font-weight: 600;">TSLA</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">Tesla Inc</div>
                                    <div style="color: #4facfe; font-size: 0.7rem;">🟡 Moderate Buy</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #00ff88; font-weight: 600;">+2.78%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">$242.64</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 10px 0;">
                                <div>
                                    <div style="font-weight: 600;">MSFT</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">Microsoft Corp</div>
                                    <div style="color: #4facfe; font-size: 0.7rem;">🟢 Strong Buy</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: #ff4757; font-weight: 600;">-0.92%</div>
                                    <div style="color: rgba(255, 255, 255, 0.6); font-size: 0.8rem;">$378.85</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Market Chart
        let marketChart = null;

        function initializeMarketChart() {
            const ctx = document.getElementById('marketChart').getContext('2d');
            marketChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '1:00', '1:30', '2:00', '2:30', '3:00'],
                    datasets: [{
                        label: 'SPY',
                        data: [450.12, 451.23, 450.89, 452.34, 451.78, 452.89, 453.12, 452.67, 453.45, 452.90, 453.78, 452.34],
                        borderColor: '#4facfe',
                        backgroundColor: 'rgba(79, 172, 254, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true
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
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#4facfe',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.6)',
                                font: { size: 10 }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.6)',
                                font: { size: 10 }
                            }
                        }
                    }
                }
            });
        }

        // Toggle sidebar sections
        function toggleSection(sectionId) {
            const items = document.getElementById(sectionId + '-items');
            if (items.style.display === 'none') {
                items.style.display = 'block';
            } else {
                items.style.display = 'none';
            }
        }

        // Update time
        function updateTime() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            document.getElementById('time-value').textContent = timeString;
        }

        // System health check
        async function checkSystemHealth() {
            try {
                const response = await fetch('/health');
                const data = await response.json();

                if (data.success && data.status === 'healthy') {
                    document.querySelector('.health-indicator').style.background = '#00ff88';
                    document.querySelector('.health-indicator').title = 'System Healthy';
                } else {
                    document.querySelector('.health-indicator').style.background = '#ffc107';
                    document.querySelector('.health-indicator').title = 'System Issues';
                }
            } catch (error) {
                document.querySelector('.health-indicator').style.background = '#ff4757';
                document.querySelector('.health-indicator').title = 'System Error';
            }
        }

        // AI models status check
        async function checkAIModels() {
            try {
                const response = await fetch('/model-health');
                const data = await response.json();

                if (data.success && data.models) {
                    const healthyModels = Object.values(data.models).filter(m => m.status === 'healthy').length;
                    const totalModels = Object.keys(data.models).length;
                    document.getElementById('ai-status').textContent = healthyModels + '/' + totalModels + ' Online';
                } else {
                    document.getElementById('ai-status').textContent = 'Error';
                }
            } catch (error) {
                document.getElementById('ai-status').textContent = 'Offline';
            }
        }

        // Simulate market data updates
        function updateMarketData() {
            // Update SPY
            const spyElement = document.getElementById('spy-value');
            const currentSPY = parseFloat(spyElement.textContent);
            const newSPY = (currentSPY + (Math.random() - 0.5) * 2).toFixed(2);
            spyElement.textContent = newSPY;

            // Update VIX
            const vixElement = document.getElementById('vix-value');
            const currentVIX = parseFloat(vixElement.textContent);
            const newVIX = (currentVIX + (Math.random() - 0.5) * 0.5).toFixed(2);
            vixElement.textContent = newVIX;

            // Update AAPL
            const aaplElement = document.getElementById('aapl-value');
            const currentAAPL = parseFloat(aaplElement.textContent);
            const newAAPL = (currentAAPL + (Math.random() - 0.5) * 3).toFixed(2);
            aaplElement.textContent = newAAPL;

            // Update chart with new data point
            if (marketChart && marketChart.data.datasets[0].data.length > 12) {
                marketChart.data.datasets[0].data.shift();
                marketChart.data.datasets[0].data.push(parseFloat(newSPY));
                marketChart.update('none');
            }
        }

        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeMarketChart();
            checkSystemHealth();
            checkAIModels();
            updateTime();

            // Update time every minute
            setInterval(updateTime, 60000);

            // Update market data every 5 seconds
            setInterval(updateMarketData, 5000);

            // Check system health every 30 seconds
            setInterval(checkSystemHealth, 30000);

            // Initialize sector data
            refreshSectorData();
            refreshTopMovers();
        });

        // Sector Performance Widget Functions
        function refreshSectorData() {
            const sectors = [
                { symbol: 'XLK', name: 'Technology', baseValue: 245.67 },
                { symbol: 'XLF', name: 'Financials', baseValue: 41.23 },
                { symbol: 'XLV', name: 'Health Care', baseValue: 156.78 },
                { symbol: 'XLE', name: 'Energy', baseValue: 87.34 }
            ];

            sectors.forEach(sector => {
                const changeElement = document.getElementById(sector.symbol.toLowerCase() + '-change');
                const valueElement = document.getElementById(sector.symbol.toLowerCase() + '-value');

                if (changeElement && valueElement) {
                    const change = (Math.random() - 0.5) * 3;
                    const newValue = (sector.baseValue + change).toFixed(2);
                    const changePercent = ((change / sector.baseValue) * 100).toFixed(2);

                    changeElement.textContent = (changePercent >= 0 ? '+' : '') + changePercent + '%';
                    changeElement.style.color = changePercent >= 0 ? '#00ff88' : '#ff4757';
                    valueElement.textContent = '$' + newValue;
                }
            });
        }

        // Top Movers Widget Functions
        function refreshTopMovers() {
            // Add visual feedback for refresh
            const moversContainer = document.getElementById('top-movers');
            if (moversContainer) {
                moversContainer.style.opacity = '0.6';
                setTimeout(() => {
                    moversContainer.style.opacity = '1';
                }, 500);
            }
        }

        // Mobile sidebar toggle
        function toggleMobileSidebar() {
            document.getElementById('sidebar').classList.toggle('mobile-open');
        }

        // Add mobile menu button for small screens
        if (window.innerWidth <= 768) {
            const mobileMenuBtn = document.createElement('button');
            mobileMenuBtn.innerHTML = '☰';
            mobileMenuBtn.style.cssText = 'background: none; border: none; color: #4facfe; font-size: 1.5rem; cursor: pointer;';
            mobileMenuBtn.onclick = toggleMobileSidebar;
            document.querySelector('.nav-left').prepend(mobileMenuBtn);
        }
    </script>
</body>
</html>`;

  try {
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=300', // 5 minute cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  } catch (error) {
    console.error('Error serving home dashboard:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: 'Failed to load dashboard'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}