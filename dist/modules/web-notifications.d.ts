/**
 * Web Notifications Module - TypeScript
 * Chrome web notification system for 4 Moment Report alerts
 * Replaces Facebook Messenger integration with browser-based notifications
 */
import type { CloudflareEnvironment } from '../types.js';
export declare enum NotificationType {
    PRE_MARKET = "pre_market",
    INTRADAY = "intraday",
    END_OF_DAY = "end_of_day",
    WEEKLY_REVIEW = "weekly_review"
}
export interface WebNotification {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag: string;
    data: {
        url: string;
        timestamp: number;
        confidence?: number;
        symbols?: string[];
    };
    actions?: NotificationAction[];
    requireInteraction: boolean;
    timestamp: number;
}
export interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
}
export interface NotificationSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    userId?: string;
    createdAt: number;
    lastActive: number;
}
export interface NotificationPreferences {
    enabled: boolean;
    preMarket: boolean;
    intraday: boolean;
    endOfDay: boolean;
    weeklyReview: boolean;
    minConfidence: number;
    quietHours: {
        enabled: boolean;
        start: string;
        end: string;
    };
    soundEnabled: boolean;
    vibrationEnabled: boolean;
}
/**
 * Web Notification Manager
 */
export declare class WebNotificationManager {
    private dal;
    private preferences;
    constructor(env: CloudflareEnvironment);
    /**
     * Get default notification preferences
     */
    private getDefaultPreferences;
    /**
     * Create notification for 4 Moment System
     */
    createNotification(type: NotificationType, title: string, body: string, data?: Partial<WebNotification['data']>, confidence?: number): Promise<WebNotification>;
    /**
     * Send notification to subscribers
     */
    sendNotification(notification: WebNotification): Promise<{
        success: boolean;
        sent: number;
        failed: number;
        errors: string[];
    }>;
    /**
     * Get notification for 4 Moment types
     */
    createPreMarketNotification(data: {
        symbols: string[];
        insights: string[];
        confidence: number;
    }): Promise<WebNotification>;
    createIntradayNotification(data: {
        performingSymbols: string[];
        accuracy: number;
    }): Promise<WebNotification>;
    createEndOfDayNotification(data: {
        summary: string;
        tomorrowOutlook: string;
        confidence: number;
    }): Promise<WebNotification>;
    createWeeklyReviewNotification(data: {
        weekNumber: number;
        topPerformers: string[];
        accuracy: number;
    }): Promise<WebNotification>;
    /**
     * Register new subscriber
     */
    registerSubscriber(subscription: NotificationSubscription, userId?: string): Promise<{
        success: boolean;
        subscriptionId: string;
        error?: string;
    }>;
    /**
     * Unregister subscriber
     */
    unregisterSubscriber(subscriptionId: string): Promise<boolean>;
    /**
     * Get notification history for user
     */
    getNotificationHistory(userId: string, limit?: number): Promise<WebNotification[]>;
    /**
     * Helper methods
     */
    private generateNotificationId;
    private generateUserId;
    private getDefaultUrlForType;
    private getIconForType;
    private getDefaultActionsForType;
    private getActiveSubscribers;
    private getUserPreferences;
    private setUserPreferences;
    private shouldSendNotification;
    private isTimeInRange;
    private timeToMinutes;
    private storeNotificationForDelivery;
    private storeNotificationAnalytics;
}
export default WebNotificationManager;
//# sourceMappingURL=web-notifications.d.ts.map