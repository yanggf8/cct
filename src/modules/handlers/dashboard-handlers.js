/**
 * Professional Dashboard Handlers
 * Main dashboard with 7 key widgets using Pico.css framework
 */

import { createLogger } from '../logging.js';
import { createHealthResponse } from '../response-factory.js';
import { createDAL } from '../dal.js';
// Facebook integration removed - using response factory instead
import { BusinessMetrics } from '../monitoring.js';
// Utility functions for formatting
function formatCurrency(value) {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercentage(value) {
  if (typeof value !== 'number' || isNaN(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
}

function formatNumber(value) {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

const logger = createLogger('dashboard-handlers');

/**
 * Handle main dashboard request with 7 professional widgets
 */
export async function handleProfessionalDashboard(request, env, ctx) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    logger.info('Professional dashboard requested', { requestId });

    // Fetch data for all widgets
    const [
      healthData,
      modelHealthData,
      latestAnalysis,
      marketData,
      sectorData
    ] = await Promise.allSettled([
      fetchHealthData(env),
      fetchModelHealthData(env),
      fetchLatestAnalysis(env),
      fetchMarketData(env),
      fetchSectorData(env)
    ]);

    // Process widget data
    const widgetData = {
      health: healthData.status === 'fulfilled' ? healthData.value : getDefaultHealthData(),
      modelHealth: modelHealthData.status === 'fulfilled' ? modelHealthData.value : getDefaultModelHealthData(),
      latestAnalysis: latestAnalysis.status === 'fulfilled' ? latestAnalysis.value : getDefaultAnalysisData(),
      marketData: marketData.status === 'fulfilled' ? marketData.value : getDefaultMarketData(),
      sectorData: sectorData.status === 'fulfilled' ? sectorData.value : getDefaultSectorData()
    };

    // Generate HTML dashboard
    const html = generateDashboardHTML(widgetData, env);

    // Track metrics
    BusinessMetrics.apiRequest('/', 'GET', 200, Date.now() - startTime);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60', // 1 minute cache for real-time data
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Dashboard generation failed', { requestId, error: error.message });

    // Return error dashboard
    const errorHTML = generateErrorDashboard(error.message, requestId);

    return new Response(errorHTML, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
        'X-Request-ID': requestId
      }
    });
  }
}

/**
 * Fetch system health data
 */
async function fetchHealthData(env) {
  try {
    const healthResponse = await createHealthResponse(env);
    return {
      status: 'healthy',
      components: healthResponse,
      uptime: Date.now() - (env.WORKER_START_TIME || Date.now()),
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      lastUpdate: new Date().toISOString()
    };
  }
}

/**
 * Fetch model health data
 */
async function fetchModelHealthData(env) {
  try {
    const dal = createDAL(env);

    // Get latest analysis data
    const latestAnalysis = await dal.getAnalysis();

    return {
      status: 'healthy',
      models: {
        'GPT-OSS-120B': { status: 'active', lastUsed: latestAnalysis?.timestamp || null },
        'DistilBERT-SST-2': { status: 'active', lastUsed: latestAnalysis?.timestamp || null }
      },
      lastAnalysis: latestAnalysis?.timestamp || null,
      analysisCount: latestAnalysis ? 1 : 0
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      models: {}
    };
  }
}

/**
 * Fetch latest analysis data
 */
async function fetchLatestAnalysis(env) {
  try {
    const dal = createDAL(env);
    const analysis = await dal.getAnalysis();

    if (!analysis) {
      return {
        status: 'no_data',
        message: 'No analysis data available',
        signals: [],
        confidence: 0
      };
    }

    return {
      status: 'available',
      timestamp: analysis.timestamp,
      signals: analysis.signals || [],
      confidence: analysis.overall_confidence || 0,
      summary: analysis.summary || '',
      market_sentiment: analysis.market_sentiment || 'neutral'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      signals: [],
      confidence: 0
    };
  }
}

/**
 * Fetch market data (indices)
 */
async function fetchMarketData(env) {
  try {
    const dal = createDAL(env);

    // Get market data from cache or fetch fresh
    const marketData = {
      indices: [
        { symbol: 'SPY', name: 'S&P 500', price: 0, change: 0, changePercent: 0 },
        { symbol: 'QQQ', name: 'NASDAQ', price: 0, change: 0, changePercent: 0 },
        { symbol: 'DIA', name: 'DOW', price: 0, change: 0, changePercent: 0 },
        { symbol: 'VIX', name: 'VIX', price: 0, change: 0, changePercent: 0 }
      ],
      lastUpdate: new Date().toISOString()
    };

    // Try to get cached market data
    try {
      const cached = await dal.read('market_data_cache');
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
        marketData.indices = cached.data || marketData.indices;
      }
    } catch (e) {
      // Use default values if cache is unavailable
    }

    return marketData;
  } catch (error) {
    return getDefaultMarketData();
  }
}

/**
 * Fetch sector data
 */
async function fetchSectorData(env) {
  try {
    // For now, return default sector data
    // This will be enhanced when sector rotation is implemented
    return getDefaultSectorData();
  } catch (error) {
    return getDefaultSectorData();
  }
}

/**
 * Default data functions
 */
function getDefaultHealthData() {
  return {
    status: 'healthy',
    components: { kv: 'healthy', ai: 'healthy', api: 'healthy' },
    uptime: 0,
    lastUpdate: new Date().toISOString()
  };
}

function getDefaultModelHealthData() {
  return {
    status: 'healthy',
    models: {
      'GPT-OSS-120B': { status: 'active', lastUsed: null },
      'DistilBERT-SST-2': { status: 'active', lastUsed: null }
    },
    lastAnalysis: null,
    analysisCount: 0
  };
}

function getDefaultAnalysisData() {
  return {
    status: 'no_data',
    message: 'No analysis data available',
    signals: [],
    confidence: 0
  };
}

function getDefaultMarketData() {
  return {
    indices: [
      { symbol: 'SPY', name: 'S&P 500', price: 0, change: 0, changePercent: 0 },
      { symbol: 'QQQ', name: 'NASDAQ', price: 0, change: 0, changePercent: 0 },
      { symbol: 'DIA', name: 'DOW', price: 0, change: 0, changePercent: 0 },
      { symbol: 'VIX', name: 'VIX', price: 0, change: 0, changePercent: 0 }
    ],
    lastUpdate: new Date().toISOString()
  };
}

function getDefaultSectorData() {
  return {
    sectors: [
      { name: 'Technology', symbol: 'XLK', performance: 0, status: 'neutral' },
      { name: 'Healthcare', symbol: 'XLV', performance: 0, status: 'neutral' },
      { name: 'Financials', symbol: 'XLF', performance: 0, status: 'neutral' },
      { name: 'Consumer', symbol: 'XLY', performance: 0, status: 'neutral' },
      { name: 'Industrial', symbol: 'XLI', performance: 0, status: 'neutral' }
    ],
    lastUpdate: new Date().toISOString()
  };
}

/**
 * Generate complete dashboard HTML
 */
function generateDashboardHTML(data, env) {
  const currentTime = new Date().toISOString();
  const marketStatus = getMarketStatus();

  return `
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dual AI Sentiment Analysis - Professional Dashboard</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    :root {
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --background: #0f172a;
      --background-color: #1e293b;
      --nav-background-color: #1e293b;
      --form-element-background-color: #334155;
      --form-element-border-color: #475569;
      --form-element-active-border-color: #6366f1;
      --card-background-color: #1e293b;
      --card-border-color: #334155;
      --card-sectioning-background-color: #334155;
      --h1-color: #f1f5f9;
      --h2-color: #e2e8f0;
      --h3-color: #cbd5e1;
      --color: #cbd5e1;
    }

    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      color: var(--color);
    }

    .dashboard-header {
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--card-border-color);
      padding: 1rem 0;
      margin-bottom: 2rem;
    }

    .dashboard-title {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0;
    }

    .dashboard-subtitle {
      color: #94a3b8;
      font-size: 0.9rem;
      margin: 0.5rem 0 0 0;
    }

    .widget-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .widget {
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid var(--card-border-color);
      border-radius: 12px;
      padding: 1.5rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .widget:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .widget-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--h2-color);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .widget-icon {
      width: 24px;
      height: 24px;
      color: var(--primary);
    }

    .widget-content {
      color: var(--color);
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-healthy {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .status-warning {
      background: rgba(251, 191, 36, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    .status-error {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .market-indices {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }

    .index-item {
      text-align: center;
      padding: 1rem;
      background: rgba(51, 65, 85, 0.5);
      border-radius: 8px;
      border: 1px solid var(--card-border-color);
    }

    .index-symbol {
      font-weight: 700;
      color: var(--h3-color);
      font-size: 0.9rem;
    }

    .index-name {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0.25rem 0;
    }

    .index-price {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--h2-color);
      margin: 0.5rem 0;
    }

    .index-change {
      font-size: 0.9rem;
      font-weight: 600;
    }

    .change-positive {
      color: #22c55e;
    }

    .change-negative {
      color: #ef4444;
    }

    .change-neutral {
      color: #94a3b8;
    }

    .report-links {
      display: grid;
      gap: 0.75rem;
    }

    .report-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      background: rgba(51, 65, 85, 0.5);
      border: 1px solid var(--card-border-color);
      border-radius: 8px;
      text-decoration: none;
      color: var(--color);
      transition: all 0.2s ease;
    }

    .report-link:hover {
      background: rgba(99, 102, 241, 0.1);
      border-color: var(--primary);
      transform: translateX(4px);
    }

    .report-info {
      flex: 1;
    }

    .report-title {
      font-weight: 600;
      color: var(--h2-color);
      margin-bottom: 0.25rem;
    }

    .report-description {
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .report-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
    }

    .market-clock {
      text-align: center;
      padding: 2rem 1rem;
    }

    .clock-time {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--h1-color);
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
      margin-bottom: 0.5rem;
    }

    .clock-date {
      font-size: 1rem;
      color: #94a3b8;
      margin-bottom: 1rem;
    }

    .market-status {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.9rem;
    }

    .market-open {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .market-closed {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .sector-list {
      display: grid;
      gap: 0.75rem;
    }

    .sector-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      background: rgba(51, 65, 85, 0.5);
      border: 1px solid var(--card-border-color);
      border-radius: 6px;
    }

    .sector-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sector-name {
      font-weight: 600;
      color: var(--h2-color);
    }

    .sector-symbol {
      font-size: 0.85rem;
      color: #94a3b8;
      background: rgba(51, 65, 85, 0.5);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .sector-performance {
      font-weight: 600;
      font-size: 0.9rem;
    }

    .nav-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
      padding: 0 1rem;
    }

    .nav-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem;
      background: rgba(99, 102, 241, 0.1);
      border: 2px solid var(--primary);
      border-radius: 8px;
      text-decoration: none;
      color: var(--h2-color);
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .nav-button:hover {
      background: var(--primary);
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .loading-skeleton {
      background: linear-gradient(90deg, rgba(51, 65, 85, 0.5) 25%, rgba(71, 85, 105, 0.5) 50%, rgba(51, 65, 85, 0.5) 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
      border-radius: 4px;
      height: 1rem;
      margin: 0.25rem 0;
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (max-width: 768px) {
      .widget-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .dashboard-title {
        font-size: 1.5rem;
      }

      .clock-time {
        font-size: 2rem;
      }

      .market-indices {
        grid-template-columns: repeat(2, 1fr);
      }

      .nav-buttons {
        grid-template-columns: 1fr;
      }
    }

    .pulse {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }

    .auto-refresh {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(30, 41, 59, 0.95);
      border: 1px solid var(--card-border-color);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 1000;
    }

    .auto-refresh:hover {
      background: var(--primary);
      transform: rotate(180deg);
    }

    .auto-refresh i {
      color: var(--h2-color);
      font-size: 1.2rem;
    }
  </style>
</head>
<body>
  <header class="dashboard-header">
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 class="dashboard-title">
            <i class="fas fa-chart-line" style="margin-right: 0.5rem;"></i>
            Dual AI Sentiment Analysis
          </h1>
          <p class="dashboard-subtitle">Professional Dual AI Sentiment Analysis Dashboard</p>
        </div>
        <div style="text-align: right;">
          <div class="status-badge ${data.health.status === 'healthy' ? 'status-healthy' : 'status-error'}">
            <i class="fas fa-circle" style="font-size: 0.5rem; margin-right: 0.5rem;"></i>
            ${data.health.status.toUpperCase()}
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.5rem;">
            Last Update: ${new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  </header>

  <main class="container">
    <div class="widget-grid">
      <!-- Market Indices Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-chart-area widget-icon"></i>
            Market Indices
          </h2>
          <span class="status-badge status-healthy">LIVE</span>
        </div>
        <div class="widget-content">
          <div class="market-indices">
            ${data.marketData.indices.map(index => `
              <div class="index-item">
                <div class="index-symbol">${index.symbol}</div>
                <div class="index-name">${index.name}</div>
                <div class="index-price">${formatCurrency(index.price)}</div>
                <div class="index-change ${getChangeClass(index.changePercent)}">
                  ${index.change >= 0 ? '+' : ''}${formatCurrency(index.change)} (${index.changePercent >= 0 ? '+' : ''}${formatPercentage(index.changePercent)})
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Latest Report Status Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-file-alt widget-icon"></i>
            Latest Report Status
          </h2>
          <span class="status-badge ${data.latestAnalysis.status === 'available' ? 'status-healthy' : 'status-warning'}">
            ${data.latestAnalysis.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div class="widget-content">
          <div class="report-links">
            <a href="/pre-market-briefing" class="report-link">
              <div class="report-info">
                <div class="report-title">Pre-Market Briefing</div>
                <div class="report-description">Morning high-confidence sentiment insights (≥70%)</div>
              </div>
              <div class="report-status pulse"></div>
            </a>
            <a href="/intraday-check" class="report-link">
              <div class="report-info">
                <div class="report-title">Intraday Performance</div>
                <div class="report-description">Real-time sentiment tracking</div>
              </div>
              <div class="report-status"></div>
            </a>
            <a href="/end-of-day-summary" class="report-link">
              <div class="report-info">
                <div class="report-title">End-of-Day Summary</div>
                <div class="report-description">Market close sentiment analysis & tomorrow outlook</div>
              </div>
              <div class="report-status"></div>
            </a>
            <a href="/weekly-review" class="report-link">
              <div class="report-info">
                <div class="report-title">Weekly Review</div>
                <div class="report-description">Comprehensive sentiment pattern analysis</div>
              </div>
              <div class="report-status"></div>
            </a>
          </div>
          ${data.latestAnalysis.status === 'available' ? `
            <div style="margin-top: 1rem; padding: 1rem; background: rgba(51, 65, 85, 0.5); border-radius: 8px;">
              <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem;">Latest Sentiment Analysis</div>
              <div style="font-weight: 600; color: var(--h2-color);">
                Confidence: ${formatPercentage(data.latestAnalysis.confidence)}
              </div>
              <div style="font-size: 0.9rem; color: var(--color); margin-top: 0.25rem;">
                ${data.latestAnalysis.market_sentiment} sentiment • ${data.latestAnalysis.signals.length} sentiment insights
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Market Clock Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-clock widget-icon"></i>
            Market Clock
          </h2>
        </div>
        <div class="widget-content">
          <div class="market-clock">
            <div class="clock-time" id="clock-time">${new Date().toLocaleTimeString()}</div>
            <div class="clock-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div class="market-status ${marketStatus.isOpen ? 'market-open' : 'market-closed'}">
              <i class="fas fa-circle" style="font-size: 0.5rem; margin-right: 0.5rem;"></i>
              Market ${marketStatus.isOpen ? 'Open' : 'Closed'}
            </div>
            <div style="margin-top: 1rem; font-size: 0.85rem; color: #94a3b8;">
              ${marketStatus.nextEvent}
            </div>
          </div>
        </div>
      </div>

      <!-- Sector Performance Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-industry widget-icon"></i>
            Sector Performance
          </h2>
          <span class="status-badge status-healthy">TODAY</span>
        </div>
        <div class="widget-content">
          <div class="sector-list">
            ${data.sectorData.sectors.map(sector => `
              <div class="sector-item">
                <div class="sector-info">
                  <div class="sector-name">${sector.name}</div>
                  <div class="sector-symbol">${sector.symbol}</div>
                </div>
                <div class="sector-performance ${getChangeClass(sector.performance)}">
                  ${sector.performance >= 0 ? '+' : ''}${formatPercentage(sector.performance)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Market Drivers Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-cogs widget-icon"></i>
            Market Drivers
          </h2>
          <span class="status-badge status-warning">COMING SOON</span>
        </div>
        <div class="widget-content">
          <div style="text-align: center; padding: 2rem 0; color: #94a3b8;">
            <i class="fas fa-chart-line" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
            <p>Market Drivers Analysis</p>
            <p style="font-size: 0.85rem; margin-top: 0.5rem;">FRED API integration coming soon</p>
          </div>
        </div>
      </div>

      <!-- Watchlist Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-star widget-icon"></i>
            Watchlist
          </h2>
        </div>
        <div class="widget-content">
          <div style="text-align: center; padding: 2rem 0; color: #94a3b8;">
            <i class="fas fa-eye" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
            <p>Custom Watchlist</p>
            <p style="font-size: 0.85rem; margin-top: 0.5rem;">Track your favorite symbols</p>
          </div>
        </div>
      </div>

      <!-- Top Movers Widget -->
      <div class="widget">
        <div class="widget-header">
          <h2 class="widget-title">
            <i class="fas fa-rocket widget-icon"></i>
            Top Movers
          </h2>
        </div>
        <div class="widget-content">
          <div style="text-align: center; padding: 2rem 0; color: #94a3b8;">
            <i class="fas fa-arrow-trend-up" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
            <p>Market Leaders</p>
            <p style="font-size: 0.85rem; margin-top: 0.5rem;">Biggest gainers & losers</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Section -->
    <div class="nav-buttons">
      <a href="/health" class="nav-button">
        <i class="fas fa-heartbeat"></i>
        System Health
      </a>
      <a href="/model-health" class="nav-button">
        <i class="fas fa-brain"></i>
        Model Health
      </a>
      <a href="/analyze" class="nav-button">
        <i class="fas fa-search"></i>
        Manual Analysis
      </a>
      <a href="/daily-summary" class="nav-button">
        <i class="fas fa-calendar-alt"></i>
        Daily Summary
      </a>
    </div>
  </main>

  <!-- Auto-refresh button -->
  <div class="auto-refresh" onclick="location.reload()" title="Refresh Dashboard">
    <i class="fas fa-sync-alt"></i>
  </div>

  <script>
    // Update clock every second
    function updateClock() {
      const now = new Date();
      document.getElementById('clock-time').textContent = now.toLocaleTimeString();
    }

    setInterval(updateClock, 1000);
    updateClock();

    // Auto-refresh every 60 seconds
    let refreshInterval = setInterval(() => {
      location.reload();
    }, 60000);

    // Pause refresh when page is not visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(refreshInterval);
      } else {
        refreshInterval = setInterval(() => {
          location.reload();
        }, 60000);
      }
    });

    // Add smooth animations
    document.addEventListener('DOMContentLoaded', () => {
      const widgets = document.querySelectorAll('.widget');
      widgets.forEach((widget, index) => {
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(20px)';

        setTimeout(() => {
          widget.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
          widget.style.opacity = '1';
          widget.style.transform = 'translateY(0)';
        }, index * 100);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        location.reload();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate error dashboard HTML
 */
function generateErrorDashboard(errorMessage, requestId) {
  return `
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Error - Dual AI Sentiment Analysis</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    :root {
      --primary: #6366f1;
      --background: #0f172a;
      --background-color: #1e293b;
      --color: #cbd5e1;
    }

    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color);
    }

    .error-container {
      background: rgba(30, 41, 59, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 2rem;
      max-width: 500px;
      text-align: center;
    }

    .error-icon {
      font-size: 3rem;
      color: #ef4444;
      margin-bottom: 1rem;
    }

    .error-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 1rem;
    }

    .error-message {
      color: #94a3b8;
      margin-bottom: 1.5rem;
    }

    .error-details {
      background: rgba(51, 65, 85, 0.5);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-family: monospace;
      font-size: 0.85rem;
      color: #cbd5e1;
    }

    .retry-button {
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s ease;
    }

    .retry-button:hover {
      background: #4f46e5;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h1 class="error-title">Dashboard Error</h1>
    <p class="error-message">
      We encountered an error while loading the dashboard. Please try again.
    </p>
    <div class="error-details">
      Error: ${errorMessage}<br>
      Request ID: ${requestId}<br>
      Time: ${new Date().toISOString()}
    </div>
    <button class="retry-button" onclick="location.reload()">
      <i class="fas fa-redo" style="margin-right: 0.5rem;"></i>
      Retry
    </button>
  </div>
</body>
</html>`;
}

/**
 * Helper functions
 */
function getMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour * 60 + minute;

  // Market hours: 9:30 AM - 4:00 PM EST, Monday - Friday
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  const isOpen = day >= 1 && day <= 5 && currentTime >= marketOpen && currentTime < marketClose;

  let nextEvent = '';
  if (isOpen) {
    const minutesUntilClose = marketClose - currentTime;
    nextEvent = `Market closes in ${Math.floor(minutesUntilClose / 60)}h ${minutesUntilClose % 60}m`;
  } else if (day >= 1 && day <= 5) {
    if (currentTime < marketOpen) {
      const minutesUntilOpen = marketOpen - currentTime;
      nextEvent = `Market opens in ${Math.floor(minutesUntilOpen / 60)}h ${minutesUntilOpen % 60}m`;
    } else {
      nextEvent = 'Market opens tomorrow at 9:30 AM';
    }
  } else {
    nextEvent = 'Market opens Monday at 9:30 AM';
  }

  return { isOpen, nextEvent };
}

function getChangeClass(change) {
  if (change > 0) return 'change-positive';
  if (change < 0) return 'change-negative';
  return 'change-neutral';
}