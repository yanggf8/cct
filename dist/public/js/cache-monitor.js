/**
 * Cache Monitor Component
 * Displays real-time cache performance metrics and timestamp information
 * Shows L1/L2 cache status, deduplication stats, and KV optimization metrics
 */

class CacheMonitor {
  constructor(options = {}) {
    this.options = {
      updateInterval: 30000, // 30 seconds
      enableAutoRefresh: true,
      showDetailedInfo: false,
      ...options
    };

    this.cacheData = {
      timestamps: null,
      metrics: null,
      deduplication: null,
      health: null,
      lastUpdate: null
    };

    this.isMonitoring = false;
    this.updateTimer = null;
  }

  /**
   * Initialize cache monitoring
   */
  async initialize() {
    console.log('Cache Monitor: Initializing...');

    // Create monitoring UI
    this.createMonitorUI();

    // Start monitoring if auto-refresh is enabled
    if (this.options.enableAutoRefresh) {
      this.startMonitoring();
    }

    console.log('Cache Monitor: Initialized successfully');
  }

  /**
   * Create monitoring UI components
   */
  createMonitorUI() {
    // Check if monitor container already exists
    let monitorContainer = document.getElementById('cache-monitor');
    if (monitorContainer) {
      monitorContainer.innerHTML = '';
    } else {
      // Create monitor container
      monitorContainer = document.createElement('div');
      monitorContainer.id = 'cache-monitor';
      monitorContainer.className = 'cache-monitor';

      // Add to dashboard (after header)
      const header = document.querySelector('.dashboard-header');
      if (header && header.parentNode) {
        header.parentNode.insertBefore(monitorContainer, header.nextSibling);
      }
    }

    monitorContainer.innerHTML = `
      <div class="cache-monitor-header">
        <h3>🚀 Cache Performance Monitor</h3>
        <div class="monitor-controls">
          <button id="refresh-cache-data" class="btn btn-sm btn-primary">
            🔄 Refresh
          </button>
          <button id="toggle-detailed-info" class="btn btn-sm btn-secondary">
            📊 Detailed Info
          </button>
          <button id="toggle-auto-refresh" class="btn btn-sm btn-secondary">
            ⏸️ Pause
          </button>
        </div>
      </div>

      <div class="cache-monitor-content">
        <div class="cache-overview">
          <div class="cache-stat-card">
            <div class="stat-title">Cache Status</div>
            <div class="stat-value" id="cache-status">Loading...</div>
            <div class="stat-subtitle">System health</div>
          </div>

          <div class="cache-stat-card">
            <div class="stat-title">Hit Rate</div>
            <div class="stat-value" id="cache-hit-rate">--%</div>
            <div class="stat-subtitle">Overall performance</div>
          </div>

          <div class="cache-stat-card">
            <div class="stat-title">KV Reduction</div>
            <div class="stat-value" id="kv-reduction">--%</div>
            <div class="stat-subtitle">Optimization impact</div>
          </div>

          <div class="cache-stat-card">
            <div class="stat-title">Response Time</div>
            <div class="stat-value" id="avg-response-time">--ms</div>
            <div class="stat-subtitle">Average latency</div>
          </div>
        </div>

        <div class="cache-details" id="cache-details" style="display: none;">
          <div class="cache-section">
            <h4>📈 L1/L2 Cache Metrics</h4>
            <div class="cache-grid">
              <div class="cache-metric">
                <span class="metric-label">L1 Hit Rate:</span>
                <span class="metric-value" id="l1-hit-rate">--%</span>
              </div>
              <div class="cache-metric">
                <span class="metric-label">L2 Hit Rate:</span>
                <span class="metric-value" id="l2-hit-rate">--%</span>
              </div>
              <div class="cache-metric">
                <span class="metric-label">L1 Size:</span>
                <span class="metric-value" id="l1-size">--</span>
              </div>
              <div class="cache-metric">
                <span class="metric-label">Total Requests:</span>
                <span class="metric-value" id="total-requests">--</span>
              </div>
            </div>
          </div>

          <div class="cache-section">
            <h4>⚡ Request Deduplication</h4>
            <div class="cache-grid">
              <div class="cache-metric">
                <span class="metric-label">Deduplication Rate:</span>
                <span class="metric-value" id="deduplication-rate">--%</span>
              </div>
              <div class="cache-metric">
                <span class="metric-label">Requests Saved:</span>
                <span class="metric-value" id="requests-saved">--</span>
              </div>
              <div class="cache-metric">
                <span class="metric-label">Cache Hits:</span>
                <span class="metric-value" id="cache-hits">--</span>
              </div>
              <div class="cache-metric">
                <span class="metric-label">Memory Usage:</span>
                <span class="metric-value" id="memory-usage">-- MB</span>
              </div>
            </div>
          </div>

          <div class="cache-section">
            <h4>🕐 Cache Timestamps</h4>
            <div class="timestamp-info">
              <div class="timestamp-entry">
                <span class="timestamp-label">Last L1 Cache:</span>
                <span class="timestamp-value" id="last-l1-timestamp">--</span>
              </div>
              <div class="timestamp-entry">
                <span class="timestamp-label">Last L2 Cache:</span>
                <span class="timestamp-value" id="last-l2-timestamp">--</span>
              </div>
              <div class="timestamp-entry">
                <span class="timestamp-label">Cache Freshness:</span>
                <span class="timestamp-value" id="cache-freshness">--</span>
              </div>
            </div>
          </div>
        </div>

        <div class="cache-status-bar">
          <div class="status-item">
            <span class="status-label">Last Update:</span>
            <span class="status-value" id="last-update">Never</span>
          </div>
          <div class="status-item">
            <span class="status-label">Monitor Status:</span>
            <span class="status-value" id="monitor-status">
              <span class="status-dot active"></span> Active
            </span>
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    this.addStyles();

    // Bind event handlers
    this.bindEventHandlers();
  }

  /**
   * Add CSS styles for cache monitor
   */
  addStyles() {
    if (document.getElementById('cache-monitor-styles')) {
      return; // Styles already added
    }

    const styles = `
      <style id="cache-monitor-styles">
        .cache-monitor {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          margin: 20px 0;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .cache-monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .cache-monitor-header h3 {
          margin: 0;
          font-size: 1.2em;
          font-weight: 600;
        }

        .monitor-controls {
          display: flex;
          gap: 10px;
        }

        .cache-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .cache-stat-card {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .stat-title {
          font-size: 0.9em;
          opacity: 0.8;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 1.8em;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .stat-subtitle {
          font-size: 0.8em;
          opacity: 0.7;
        }

        .cache-details {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;
        }

        .cache-section {
          margin-bottom: 25px;
        }

        .cache-section h4 {
          margin: 0 0 15px 0;
          font-size: 1.1em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          padding-bottom: 8px;
        }

        .cache-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .cache-metric {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          font-size: 0.9em;
        }

        .metric-label {
          opacity: 0.8;
        }

        .metric-value {
          font-weight: 600;
        }

        .timestamp-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 10px;
        }

        .timestamp-entry {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          font-size: 0.9em;
        }

        .timestamp-label {
          opacity: 0.8;
        }

        .timestamp-value {
          font-weight: 600;
          font-family: monospace;
        }

        .cache-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 0.8em;
          opacity: 0.8;
        }

        .status-item {
          display: flex;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-dot.active {
          background-color: #4ade80;
          box-shadow: 0 0 4px #4ade80;
        }

        .status-dot.paused {
          background-color: #fbbf24;
          box-shadow: 0 0 4px #fbbf24;
        }

        .btn {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8em;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 0.75em;
        }

        .btn-primary {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .btn-primary:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .btn-secondary {
          background: rgba(0, 0, 0, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover {
          background: rgba(0, 0, 0, 0.3);
        }

        @media (max-width: 768px) {
          .cache-monitor-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .cache-overview {
            grid-template-columns: repeat(2, 1fr);
          }

          .cache-grid,
          .timestamp-info {
            grid-template-columns: 1fr;
          }

          .cache-status-bar {
            flex-direction: column;
            gap: 10px;
            text-align: center;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  /**
   * Bind event handlers
   */
  bindEventHandlers() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-cache-data');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }

    // Toggle detailed info
    const toggleDetailsBtn = document.getElementById('toggle-detailed-info');
    if (toggleDetailsBtn) {
      toggleDetailsBtn.addEventListener('click', () => {
        this.toggleDetailedInfo();
      });
    }

    // Toggle auto refresh
    const toggleAutoRefreshBtn = document.getElementById('toggle-auto-refresh');
    if (toggleAutoRefreshBtn) {
      toggleAutoRefreshBtn.addEventListener('click', () => {
        this.toggleAutoRefresh();
      });
    }
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.updateMonitorStatus('Active');

    // Initial data fetch
    this.refreshData();

    // Set up periodic updates
    this.updateTimer = setInterval(() => {
      this.refreshData();
    }, this.options.updateInterval);

    console.log('Cache Monitor: Started monitoring');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.updateMonitorStatus('Paused');

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    console.log('Cache Monitor: Stopped monitoring');
  }

  /**
   * Refresh cache data
   */
  async refreshData() {
    try {
      // Show loading state
      this.updateStatus('Loading...');

      // Fetch cache metrics
      const [metrics, deduplication, health] = await Promise.allSettled([
        this.fetchCacheMetrics(),
        this.fetchDeduplicationStats(),
        this.fetchHealthStatus()
      ]);

      // Update data
      if (metrics.status === 'fulfilled') {
        this.cacheData.metrics = metrics.value;
        this.updateMetricsDisplay(metrics.value);
      }

      if (deduplication.status === 'fulfilled') {
        this.cacheData.deduplication = deduplication.value;
        this.updateDeduplicationDisplay(deduplication.value);
      }

      if (health.status === 'fulfilled') {
        this.cacheData.health = health.value;
        this.updateHealthDisplay(health.value);
      }

      this.cacheData.lastUpdate = new Date();
      this.updateLastUpdateTime();

      this.updateStatus('Healthy');

    } catch (error) {
      console.error('Cache Monitor: Error refreshing data', error);
      this.updateStatus('Error');
    }
  }

  /**
   * Fetch cache metrics from API
   */
  async fetchCacheMetrics() {
    if (!window.cctApi) {
      throw new Error('API client not available');
    }

    const response = await window.cctApi.get('/cache/metrics');
    return response.data;
  }

  /**
   * Fetch deduplication statistics
   */
  async fetchDeduplicationStats() {
    if (!window.cctApi) {
      throw new Error('API client not available');
    }

    const response = await window.cctApi.get('/cache/deduplication');
    return response.data;
  }

  /**
   * Fetch health status
   */
  async fetchHealthStatus() {
    if (!window.cctApi) {
      throw new Error('API client not available');
    }

    const response = await window.cctApi.get('/cache/health');
    return response.data;
  }

  /**
   * Update metrics display
   */
  updateMetricsDisplay(metrics) {
    if (!metrics) return;

    // Overview stats
    this.updateElement('cache-hit-rate', `${Math.round((metrics.l1HitRate + metrics.l2HitRate) * 100)}%`);
    this.updateElement('l1-size', metrics.l1Size || '--');
    this.updateElement('total-requests', metrics.totalRequests || '--');

    // Detailed metrics
    this.updateElement('l1-hit-rate', `${Math.round(metrics.l1HitRate * 100)}%`);
    this.updateElement('l2-hit-rate', `${Math.round(metrics.l2HitRate * 100)}%`);
  }

  /**
   * Update deduplication display
   */
  updateDeduplicationDisplay(deduplication) {
    if (!deduplication || !deduplication.deduplication) return;

    const stats = deduplication.deduplication.statistics;
    this.updateElement('kv-reduction', stats.kvReduction || '--%');
    this.updateElement('deduplication-rate', `${stats.deduplicationRate}%`);
    this.updateElement('requests-saved', stats.deduplicatedRequests || '--');
    this.updateElement('cache-hits', stats.cacheHits || '--');
    this.updateElement('memory-usage', stats.memoryUsage || '--');
  }

  /**
   * Update health display
   */
  updateHealthDisplay(health) {
    if (!health) return;

    this.updateElement('cache-status', health.health?.status || 'Unknown');
    this.updateElement('avg-response-time', health.performance?.averageResponseTime || '--ms');
  }

  /**
   * Update element content
   */
  updateElement(id, content) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = content;
    }
  }

  /**
   * Update status
   */
  updateStatus(status) {
    this.updateElement('cache-status', status);
  }

  /**
   * Update monitor status
   */
  updateMonitorStatus(status) {
    const statusElement = document.getElementById('monitor-status');
    if (statusElement) {
      const isActive = status === 'Active';
      statusElement.innerHTML = `
        <span class="status-dot ${isActive ? 'active' : 'paused'}"></span> ${status}
      `;
    }
  }

  /**
   * Update last update time
   */
  updateLastUpdateTime() {
    if (this.cacheData.lastUpdate) {
      this.updateElement('last-update', this.formatTime(this.cacheData.lastUpdate));
    }
  }

  /**
   * Format time for display
   */
  formatTime(date) {
    return date.toLocaleTimeString();
  }

  /**
   * Toggle detailed info display
   */
  toggleDetailedInfo() {
    const detailsElement = document.getElementById('cache-details');
    const toggleBtn = document.getElementById('toggle-detailed-info');

    if (detailsElement && toggleBtn) {
      const isVisible = detailsElement.style.display !== 'none';
      detailsElement.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible ? '📊 Detailed Info' : '📊 Hide Details';
      this.options.showDetailedInfo = !isVisible;
    }
  }

  /**
   * Toggle auto refresh
   */
  toggleAutoRefresh() {
    const toggleBtn = document.getElementById('toggle-auto-refresh');

    if (this.isMonitoring) {
      this.stopMonitoring();
      if (toggleBtn) {
        toggleBtn.textContent = '▶️ Resume';
      }
    } else {
      this.startMonitoring();
      if (toggleBtn) {
        toggleBtn.textContent = '⏸️ Pause';
      }
    }
  }

  /**
   * Get current cache data
   */
  getCacheData() {
    return { ...this.cacheData };
  }

  /**
   * Destroy monitor
   */
  destroy() {
    this.stopMonitoring();

    const monitorContainer = document.getElementById('cache-monitor');
    if (monitorContainer) {
      monitorContainer.remove();
    }

    console.log('Cache Monitor: Destroyed');
  }
}

// Export for use in dashboard
window.CacheMonitor = CacheMonitor;