/**
 * Client-side Web Notifications JavaScript
 * Chrome web notification client for 4 Moment Report alerts
 * Replaces Facebook Messenger integration
 */

class WebNotificationClient {
  constructor() {
    this.subscription = null;
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    this.publicKey = 'BMv2ZtjLzBB6CjN_2Lz5n2r7n1s1p1Q3W9r8s1w1t1y2u3i4o5p6a7s8d9f0g1h2j'; // Your VAPID public key
    this.apiUrl = window.location.origin;
    this.subscriptionId = this.getStoredSubscriptionId();

    this.init();
  }

  async init() {
    if (!this.isSupported) {
      console.warn('Web notifications are not supported in this browser');
      return;
    }

    await this.registerServiceWorker();
    await this.checkExistingSubscription();
    this.setupEventListeners();
  }

  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  async checkExistingSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      this.subscription = await registration.pushManager.getSubscription();

      if (this.subscription) {
        console.log('Existing subscription found');
        if (!this.subscriptionId) {
          await this.storeSubscriptionId(this.subscription);
        }
      }
    } catch (error) {
      console.error('Error checking existing subscription:', error);
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Web notifications are not supported');
    }

    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);

    if (permission === 'granted') {
      await this.subscribe();
      return true;
    } else if (permission === 'denied') {
      throw new Error('Notification permission denied');
    } else {
      throw new Error('Notification permission dismissed');
    }
  }

  async subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;

      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
      });

      await this.storeSubscriptionId(this.subscription);
      await this.sendSubscriptionToServer();

      console.log('Successfully subscribed to notifications');
      return this.subscription;
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      throw error;
    }
  }

  async unsubscribe() {
    if (!this.subscription) {
      console.warn('No active subscription to unsubscribe');
      return true;
    }

    try {
      await this.subscription.unsubscribe();
      await this.removeSubscriptionFromServer();
      this.removeStoredSubscriptionId();
      this.subscription = null;

      console.log('Successfully unsubscribed from notifications');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error);
      throw error;
    }
  }

  async sendSubscriptionToServer() {
    if (!this.subscription || !this.subscriptionId) {
      throw new Error('No subscription to send');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint,
          keys: {
            p256dh: this.subscription.toJSON().keys.p256dh,
            auth: this.subscription.toJSON().keys.auth
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        this.subscriptionId = result.subscriptionId;
        this.storeSubscriptionId(this.subscription);
      } else {
        throw new Error(result.error || 'Server rejected subscription');
      }

      console.log('Subscription sent to server successfully');
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      throw error;
    }
  }

  async removeSubscriptionFromServer() {
    if (!this.subscriptionId) {
      console.warn('No subscription ID to remove');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/notifications/unsubscribe?id=${this.subscriptionId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      console.log('Subscription removed from server successfully');
    } catch (error) {
      console.error('Error removing subscription from server:', error);
      throw error;
    }
  }

  async updatePreferences(preferences) {
    if (!this.subscriptionId) {
      throw new Error('No subscription to update preferences for');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/notifications/preferences?id=${this.subscriptionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('Preferences updated successfully');
        return result.preferences;
      } else {
        throw new Error(result.error || 'Server rejected preferences update');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  async getNotificationHistory(limit = 10) {
    if (!this.subscriptionId) {
      return [];
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/notifications/history?id=${this.subscriptionId}&limit=${limit}`);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.history : [];
    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  async sendTestNotification(type = 'pre_market') {
    if (!this.subscriptionId) {
      throw new Error('No subscription to send test notification to');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          subscriptionId: this.subscriptionId
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('Test notification sent successfully');
        return result;
      } else {
        throw new Error(result.error || 'Server rejected test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw error;
    }
  }

  async getStatus() {
    try {
      const response = await fetch(`${this.apiUrl}/api/notifications/status`);

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.status : null;
    } catch (error) {
      console.error('Error getting notification status:', error);
      return null;
    }
  }

  // Notification UI helpers
  createNotificationUI() {
    const container = document.createElement('div');
    container.id = 'web-notification-ui';
    container.innerHTML = `
      <div class="notification-widget">
        <div class="notification-header">
          <h3>🔔 Web Notifications</h3>
          <button id="toggle-notifications" class="toggle-btn">
            ${this.subscription ? 'Disable' : 'Enable'}
          </button>
        </div>
        <div class="notification-content" style="display: ${this.subscription ? 'block' : 'none'}">
          <div class="notification-preferences">
            <h4>Preferences</h4>
            <label>
              <input type="checkbox" id="pref-premarket" checked>
              Pre-Market Briefing (8:30 AM)
            </label>
            <label>
              <input type="checkbox" id="pref-intraday" checked>
              Intraday Check (12:00 PM)
            </label>
            <label>
              <input type="checkbox" id="pref-endofday" checked>
              End-of-Day Summary (4:05 PM)
            </label>
            <label>
              <input type="checkbox" id="pref-weekly" checked>
              Weekly Review (Sunday 10 AM)
            </label>
            <div class="preference-row">
              <label for="pref-confidence">Min Confidence:</label>
              <input type="range" id="pref-confidence" min="0" max="100" value="70">
              <span id="confidence-value">70%</span>
            </div>
            <div class="preference-row">
              <label>
                <input type="checkbox" id="pref-quiet-hours">
                Quiet Hours
              </label>
              <input type="time" id="quiet-start" value="22:00">
              <span>to</span>
              <input type="time" id="quiet-end" value="07:00">
            </div>
            <div class="notification-actions">
              <button id="save-preferences">Save Preferences</button>
              <button id="test-notification">Test Notification</button>
              <button id="view-history">View History</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.addNotificationStyles();
    this.setupNotificationUIEvents(container);

    return container;
  }

  addNotificationStyles() {
    if (document.getElementById('web-notification-styles')) {
      return;
    }

    const styles = document.createElement('style');
    styles.id = 'web-notification-styles';
    styles.textContent = `
      .notification-widget {
        background: rgba(79, 172, 254, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        backdrop-filter: blur(10px);
      }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .notification-header h3 {
        margin: 0;
        color: #4facfe;
      }

      .toggle-btn {
        background: #4facfe;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
      }

      .toggle-btn:hover {
        background: #3a8bfe;
      }

      .notification-preferences label {
        display: block;
        margin: 10px 0;
        color: #ffffff;
      }

      .preference-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 10px 0;
        color: #ffffff;
      }

      .preference-row input[type="time"] {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .preference-row input[type="range"] {
        flex: 1;
      }

      .notification-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
        flex-wrap: wrap;
      }

      .notification-actions button {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      }

      .notification-actions button:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      #confidence-value {
        color: #4facfe;
        font-weight: 600;
        min-width: 40px;
      }
    `;

    document.head.appendChild(styles);
  }

  setupNotificationUIEvents(container) {
    const toggleBtn = container.querySelector('#toggle-notifications');
    const saveBtn = container.querySelector('#save-preferences');
    const testBtn = container.querySelector('#test-notification');
    const historyBtn = container.querySelector('#view-history');
    const confidenceSlider = container.querySelector('#pref-confidence');
    const confidenceValue = container.querySelector('#confidence-value');

    // Toggle notifications
    toggleBtn.addEventListener('click', async () => {
      try {
        if (this.subscription) {
          await this.unsubscribe();
          toggleBtn.textContent = 'Enable';
          container.querySelector('.notification-content').style.display = 'none';
        } else {
          await this.requestPermission();
          toggleBtn.textContent = 'Disable';
          container.querySelector('.notification-content').style.display = 'block';
        }
      } catch (error) {
        this.showError(error.message);
      }
    });

    // Update confidence display
    confidenceSlider.addEventListener('input', (e) => {
      confidenceValue.textContent = e.target.value + '%';
    });

    // Save preferences
    saveBtn.addEventListener('click', async () => {
      try {
        const preferences = {
          enabled: true,
          preMarket: container.querySelector('#pref-premarket').checked,
          intraday: container.querySelector('#pref-intraday').checked,
          endOfDay: container.querySelector('#pref-endofday').checked,
          weeklyReview: container.querySelector('#pref-weekly').checked,
          minConfidence: parseInt(confidenceSlider.value) / 100,
          quietHours: {
            enabled: container.querySelector('#pref-quiet-hours').checked,
            start: container.querySelector('#quiet-start').value,
            end: container.querySelector('#quiet-end').value
          },
          soundEnabled: true,
          vibrationEnabled: true
        };

        await this.updatePreferences(preferences);
        this.showSuccess('Preferences saved successfully');
      } catch (error) {
        this.showError(error.message);
      }
    });

    // Test notification
    testBtn.addEventListener('click', async () => {
      try {
        await this.sendTestNotification();
        this.showSuccess('Test notification sent');
      } catch (error) {
        this.showError(error.message);
      }
    });

    // View history
    historyBtn.addEventListener('click', async () => {
      try {
        const history = await this.getNotificationHistory();
        this.showNotificationHistory(history);
      } catch (error) {
        this.showError(error.message);
      }
    });
  }

  setupEventListeners() {
    // Listen for notification clicks
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'notification-click') {
        // Handle notification click
        const url = event.data.url;
        if (url) {
          window.location.href = url;
        }
      }
    });
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : '#4facfe'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  }

  showNotificationHistory(history) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #1a2332;
      border-radius: 12px;
      padding: 20px;
      max-width: 500px;
      width: 90%;
      max-height: 70vh;
      overflow-y: auto;
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #4facfe;">📋 Notification History</h3>
      ${history.length === 0 ? '<p style="color: #ffffff;">No notifications yet</p>' : ''}
      ${history.map(notif => `
        <div style="background: rgba(255,255,255,0.1); padding: 10px; margin: 10px 0; border-radius: 6px;">
          <div style="font-weight: 600; color: #ffffff;">${notif.title}</div>
          <div style="color: #cccccc; margin: 5px 0;">${notif.body}</div>
          <div style="font-size: 12px; color: #888888;">${new Date(notif.timestamp).toLocaleString()}</div>
        </div>
      `).join('')}
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: #4facfe;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        margin-top: 15px;
        width: 100%;
      ">Close</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // Utility methods
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  storeSubscriptionId(subscription) {
    // Generate a simple ID from the subscription endpoint
    const id = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    localStorage.setItem('web_notification_subscription_id', id);
    this.subscriptionId = id;
  }

  getStoredSubscriptionId() {
    return localStorage.getItem('web_notification_subscription_id');
  }

  removeStoredSubscriptionId() {
    localStorage.removeItem('web_notification_subscription_id');
    this.subscriptionId = null;
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.webNotificationClient = new WebNotificationClient();
  });
} else {
  window.webNotificationClient = new WebNotificationClient();
}

// Export for global access
window.WebNotificationClient = WebNotificationClient;