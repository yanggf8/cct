/**
 * Service Worker for Web Push Notifications
 * Handles Chrome web notifications for 4 Moment Report alerts
 */

const CACHE_NAME = 'tft-notifications-v1';
const API_URL = self.location.origin;

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker cache opened');
        return cache.addAll([
          '/',
          '/pre-market-briefing',
          '/intraday-check',
          '/end-of-day-summary',
          '/weekly-review',
          '/js/web-notifications.js',
          '/favicon.ico'
        ]);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Push event
self.addEventListener('push', (event) => {
  console.log('Push notification received');

  if (!event.data) {
    console.warn('No data in push event');
    return;
  }

  try {
    const data = event.data.json();
    console.log('Push notification data:', data);

    const options = {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      tag: data.tag,
      data: data.data,
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
        .then((notification) => {
          console.log('Notification shown successfully');
        })
        .catch((error) => {
          console.error('Error showing notification:', error);
        })
    );
  } catch (error) {
    console.error('Error parsing push notification data:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  const notification = event.notification;
  const data = notification.data;

  notification.close();

  // Handle action clicks
  if (event.action) {
    console.log('Notification action clicked:', event.action);

    if (event.action === 'dismiss') {
      return; // Don't navigate for dismiss action
    }

    // Handle other actions
    handleNotificationAction(event.action, data);
    return;
  }

  // Default behavior: navigate to URL if provided
  if (data && data.url) {
    event.waitUntil(
      clients.openWindow(data.url)
    );
  }
});

// Handle notification actions
async function handleNotificationAction(action, data) {
  console.log('Handling notification action:', action, data);

  try {
    let url = data.url || '/';

    // Handle specific actions
    switch (action) {
      case 'view':
        // Navigate to the default URL
        break;
      case 'view_briefing':
        url = '/pre-market-briefing';
        break;
      case 'view_intraday':
        url = '/intraday-check';
        break;
      case 'view_summary':
        url = '/end-of-day-summary';
        break;
      case 'view_review':
        url = '/weekly-review';
        break;
      default:
        console.warn('Unknown action:', action);
        return;
    }

    // Try to focus existing client first
    const client = await findOrCreateClient(url);
    if (client) {
      // Send message to client about the notification action
      client.postMessage({
        type: 'notification-click',
        action: action,
        url: url,
        data: data
      });
    }
  } catch (error) {
    console.error('Error handling notification action:', error);
  }
}

// Find or create client for URL
async function findOrCreateClient(url) {
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  // Try to find client with matching URL
  for (const client of clientList) {
    const clientUrl = new URL(client.url);
    if (clientUrl.pathname === new URL(url).pathname) {
      await client.focus();
      return client;
    }
  }

  // Try to find any client
  for (const client of clientList) {
    await client.focus();
    return client;
  }

  // Open new window
  try {
    const newClient = await clients.openWindow(url);
    return newClient;
  } catch (error) {
    console.error('Error opening new window:', error);
    return null;
  }
}

// Fetch event - handle offline support
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }

        // Otherwise, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Cache new responses for GET requests
            if (event.request.method === 'GET' && response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline fallback for HTML pages
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return new Response(
                '<html><body><h1>Offline</h1><p>You are currently offline. Please check your internet connection.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            }
            throw new Error('Network request failed');
          });
      })
  );
});

// Message event from clients
self.addEventListener('message', (event) => {
  console.log('Message received from client:', event.data);

  // Handle different message types
  switch (event.data.type) {
    case 'get_subscription':
      // Return current subscription info
      event.waitUntil(
        self.registration.pushManager.getSubscription()
          .then((subscription) => {
            if (subscription) {
              event.ports[0].postMessage({
                type: 'subscription_info',
                subscription: subscription.toJSON()
              });
            } else {
              event.ports[0].postMessage({
                type: 'subscription_info',
                subscription: null
              });
            }
          })
      );
      break;

    case 'unsubscribe':
      // Unsubscribe from notifications
      event.waitUntil(
        self.registration.pushManager.getSubscription()
          .then((subscription) => {
            if (subscription) {
              return subscription.unsubscribe()
                .then(() => {
                  event.ports[0].postMessage({
                    type: 'unsubscribed',
                    success: true
                  });
                });
            } else {
              event.ports[0].postMessage({
                type: 'unsubscribed',
                success: false,
                error: 'No subscription found'
              });
            }
          })
      );
      break;

    default:
      console.warn('Unknown message type:', event.data.type);
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

// Unhandled promise rejection
self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in Service Worker:', event.reason);
  event.preventDefault();
});

console.log('Service Worker loaded successfully');