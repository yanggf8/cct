/**
 * Message Tracking Module - TypeScript
 * Generic message delivery tracking compatible with multiple messengers
 * (Facebook, Telegram, Slack, Discord, Email, SMS, etc.)
 *
 * Design Principles:
 * - Platform-agnostic tracking
 * - Type-safe message status management
 * - Audit trail for all message deliveries
 * - Support for retry and failure tracking
 */
import type { CloudflareEnvironment } from '../types.js';
/**
 * Type Definitions
 */
export type MessengerPlatform = 'facebook' | 'telegram' | 'slack' | 'discord' | 'email' | 'sms' | 'webhook' | 'other';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'retrying';
export type MessageType = 'friday_weekend_report' | 'weekly_accuracy_report' | 'morning_predictions' | 'midday_update' | 'end_of_day_summary' | 'weekly_review' | 'alert' | 'notification' | 'custom';
export interface MessageMetadata {
    symbols_processed?: number;
    analysis_date?: string;
    report_type?: string;
    content_preview?: string;
    recipient_count?: number;
    [key: string]: any;
}
export interface MessageTrackingRecord {
    tracking_id: string;
    platform: MessengerPlatform;
    message_type: MessageType;
    status: MessageStatus;
    created_at: string;
    updated_at: string;
    recipient_id?: string;
    message_id?: string;
    content_preview?: string;
    metadata?: MessageMetadata;
    error?: string;
    error_count?: number;
    last_error_at?: string;
    cron_execution_id?: string;
    trigger_mode?: string;
    version?: number;
}
export interface MessageTrackingOptions {
    ttl?: number;
    retry_count?: number;
    retry_delay?: number;
}
export interface TrackingResult {
    success: boolean;
    tracking_id: string;
    error?: string;
}
export interface MessageStats {
    total: number;
    by_status: Record<MessageStatus, number>;
    by_platform: Record<MessengerPlatform, number>;
    by_type: Record<MessageType, number>;
    success_rate: number;
}
/**
 * Message Tracking Class
 */
export declare class MessageTracker {
    private dal;
    private defaultTTL;
    constructor(env: CloudflareEnvironment);
    /**
     * Generate tracking ID
     */
    private generateTrackingId;
    /**
     * Create a new message tracking record
     */
    createTracking(platform: MessengerPlatform, messageType: MessageType, recipientId?: string, metadata?: MessageMetadata, options?: MessageTrackingOptions): Promise<TrackingResult>;
    /**
     * Update message status with optimistic locking
     */
    updateStatus(trackingId: string, status: MessageStatus, messageId?: string, error?: string): Promise<boolean>;
    /**
     * Get tracking record
     */
    getTracking(trackingId: string): Promise<MessageTrackingRecord | null>;
    /**
     * List messages by platform
     */
    listByPlatform(platform: MessengerPlatform, limit?: number): Promise<MessageTrackingRecord[]>;
    /**
     * Get message statistics
     */
    getStats(platform?: MessengerPlatform): Promise<MessageStats>;
    /**
     * Clean up old tracking records
     */
    cleanup(olderThanDays?: number): Promise<number>;
}
/**
 * Factory function
 */
export declare function createMessageTracker(env: CloudflareEnvironment): MessageTracker;
/**
 * Export types for JavaScript usage
 */
export type { MessageTrackingRecord as TrackingRecord, MessageMetadata as Metadata, };
//# sourceMappingURL=msg-tracking.d.ts.map