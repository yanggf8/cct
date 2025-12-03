/**
 * Web Notification HTTP Request Handlers
 * Handles Chrome web notification system for 4 Moment Report alerts
 * Replaces Facebook Messenger integration
 */
import { NotificationType, WebNotification, NotificationPreferences } from '../web-notifications.js';
import type { CloudflareEnvironment } from '../../types.js';
/**
 * Standard API Response interface
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
/**
 * Subscription Request interface
 */
export interface SubscriptionRequest {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
    userId?: string;
}
/**
 * Subscription Response interface
 */
export interface SubscriptionResponse {
    success: boolean;
    subscriptionId?: string;
    error?: string;
    message?: string;
}
/**
 * Test Notification Request interface
 */
export interface TestNotificationRequest {
    type?: 'pre_market' | 'intraday' | 'end_of_day' | 'weekly_review';
    subscriptionId?: string;
}
/**
 * Test Notification Response interface
 */
export interface TestNotificationResponse {
    success: boolean;
    message?: string;
    result?: {
        sent: number;
        failed: number;
        errors?: string[];
    };
    notification?: {
        id: string;
        type: NotificationType;
        title: string;
        body: string;
    };
    error?: string;
}
/**
 * Notification History Response interface
 */
export interface NotificationHistoryResponse {
    success: boolean;
    history?: WebNotification[];
    count?: number;
    error?: string;
}
/**
 * Notification Status Response interface
 */
export interface NotificationStatusResponse {
    success: boolean;
    status?: {
        supported: boolean;
        permission: string;
        statistics: {
            preMarket: {
                sent: number;
                failed: number;
            };
            intraday: {
                sent: number;
                failed: number;
            };
            endOfDay: {
                sent: number;
                failed: number;
            };
            weeklyReview: {
                sent: number;
                failed: number;
            };
        };
        total: {
            sent: number;
            failed: number;
        };
    };
    error?: string;
}
/**
 * Notification Preferences Update interface
 */
export interface NotificationPreferencesUpdate {
    enabled?: boolean;
    preMarket?: boolean;
    intraday?: boolean;
    endOfDay?: boolean;
    weeklyReview?: boolean;
    minConfidence?: number;
    quietHours?: {
        enabled?: boolean;
        start?: string;
        end?: string;
    };
    soundEnabled?: boolean;
    vibrationEnabled?: boolean;
}
/**
 * Notification Preferences Response interface
 */
export interface NotificationPreferencesResponse {
    success: boolean;
    message?: string;
    preferences?: NotificationPreferences;
    error?: string;
}
/**
 * Business Metrics interface
 */
export interface NotificationBusinessMetrics {
    subscriptionId?: string;
    endpoint?: string;
    type?: string;
    sent?: number;
    failed?: number;
    preferences?: NotificationPreferences;
}
/**
 * Enhanced Request interface for Cloudflare Workers
 */
export interface TypedRequest extends Request {
    url: string;
    json(): Promise<any>;
}
/**
 * Response Headers type
 */
export type ResponseHeaders = Record<string, string>;
/**
 * Handle notification subscription registration
 */
export declare function handleNotificationSubscription(request: TypedRequest, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle notification subscription unregistration
 */
export declare function handleNotificationUnsubscription(request: TypedRequest, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle notification preferences update
 */
export declare function handleNotificationPreferences(request: TypedRequest, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle notification history retrieval
 */
export declare function handleNotificationHistory(request: TypedRequest, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle test notification sending
 */
export declare function handleTestNotification(request: TypedRequest, env: CloudflareEnvironment): Promise<Response>;
/**
 * Handle notification status check
 */
export declare function handleNotificationStatus(request: TypedRequest, env: CloudflareEnvironment): Promise<Response>;
//# sourceMappingURL=web-notification-handlers.d.ts.map