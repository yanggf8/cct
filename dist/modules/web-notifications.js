/**
 * Web Notifications Module - TypeScript
 * Chrome web notification system for 4 Moment Report alerts
 * Replaces Facebook Messenger integration with browser-based notifications
 */
import { createLogger } from './logging.js';
import { KVKeyFactory, KeyTypes } from './kv-key-factory.js';
import { createSimplifiedEnhancedDAL } from './simplified-enhanced-dal.js';
const logger = createLogger('web-notifications');
// Notification Types for 4 Moment System
export var NotificationType;
(function (NotificationType) {
    NotificationType["PRE_MARKET"] = "pre_market";
    NotificationType["INTRADAY"] = "intraday";
    NotificationType["END_OF_DAY"] = "end_of_day";
    NotificationType["WEEKLY_REVIEW"] = "weekly_review";
})(NotificationType || (NotificationType = {}));
/**
 * Web Notification Manager
 */
export class WebNotificationManager {
    constructor(env) {
        this.dal = createSimplifiedEnhancedDAL(env);
        this.preferences = this.getDefaultPreferences();
    }
    /**
     * Get default notification preferences
     */
    getDefaultPreferences() {
        return {
            enabled: true,
            preMarket: true,
            intraday: true,
            endOfDay: true,
            weeklyReview: true,
            minConfidence: 0.7,
            quietHours: {
                enabled: false,
                start: '22:00',
                end: '07:00'
            },
            soundEnabled: true,
            vibrationEnabled: true
        };
    }
    /**
     * Create notification for 4 Moment System
     */
    async createNotification(type, title, body, data = {}, confidence) {
        const notification = {
            id: this.generateNotificationId(),
            type,
            title,
            body,
            tag: `tft-${type}-${Date.now()}`,
            data: {
                url: this.getDefaultUrlForType(type),
                timestamp: Date.now(),
                confidence,
                ...data
            },
            actions: this.getDefaultActionsForType(type),
            requireInteraction: type === NotificationType.PRE_MARKET,
            timestamp: Date.now()
        };
        // Set icon based on type
        notification.icon = this.getIconForType(type);
        notification.badge = '/favicon.ico';
        return notification;
    }
    /**
     * Send notification to subscribers
     */
    async sendNotification(notification) {
        logger.info('Sending web notification', {
            type: notification.type,
            title: notification.title,
            id: notification.id
        });
        const result = {
            success: true,
            sent: 0,
            failed: 0,
            errors: []
        };
        try {
            // Get active subscribers
            const subscribers = await this.getActiveSubscribers();
            for (const subscriber of subscribers) {
                try {
                    // Check user preferences
                    const preferences = await this.getUserPreferences(subscriber.userId);
                    if (!this.shouldSendNotification(notification, preferences)) {
                        continue;
                    }
                    // Store notification for delivery
                    await this.storeNotificationForDelivery(subscriber, notification);
                    result.sent++;
                }
                catch (error) {
                    result.failed++;
                    result.errors.push(`Failed to send to ${subscriber.userId}: ${error}`);
                    logger.error('Failed to send notification to subscriber', {
                        subscriberId: subscriber.userId,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
            // Store notification in KV for analytics
            await this.storeNotificationAnalytics(notification, result);
            logger.info('Notification delivery completed', {
                notificationId: notification.id,
                sent: result.sent,
                failed: result.failed
            });
        }
        catch (error) {
            result.success = false;
            result.errors.push(`System error: ${(error instanceof Error ? error.message : String(error))}`);
            logger.error('Failed to send notification', {
                notificationId: notification.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        return result;
    }
    /**
     * Get notification for 4 Moment types
     */
    async createPreMarketNotification(data) {
        return this.createNotification(NotificationType.PRE_MARKET, '📅 Pre-Market Briefing Ready', `High-confidence insights available for ${data.symbols.length} symbols. ${data.insights[0]}`, {
            symbols: data.symbols,
            confidence: data.confidence
        }, data.confidence);
    }
    async createIntradayNotification(data) {
        return this.createNotification(NotificationType.INTRADAY, '📊 Intraday Performance Update', `Tracking ${data.performingSymbols.length} symbols with ${Math.round(data.accuracy * 100)}% accuracy.`, {
            symbols: data.performingSymbols,
            confidence: data.accuracy
        });
    }
    async createEndOfDayNotification(data) {
        return this.createNotification(NotificationType.END_OF_DAY, '📈 End-of-Day Summary Available', `${data.summary}. ${data.tomorrowOutlook}`, {
            confidence: data.confidence
        }, data.confidence);
    }
    async createWeeklyReviewNotification(data) {
        return this.createNotification(NotificationType.WEEKLY_REVIEW, '📋 Weekly Review Ready', `Week ${data.weekNumber} analysis complete. Top performers: ${data.topPerformers.slice(0, 3).join(', ')}`, {
            symbols: data.topPerformers,
            confidence: data.accuracy
        });
    }
    /**
     * Register new subscriber
     */
    async registerSubscriber(subscription, userId) {
        try {
            const subscriptionId = userId || this.generateUserId();
            const enrichedSubscription = {
                ...subscription,
                userId: subscriptionId,
                createdAt: Date.now(),
                lastActive: Date.now()
            };
            // Store subscription
            const key = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
                component: `notification_subscription_${subscriptionId}`
            });
            await this.dal.write(key, enrichedSubscription);
            // Initialize user preferences
            await this.setUserPreferences(subscriptionId, this.preferences);
            logger.info('Subscriber registered successfully', {
                subscriptionId,
                endpoint: subscription.endpoint
            });
            return {
                success: true,
                subscriptionId
            };
        }
        catch (error) {
            logger.error('Failed to register subscriber', { error: (error instanceof Error ? error.message : String(error)) });
            return {
                success: false,
                subscriptionId: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Unregister subscriber
     */
    async unregisterSubscriber(subscriptionId) {
        try {
            const key = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
                component: `notification_subscription_${subscriptionId}`
            });
            await this.dal.deleteKey(key);
            // Remove user preferences
            const prefKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
                component: `notification_preferences_${subscriptionId}`
            });
            await this.dal.deleteKey(prefKey);
            logger.info('Subscriber unregistered successfully', { subscriptionId });
            return true;
        }
        catch (error) {
            logger.error('Failed to unregister subscriber', {
                subscriptionId,
                error: (error instanceof Error ? error.message : String(error))
            });
            return false;
        }
    }
    /**
     * Get notification history for user
     */
    async getNotificationHistory(userId, limit = 10) {
        try {
            const historyKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
                component: `notification_history_${userId}`
            });
            const result = await this.dal.read(historyKey);
            return result.data?.notifications?.slice(-limit) || [];
        }
        catch (error) {
            logger.error('Failed to get notification history', {
                userId,
                error: (error instanceof Error ? error.message : String(error))
            });
            return [];
        }
    }
    /**
     * Helper methods
     */
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getDefaultUrlForType(type) {
        const urlMap = {
            [NotificationType.PRE_MARKET]: '/pre-market-briefing',
            [NotificationType.INTRADAY]: '/intraday-check',
            [NotificationType.END_OF_DAY]: '/end-of-day-summary',
            [NotificationType.WEEKLY_REVIEW]: '/weekly-review'
        };
        return urlMap[type] || '/';
    }
    getIconForType(type) {
        const iconMap = {
            [NotificationType.PRE_MARKET]: '/icons/pre-market.png',
            [NotificationType.INTRADAY]: '/icons/intraday.png',
            [NotificationType.END_OF_DAY]: '/icons/end-of-day.png',
            [NotificationType.WEEKLY_REVIEW]: '/icons/weekly-review.png'
        };
        return iconMap[type] || '/favicon.ico';
    }
    getDefaultActionsForType(type) {
        const actionMap = {
            [NotificationType.PRE_MARKET]: [
                { action: 'view', title: '📅 View Briefing' },
                { action: 'dismiss', title: 'Dismiss' }
            ],
            [NotificationType.INTRADAY]: [
                { action: 'view', title: '📊 Check Performance' },
                { action: 'dismiss', title: 'Dismiss' }
            ],
            [NotificationType.END_OF_DAY]: [
                { action: 'view', title: '📈 View Summary' },
                { action: 'dismiss', title: 'Dismiss' }
            ],
            [NotificationType.WEEKLY_REVIEW]: [
                { action: 'view', title: '📋 Review Analysis' },
                { action: 'dismiss', title: 'Dismiss' }
            ]
        };
        return actionMap[type] || [];
    }
    async getActiveSubscribers() {
        try {
            // This would typically query a database or use KV list with prefix
            // For now, return empty array - implementation depends on your data store
            const subscribers = [];
            // TODO: Implement subscriber retrieval based on your data store
            // FUTURE ENHANCEMENT: Notification subscription management system
            // This would enable administrators to view and manage notification subscribers
            // Current implementation returns empty array as notification system works without listing
            // Implementation considerations:
            // - Add KV-based subscriber storage with subscription metadata
            // - Implement subscription management endpoints (create, read, update, delete)
            // - Add admin authentication for subscription management
            // - Add API endpoints: GET /api/v1/notifications/subscribers, POST /api/v1/notifications/subscribe
            // - Priority: Low (admin/monitoring feature, not core functionality)
            // - Dependencies: Enhanced DAL with subscription operations
            // - Estimated effort: 1-2 weeks development time
            // - GitHub Issue: #notification-subscription-management
            // Example implementation:
            // await this.dal.listKeys({ prefix: 'notification_subscription_' })
            // return subscriptions.map(key => this.dal.read(key))
            return subscribers;
        }
        catch (error) {
            logger.error('Failed to get active subscribers', { error: (error instanceof Error ? error.message : String(error)) });
            return [];
        }
    }
    async getUserPreferences(userId) {
        try {
            const prefKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
                component: `notification_preferences_${userId}`
            });
            const result = await this.dal.read(prefKey);
            return result.data || this.preferences;
        }
        catch (error) {
            logger.error('Failed to get user preferences', {
                userId,
                error: (error instanceof Error ? error.message : String(error))
            });
            return this.preferences;
        }
    }
    async setUserPreferences(userId, preferences) {
        const prefKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
            component: `notification_preferences_${userId}`
        });
        await this.dal.write(prefKey, preferences);
    }
    shouldSendNotification(notification, preferences) {
        if (!preferences.enabled)
            return false;
        // Check notification type preferences
        const typePrefs = {
            [NotificationType.PRE_MARKET]: preferences.preMarket,
            [NotificationType.INTRADAY]: preferences.intraday,
            [NotificationType.END_OF_DAY]: preferences.endOfDay,
            [NotificationType.WEEKLY_REVIEW]: preferences.weeklyReview
        };
        if (!typePrefs[notification.type])
            return false;
        // Check confidence threshold
        if (notification.data.confidence &&
            notification.data.confidence < preferences.minConfidence) {
            return false;
        }
        // Check quiet hours
        if (preferences.quietHours.enabled) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            if (this.isTimeInRange(currentTime, preferences.quietHours.start, preferences.quietHours.end)) {
                return false;
            }
        }
        return true;
    }
    isTimeInRange(current, start, end) {
        const currentMinutes = this.timeToMinutes(current);
        const startMinutes = this.timeToMinutes(start);
        const endMinutes = this.timeToMinutes(end);
        if (startMinutes <= endMinutes) {
            // Same day range
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        }
        else {
            // Overnight range
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
    }
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
    async storeNotificationForDelivery(subscriber, notification) {
        const deliveryKey = KVKeyFactory.generateKey(KeyTypes.SYSTEM_METADATA, {
            component: `notification_delivery_${subscriber.userId}_${notification.id}`
        });
        const deliveryData = {
            notification,
            subscription: subscriber,
            status: 'pending',
            createdAt: Date.now(),
            attempts: 0,
            maxAttempts: 3
        };
        await this.dal.write(deliveryKey, deliveryData);
    }
    async storeNotificationAnalytics(notification, result) {
        const analyticsKey = KVKeyFactory.generateKey(KeyTypes.PERFORMANCE_METADATA, {
            date: new Date().toISOString().split('T')[0]
        });
        try {
            const existingResult = await this.dal.read(analyticsKey);
            const existing = existingResult.data || {};
            const updated = {
                ...existing,
                notifications: {
                    ...(existing.notifications || {}),
                    [notification.type]: {
                        sent: (existing.notifications?.[notification.type]?.sent || 0) + result.sent,
                        failed: (existing.notifications?.[notification.type]?.failed || 0) + result.failed,
                        lastSent: Date.now()
                    }
                }
            };
            await this.dal.write(analyticsKey, updated);
        }
        catch (error) {
            logger.error('Failed to store notification analytics', { error: (error instanceof Error ? error.message : String(error)) });
        }
    }
}
export default WebNotificationManager;
//# sourceMappingURL=web-notifications.js.map