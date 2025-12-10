/**
 * Business Intelligence Dashboard Controller
 * Manages dashboard UI components and data visualization
 * Phase 3 Implementation: UI scaffolding for operational health monitoring
 */

class BIDashboardController {
  constructor(containerId, config = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Dashboard container with id '${containerId}' not found`);
    }

    this.config = {
      refreshInterval: config.refreshInterval || 300000, // 5 minutes
      enableAnimations: config.enableAnimations !== false,
      theme: config.theme || 'light',
      ...config
    };

    this.client = new BIDashboardClient({
      apiBase: config.apiBase || '/api/v1',
      refreshInterval: this.config.refreshInterval,
      autoRefresh: this.config.autoRefresh
    });

    this.components = new Map();
    this.charts = new Map();
    this.isInitialized = false;

    // Initialize dashboard
    this.init();
  }

  /**
   * Initialize dashboard structure and load initial data
   */
  async init() {
    try {
      console.log('Initializing BI Dashboard...');

      // Setup event listeners
      this.setupEventListeners();

      // Create dashboard layout
      this.createDashboardLayout();

      // Load initial data
      await this.loadInitialData();

      // Start auto-refresh if enabled
      if (this.config.autoRefresh) {
        this.startAutoRefresh();
      }

      this.isInitialized = true;
      this.emit('dashboard:initialized');

    } catch (error) {
      console.error('Failed to initialize dashboard:', error);
      this.showError('Failed to initialize dashboard: ' + error.message);
    }
  }

  /**
   * Setup event listeners for the dashboard client
   */
  setupEventListeners() {
    // Dashboard metrics updated
    this.client.on('metrics:updated', (data) => {
      this.updateMetricsDisplay(data);
      this.emit('metrics:updated', data);
    });

    // Cost-to-serve data updated
    this.client.on('economics:updated', (data) => {
      this.updateEconomicsDisplay(data);
      this.emit('economics:updated', data);
    });

    // Guard violations updated
    this.client.on('guards:updated', (data) => {
      this.updateGuardViolationsDisplay(data);
      this.emit('guards:updated', data);
    });

    // Error handling
    this.client.on('error', ({ endpoint, error }) => {
      console.error(`Dashboard API error for ${endpoint}:`, error);
      this.showNotification(`API Error: ${error.message}`, 'error');
    });
  }

  /**
   * Create the main dashboard layout
   */
  createDashboardLayout() {
    this.container.innerHTML = `
      <div class="bi-dashboard ${this.config.theme}">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
          <h1 class="dashboard-title">Business Intelligence Dashboard</h1>
          <div class="dashboard-controls">
            <button id="refresh-btn" class="btn btn-primary">Refresh Data</button>
            <button id="auto-refresh-toggle" class="btn btn-secondary">Auto-Refresh: ON</button>
            <select id="time-range" class="form-control">
              <option value="1h">Last Hour</option>
              <option value="24h" selected>Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <!-- Main Dashboard Grid -->
        <div class="dashboard-grid">
          <!-- Operational Health Section -->
          <div class="dashboard-section">
            <h2>Operational Health</h2>
            <div class="metrics-grid" id="operational-metrics">
              <div class="metric-card" id="overall-score">
                <h3>Overall Score</h3>
                <div class="metric-value">--</div>
                <div class="metric-change">--</div>
              </div>
              <div class="metric-card" id="api-response-time">
                <h3>API Response Time</h3>
                <div class="metric-value">-- ms</div>
                <div class="metric-change">--</div>
              </div>
              <div class="metric-card" id="cache-hit-rate">
                <h3>Cache Hit Rate</h3>
                <div class="metric-value">-- %</div>
                <div class="metric-change">--</div>
              </div>
              <div class="metric-card" id="error-rate">
                <h3>Error Rate</h3>
                <div class="metric-value">-- %</div>
                <div class="metric-change">--</div>
              </div>
            </div>
          </div>

          <!-- System Performance Section -->
          <div class="dashboard-section">
            <h2>System Performance</h2>
            <div class="metrics-grid" id="system-metrics">
              <div class="metric-card" id="cpu-utilization">
                <h3>CPU Utilization</h3>
                <div class="metric-value">-- %</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
              </div>
              <div class="metric-card" id="memory-usage">
                <h3>Memory Usage</h3>
                <div class="metric-value">-- %</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
              </div>
              <div class="metric-card" id="storage-utilization">
                <h3>Storage Utilization</h3>
                <div class="metric-value">-- %</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: 0%"></div>
                </div>
              </div>
              <div class="metric-card" id="network-latency">
                <h3>Network Latency</h3>
                <div class="metric-value">-- ms</div>
                <div class="metric-change">--</div>
              </div>
            </div>
          </div>

          <!-- Cost Analysis Section -->
          <div class="dashboard-section">
            <h2>Cost-to-Serve Analysis</h2>
            <div class="economics-grid" id="cost-analysis">
              <div class="cost-card" id="monthly-cost">
                <h3>Monthly Cost</h3>
                <div class="metric-value">$--</div>
                <div class="metric-detail">-- per request</div>
              </div>
              <div class="cost-card" id="cost-breakdown">
                <h3>Cost Breakdown</h3>
                <canvas id="cost-breakdown-chart" width="300" height="200"></canvas>
              </div>
              <div class="cost-card" id="efficiency-score">
                <h3>Cost Efficiency</h3>
                <div class="metric-value">--</div>
                <div class="metric-change">--</div>
              </div>
            </div>
          </div>

          <!-- Guard Violations Section -->
          <div class="dashboard-section">
            <h2>Guard Violations</h2>
            <div class="violations-container">
              <div class="violations-summary" id="violations-summary">
                <div class="summary-item">
                  <span class="label">Total Violations:</span>
                  <span class="value" id="total-violations">--</span>
                </div>
                <div class="summary-item">
                  <span class="label">Active Violations:</span>
                  <span class="value" id="active-violations">--</span>
                </div>
                <div class="summary-item">
                  <span class="label">Critical Alerts:</span>
                  <span class="value" id="critical-alerts">--</span>
                </div>
              </div>
              <div class="violations-list" id="violations-list">
                <!-- Violations will be populated here -->
              </div>
            </div>
          </div>
        </div>

        <!-- Loading Spinner -->
        <div class="loading-spinner" id="loading-spinner" style="display: none;">
          <div class="spinner"></div>
          <span>Loading dashboard data...</span>
        </div>

        <!-- Error Display -->
        <div class="error-message" id="error-message" style="display: none;">
          <h3>Error</h3>
          <p id="error-text"></p>
          <button class="btn btn-secondary" onclick="this.parentElement.style.display='none'">Close</button>
        </div>

        <!-- Notification Container -->
        <div class="notification-container" id="notification-container">
          <!-- Notifications will appear here -->
        </div>
      </div>
    `;

    // Bind control events
    this.bindControlEvents();
  }

  /**
   * Bind event handlers for dashboard controls
   */
  bindControlEvents() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.refreshAllData();
      });
    }

    // Auto-refresh toggle
    const autoRefreshToggle = document.getElementById('auto-refresh-toggle');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('click', () => {
        this.toggleAutoRefresh();
      });
    }

    // Time range selector
    const timeRange = document.getElementById('time-range');
    if (timeRange) {
      timeRange.addEventListener('change', (e) => {
        this.onTimeRangeChange(e.target.value);
      });
    }
  }

  /**
   * Load initial dashboard data
   */
  async loadInitialData() {
    this.showLoading(true);

    try {
      // Load all data in parallel
      const [metrics, economics, guards, health] = await Promise.all([
        this.client.fetchDashboardMetrics(),
        this.client.fetchCostToServeMetrics(),
        this.client.fetchGuardViolationData(),
        this.client.fetchDashboardHealth()
      ]);

      // Update displays
      this.updateMetricsDisplay(metrics);
      this.updateEconomicsDisplay(economics);
      this.updateGuardViolationsDisplay(guards);
      this.updateHealthDisplay(health);

    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showError('Failed to load dashboard data: ' + error.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Update operational metrics display
   */
  updateMetricsDisplay(data) {
    if (!data || !data.operational_health) return;

    const { operational_health, system_performance = {} } = data;
    const cpuUtil = operational_health.cpu_utilization ?? system_performance.cpu_utilization;
    const memUtil = operational_health.memory_usage ?? system_performance.memory_usage;
    const storageUtil = operational_health.storage_utilization ?? system_performance.storage_utilization;
    const networkLatency = operational_health.network_latency ?? system_performance.network_latency;

    this.updateMetricCard('overall-score', this.formatNumber(operational_health.overall_score, 1), '', 'score');
    this.updateMetricCard('api-response-time', this.formatNumber(operational_health.api_response_time, 0, ' ms'), '', 'response-time');
    this.updateMetricCard('cache-hit-rate', this.formatPercent(operational_health.cache_hit_rate), '', 'hit-rate');
    this.updateMetricCard('error-rate', this.formatPercent(operational_health.error_rate), '', 'error-rate');

    // Update system performance
    this.updateMetricCard('cpu-utilization', this.formatPercent(cpuUtil), '', 'cpu');
    this.updateMetricCard('memory-usage', this.formatPercent(memUtil), '', 'memory');
    this.updateMetricCard('storage-utilization', this.formatPercent(storageUtil), '', 'storage');
    this.updateMetricCard('network-latency', this.formatNumber(networkLatency, 0, ' ms'), '', 'latency');

    // Update progress bars
    this.updateProgressBar('cpu-utilization', cpuUtil);
    this.updateProgressBar('memory-usage', memUtil);
    this.updateProgressBar('storage-utilization', storageUtil);
  }

  /**
   * Update cost-to-serve economics display
   */
  updateEconomicsDisplay(data) {
    if (!data) return;

    const monthlyCost = Number.isFinite(data.total_monthly_cost) ? `$${Number(data.total_monthly_cost).toFixed(2)}` : 'N/A';
    const costPerRequest = Number.isFinite(data.cost_per_request)
      ? `$${Number(data.cost_per_request).toFixed(4)} per request`
      : 'N/A per request';

    this.updateMetricCard('monthly-cost', monthlyCost, costPerRequest, 'cost');

    // Update efficiency score (may be null when cost data is unavailable)
    const efficiency = Number.isFinite(data.cost_efficiency_score)
      ? data.cost_efficiency_score.toFixed(1)
      : 'N/A';
    this.updateMetricCard('efficiency-score', efficiency, data.notes || '', 'efficiency');

    // Create cost breakdown chart (only when real data is available)
    this.createCostBreakdownChart(data);
  }

  /**
   * Update guard violations display
   */
  updateGuardViolationsDisplay(data) {
    if (!data) return;

    const violations = data.violations || [];
    const summary = data.summary || {
      total_violations: 0,
      active_violations: 0,
      critical_violations: 0
    };

    // Update summary
    document.getElementById('total-violations').textContent = summary.total_violations ?? 0;
    document.getElementById('active-violations').textContent = summary.active_violations ?? 0;
    document.getElementById('critical-alerts').textContent = summary.critical_violations ?? 0;

    // Update violations list
    const violationsList = document.getElementById('violations-list');
    if (violationsList && violations.length > 0) {
      violationsList.innerHTML = violations.map(violation => `
        <div class="violation-item ${violation.resolved ? 'resolved' : 'active'} ${violation.severity}">
          <div class="violation-header">
            <span class="violation-type">${violation.type.toUpperCase()}</span>
            <span class="violation-severity">${violation.severity.toUpperCase()}</span>
            <span class="violation-time">${new Date(violation.timestamp).toLocaleString()}</span>
          </div>
          <div class="violation-description">${violation.description}</div>
          <div class="violation-details">
            Value: ${violation.metric_value} | Threshold: ${violation.threshold_value}
            ${violation.resolved ? ` | Resolved: ${new Date(violation.resolution_time).toLocaleString()}` : ''}
          </div>
        </div>
      `).join('');
    } else {
      violationsList.innerHTML = '<div class="no-violations">No violations found</div>';
    }
  }

  /**
   * Update system health display
   */
  updateHealthDisplay(data) {
    if (!data) return;

    // You can add additional health display logic here
    console.log('Dashboard health:', data);
  }

  /**
   * Update individual metric card
   */
  updateMetricCard(cardId, value, detail = '', type = '') {
    const card = document.getElementById(cardId);
    if (!card) return;

    const valueElement = card.querySelector('.metric-value');
    const detailElement = card.querySelector('.metric-detail, .metric-change');

    if (valueElement) valueElement.textContent = value;
    if (detailElement && detail) detailElement.textContent = detail;
  }

  /**
   * Update progress bar
   */
  updateProgressBar(cardId, percentage) {
    const card = document.getElementById(cardId);
    if (!card) return;

    if (percentage === null || percentage === undefined || !Number.isFinite(percentage)) {
      return;
    }

    const progressFill = card.querySelector('.progress-fill');
    if (progressFill) {
      progressFill.style.width = `${Math.min(percentage, 100)}%`;

      // Color coding based on percentage
      if (percentage > 90) {
        progressFill.style.backgroundColor = '#dc3545'; // Red
      } else if (percentage > 75) {
        progressFill.style.backgroundColor = '#ffc107'; // Yellow
      } else {
        progressFill.style.backgroundColor = '#28a745'; // Green
      }
    }
  }

  /**
   * Create cost breakdown chart (simple implementation)
   */
  createCostBreakdownChart(data) {
    const canvas = document.getElementById('cost-breakdown-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple pie chart implementation
    const total = data.total_monthly_cost;
    if (!Number.isFinite(total) || !data.storage_costs || !data.compute_costs || !data.bandwidth_costs) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#6c757d';
      ctx.fillText('Cost data unavailable', 40, canvas.height / 2);
      return;
    }

    const segments = [
      { label: 'Compute', value: data.compute_costs.total_compute, color: '#007bff' },
      { label: 'Storage', value: data.storage_costs.total_storage, color: '#28a745' },
      { label: 'Bandwidth', value: data.bandwidth_costs.total_bandwidth, color: '#ffc107' }
    ];

    // Draw pie chart
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let currentAngle = -Math.PI / 2;

    segments.forEach(segment => {
      const sliceAngle = (segment.value / total) * 2 * Math.PI;

      // Draw slice
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = segment.color;
      ctx.fill();

      currentAngle += sliceAngle;
    });

    // Store chart reference
    this.charts.set('cost-breakdown', { ctx, canvas, data });
  }

  /**
   * Format a numeric value with optional suffix
   */
  formatNumber(value, decimals = 1, suffix = '') {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return 'N/A';
    }
    return `${Number(value).toFixed(decimals)}${suffix}`;
  }

  /**
   * Format percentage values, accepting 0-1 or 0-100 inputs
   */
  formatPercent(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return 'N/A';
    }
    const num = Number(value) <= 1 ? Number(value) * 100 : Number(value);
    return `${num.toFixed(1)}%`;
  }

  /**
   * Refresh all dashboard data
   */
  async refreshAllData() {
    try {
      this.showLoading(true);
      await this.client.refreshDashboardData();
      await this.loadInitialData();
      this.showNotification('Dashboard data refreshed successfully', 'success');
    } catch (error) {
      console.error('Failed to refresh data:', error);
      this.showNotification('Failed to refresh data: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh() {
    const toggle = document.getElementById('auto-refresh-toggle');
    if (!toggle) return;

    this.config.autoRefresh = !this.config.autoRefresh;

    if (this.config.autoRefresh) {
      this.client.startAutoRefresh();
      toggle.textContent = 'Auto-Refresh: ON';
      toggle.classList.remove('btn-danger');
      toggle.classList.add('btn-secondary');
    } else {
      this.client.stopAutoRefresh();
      toggle.textContent = 'Auto-Refresh: OFF';
      toggle.classList.remove('btn-secondary');
      toggle.classList.add('btn-danger');
    }
  }

  /**
   * Handle time range change
   */
  onTimeRangeChange(timeRange) {
    console.log('Time range changed to:', timeRange);
    // Implement time range filtering logic
    this.loadInitialData();
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    this.client.startAutoRefresh();
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    this.client.stopAutoRefresh();
  }

  /**
   * Show/hide loading spinner
   */
  showLoading(show) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
      spinner.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    if (errorDiv && errorText) {
      errorText.textContent = message;
      errorDiv.style.display = 'block';
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    container.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  /**
   * Event emitter functionality
   */
  on(event, callback) {
    if (!this.eventListeners) {
      this.eventListeners = new Map();
    }
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  emit(event, data) {
    if (!this.eventListeners) return;
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in dashboard event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Destroy dashboard and cleanup resources
   */
  destroy() {
    if (this.client) {
      this.client.destroy();
    }

    if (this.container) {
      this.container.innerHTML = '';
    }

    this.components.clear();
    this.charts.clear();
    this.isInitialized = false;

    console.log('Dashboard controller destroyed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BIDashboardController;
} else if (typeof window !== 'undefined') {
  window.BIDashboardController = BIDashboardController;
}
