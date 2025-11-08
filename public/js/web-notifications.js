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
        await this.subscribeToPush();
    }

    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered');
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    async subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
            });

            this.subscription = subscription;
            this.storeSubscriptionId(subscription);
            await this.sendSubscriptionToServer(subscription);

            console.log('Push notification subscription successful');
        } catch (error) {
            console.error('Push subscription failed:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    getStoredSubscriptionId() {
        try {
            return localStorage.getItem('webpush_subscription_id');
        } catch (error) {
            console.warn('Cannot access localStorage:', error);
            return null;
        }
    }

    storeSubscriptionId(subscription) {
        try {
            const subscriptionId = btoa(JSON.stringify(subscription));
            localStorage.setItem('webpush_subscription_id', subscriptionId);
        } catch (error) {
            console.warn('Cannot store subscription ID:', error);
        }
    }

    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch(`${this.apiUrl}/api/v1/notifications/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscription: subscription,
                    subscriptionId: this.subscriptionId
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            console.log('Subscription sent to server');
        } catch (error) {
            console.error('Failed to send subscription to server:', error);
        }
    }

    async unsubscribe() {
        if (this.subscription) {
            try {
                await this.subscription.unsubscribe();
                localStorage.removeItem('webpush_subscription_id');
                console.log('Unsubscribed from push notifications');
            } catch (error) {
                console.error('Failed to unsubscribe:', error);
            }
        }
    }

    // Notification methods for 4-moment reports
    async showPreMarketNotification(data) {
        if (this.isSupported && Notification.permission === 'granted') {
            const notification = new Notification('Pre-Market Briefing', {
                body: data.message,
                icon: '/images/icon-192x192.png',
                badge: '/images/badge-72x72.png',
                tag: 'pre-market',
                requireInteraction: true,
                actions: [
                    {
                        action: 'view',
                        title: 'View Briefing'
                    }
                ]
            });

            notification.onclick = () => {
                window.open('/pre-market-briefing', '_blank');
                notification.close();
            };
        }
    }

    async showIntradayNotification(data) {
        if (this.isSupported && Notification.permission === 'granted') {
            const notification = new Notification('Intraday Update', {
                body: data.message,
                icon: '/images/icon-192x192.png',
                badge: '/images/badge-72x72.png',
                tag: 'intraday'
            });

            setTimeout(() => notification.close(), 5000);
        }
    }

    async showEndOfDayNotification(data) {
        if (this.isSupported && Notification.permission === 'granted') {
            const notification = new Notification('End-of-Day Summary', {
                body: data.message,
                icon: '/images/icon-192x192.png',
                badge: '/images/badge-72x72.png',
                tag: 'end-of-day',
                requireInteraction: true,
                actions: [
                    {
                        action: 'view',
                        title: 'View Summary'
                    }
                ]
            });

            notification.onclick = () => {
                window.open('/end-of-day-summary', '_blank');
                notification.close();
            };
        }
    }

    async showWeeklyReviewNotification(data) {
        if (this.isSupported && Notification.permission === 'granted') {
            const notification = new Notification('Weekly Review', {
                body: data.message,
                icon: '/images/icon-192x192.png',
                badge: '/images/badge-72x72.png',
                tag: 'weekly-review',
                requireInteraction: true,
                actions: [
                    {
                        action: 'view',
                        title: 'View Review'
                    }
                ]
            });

            notification.onclick = () => {
                window.open('/weekly-review', '_blank');
                notification.close();
            };
        }
    }
}

// Initialize notification client
let webNotificationClient;

document.addEventListener('DOMContentLoaded', () => {
    webNotificationClient = new WebNotificationClient();
});

// Export for global access
window.WebNotificationClient = WebNotificationClient;
window.webNotificationClient = webNotificationClient;

console.log('Web Notifications module loaded');