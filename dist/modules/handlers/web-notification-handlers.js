/**
 * Web Notification HTTP Request Handlers
 * Handles Chrome web notification system for 4 Moment Report alerts
 * Replaces Facebook Messenger integration
 */
import { WebNotificationManager } from '../web-notifications.js';
import { createLogger, logBusinessMetric } from '../logging.js';
import { KVKeyFactory, KeyTypes } from '../kv-key-factory.js';
import { createSimplifiedEnhancedDAL } from '../simplified-enhanced-dal.js';
const logger = createLogger('web-notification-handlers');
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Create standardized JSON response
 */
function createJsonResponse(data, status = 200, headers = { 'Content-Type': 'application/json' }) {
    return new Response(JSON.stringify(data), {
        status,
        headers
    });
}
/**
 * Extract and validate subscription ID from URL
 */
function extractSubscriptionId(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('id');
    }
    catch (error) {
        logger.error('Failed to parse URL', { url, error: error.message });
        return null;
    }
}
/**
 * Validate subscription data structure
 */
function validateSubscriptionData(subscription) {
    return (subscription &&
        typeof subscription.endpoint === 'string' &&
        subscription.endpoint.length > 0 &&
        subscription.keys &&
        typeof subscription.keys.p256dh === 'string' &&
        typeof subscription.keys.auth === 'string');
}
/**
 * Sanitize and validate notification preferences
 */
function sanitizePreferences(preferences) {
    return {
        enabled: Boolean(preferences.enabled),
        preMarket: Boolean(preferences.preMarket),
        intraday: Boolean(preferences.intraday),
        endOfDay: Boolean(preferences.endOfDay),
        weeklyReview: Boolean(preferences.weeklyReview),
        minConfidence: Math.max(0, Math.min(1, Number(preferences.minConfidence) || 0.7)),
        quietHours: {
            enabled: Boolean(preferences.quietHours?.enabled),
            start: preferences.quietHours?.start || '22:00',
            end: preferences.quietHours?.end || '07:00'
        },
        soundEnabled: Boolean(preferences.soundEnabled),
        vibrationEnabled: Boolean(preferences.vibrationEnabled)
    };
}
// ============================================================================
// Handler Functions
// ============================================================================
/**
 * Handle notification subscription registration
 */
export async function handleNotificationSubscription(request, env) {
    const requestId = crypto.randomUUID();
    logger.info('Notification subscription request received', { requestId });
    try {
        const subscription = await request.json();
        // Validate subscription data
        if (!validateSubscriptionData(subscription)) {
            const response = {
                success: false,
                error: 'Invalid subscription data'
            };
            return createJsonResponse(response, 400);
        }
        const notificationManager = new WebNotificationManager(env);
        // Create enriched subscription with required timestamps
        const enrichedSubscription = {
            ...subscription,
            createdAt: Date.now(),
            lastActive: Date.now()
        };
        const result = await notificationManager.registerSubscriber(enrichedSubscription);
        if (result.success) {
            // Log business metric
            const metric = {
                subscriptionId: result.subscriptionId,
                endpoint: subscription.endpoint
            };
            logBusinessMetric('notification_subscription_registered', metric);
            const response = {
                success: true,
                subscriptionId: result.subscriptionId,
                message: 'Successfully subscribed to notifications'
            };
            return createJsonResponse(response, 200, {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId
            });
        }
        else {
            const response = {
                success: false,
                error: result.error
            };
            return createJsonResponse(response, 500);
        }
    }
    catch (error) {
        logger.error('Notification subscription error', {
            error: error.message,
            requestId
        });
        const response = {
            success: false,
            error: 'Failed to process subscription'
        };
        return createJsonResponse(response, 500);
    }
}
/**
 * Handle notification subscription unregistration
 */
export async function handleNotificationUnsubscription(request, env) {
    const requestId = crypto.randomUUID();
    const subscriptionId = extractSubscriptionId(request.url);
    if (!subscriptionId) {
        const response = {
            success: false,
            error: 'Subscription ID required'
        };
        return createJsonResponse(response, 400);
    }
    logger.info('Notification unsubscription request', { requestId, subscriptionId });
    try {
        const notificationManager = new WebNotificationManager(env);
        const success = await notificationManager.unregisterSubscriber(subscriptionId);
        if (success) {
            const metric = {
                subscriptionId
            };
            logBusinessMetric('notification_subscription_unregistered', metric);
            const response = {
                success: true,
                message: 'Successfully unsubscribed from notifications'
            };
            return createJsonResponse(response, 200, {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId
            });
        }
        else {
            const response = {
                success: false,
                error: 'Failed to unsubscribe'
            };
            return createJsonResponse(response, 500);
        }
    }
    catch (error) {
        logger.error('Notification unsubscription error', {
            error: error.message,
            requestId,
            subscriptionId
        });
        const response = {
            success: false,
            error: 'Failed to process unsubscription'
        };
        return createJsonResponse(response, 500);
    }
}
/**
 * Handle notification preferences update
 */
export async function handleNotificationPreferences(request, env) {
    const requestId = crypto.randomUUID();
    const subscriptionId = extractSubscriptionId(request.url);
    if (!subscriptionId) {
        const response = {
            success: false,
            error: 'Subscription ID required'
        };
        return createJsonResponse(response, 400);
    }
    logger.info('Notification preferences update', { requestId, subscriptionId });
    try {
        const preferences = await request.json();
        // Validate and sanitize preferences
        const validPreferences = sanitizePreferences(preferences);
        // Use enhanced DAL directly to update preferences
        const dal = createSimplifiedEnhancedDAL(env);
        const prefKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
            component: `notification_preferences_${subscriptionId}`
        });
        await dal.write(prefKey, validPreferences, {
            expirationTtl: 86400 * 30 // 30 days TTL
        });
        const metric = {
            subscriptionId,
            preferences: validPreferences
        };
        logBusinessMetric('notification_preferences_updated', metric);
        const response = {
            success: true,
            message: 'Preferences updated successfully',
            preferences: validPreferences
        };
        return createJsonResponse(response, 200, {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
        });
    }
    catch (error) {
        logger.error('Notification preferences update error', {
            error: error.message,
            requestId,
            subscriptionId
        });
        const response = {
            success: false,
            error: 'Failed to update preferences'
        };
        return createJsonResponse(response, 500);
    }
}
/**
 * Handle notification history retrieval
 */
export async function handleNotificationHistory(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('id');
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '10')));
    if (!subscriptionId) {
        const response = {
            success: false,
            error: 'Subscription ID required'
        };
        return createJsonResponse(response, 400);
    }
    logger.info('Notification history request', { requestId, subscriptionId, limit });
    try {
        const notificationManager = new WebNotificationManager(env);
        const history = await notificationManager.getNotificationHistory(subscriptionId, limit);
        const response = {
            success: true,
            history,
            count: history.length
        };
        return createJsonResponse(response, 200, {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
        });
    }
    catch (error) {
        logger.error('Notification history error', {
            error: error.message,
            requestId,
            subscriptionId
        });
        const response = {
            success: false,
            error: 'Failed to retrieve notification history'
        };
        return createJsonResponse(response, 500);
    }
}
/**
 * Handle test notification sending
 */
export async function handleTestNotification(request, env) {
    const requestId = crypto.randomUUID();
    logger.info('Test notification request', { requestId });
    try {
        const { type = 'pre_market', subscriptionId } = await request.json();
        const notificationManager = new WebNotificationManager(env);
        let notification;
        switch (type) {
            case 'pre_market':
                notification = await notificationManager.createPreMarketNotification({
                    symbols: ['AAPL', 'MSFT'],
                    insights: ['Strong bullish sentiment detected'],
                    confidence: 0.85
                });
                break;
            case 'intraday':
                notification = await notificationManager.createIntradayNotification({
                    performingSymbols: ['GOOGL', 'TSLA'],
                    accuracy: 0.78
                });
                break;
            case 'end_of_day':
                notification = await notificationManager.createEndOfDayNotification({
                    summary: 'Markets closed with mixed results',
                    tomorrowOutlook: 'Positive outlook expected',
                    confidence: 0.82
                });
                break;
            case 'weekly_review':
                notification = await notificationManager.createWeeklyReviewNotification({
                    weekNumber: 42,
                    topPerformers: ['NVDA', 'AMD'],
                    accuracy: 0.80
                });
                break;
            default:
                throw new Error(`Invalid notification type: ${type}`);
        }
        // Update notification title for test
        notification.title = `🧪 Test: ${notification.title}`;
        notification.body = `This is a test notification. ${notification.body}`;
        const result = await notificationManager.sendNotification(notification);
        const metric = {
            type,
            sent: result.sent,
            failed: result.failed
        };
        logBusinessMetric('test_notification_sent', metric);
        const response = {
            success: true,
            message: 'Test notification sent successfully',
            result: {
                sent: result.sent,
                failed: result.failed,
                errors: result.errors
            },
            notification: {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                body: notification.body
            }
        };
        return createJsonResponse(response, 200, {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
        });
    }
    catch (error) {
        logger.error('Test notification error', {
            error: error.message,
            requestId
        });
        const response = {
            success: false,
            error: 'Failed to send test notification'
        };
        return createJsonResponse(response, 500);
    }
}
/**
 * Handle notification status check
 */
export async function handleNotificationStatus(request, env) {
    const requestId = crypto.randomUUID();
    logger.info('Notification status request', { requestId });
    try {
        const notificationManager = new WebNotificationManager(env);
        // Get notification statistics from KV
        const today = new Date().toISOString().split('T')[0];
        const analyticsKey = KVKeyFactory.generateKey(KeyTypes.PERFORMANCE_METADATA, {
            date: today
        });
        const dal = createSimplifiedEnhancedDAL(env);
        const analyticsResult = await dal.read(analyticsKey);
        const analytics = analyticsResult.success ? analyticsResult.data : {};
        const notifications = analytics.notifications || {};
        const status = {
            supported: typeof Notification !== 'undefined',
            permission: 'default', // This would be client-side
            statistics: {
                preMarket: notifications.pre_market || { sent: 0, failed: 0 },
                intraday: notifications.intraday || { sent: 0, failed: 0 },
                endOfDay: notifications.end_of_day || { sent: 0, failed: 0 },
                weeklyReview: notifications.weekly_review || { sent: 0, failed: 0 }
            },
            total: {
                sent: Object.values(notifications).reduce((sum, stat) => sum + (stat.sent || 0), 0),
                failed: Object.values(notifications).reduce((sum, stat) => sum + (stat.failed || 0), 0)
            }
        };
        const response = {
            success: true,
            status
        };
        return createJsonResponse(response, 200, {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
        });
    }
    catch (error) {
        logger.error('Notification status error', {
            error: error.message,
            requestId
        });
        const response = {
            success: false,
            error: 'Failed to get notification status'
        };
        return createJsonResponse(response, 500);
    }
}
// ============================================================================
// Exports
// ============================================================================
//# sourceMappingURL=web-notification-handlers.js.map