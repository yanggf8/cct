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

import { createDAL } from './dal.js';
import { KVKeyFactory, KeyTypes } from './kv-key-factory.js';
import { createLogger } from './logging.js';
import type { CloudflareEnvironment } from '../types.js';

const logger = createLogger('msg-tracking');

/**
 * Type Definitions
 */

export type MessengerPlatform =
  | 'facebook'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'email'
  | 'sms'
  | 'webhook'
  | 'other';

export type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'retrying';

export type MessageType =
  | 'friday_weekend_report'
  | 'weekly_accuracy_report'
  | 'morning_predictions'
  | 'midday_update'
  | 'end_of_day_summary'
  | 'weekly_review'
  | 'alert'
  | 'notification'
  | 'custom';

export interface MessageMetadata {
  symbols_processed?: number;
  analysis_date?: string;
  report_type?: string;
  content_preview?: string;
  recipient_count?: number;
  [key: string]: any; // Allow custom metadata
}

export interface MessageTrackingRecord {
  // Identity
  tracking_id: string;
  platform: MessengerPlatform;
  message_type: MessageType;

  // Status
  status: MessageStatus;
  created_at: string;
  updated_at: string;

  // Delivery details
  recipient_id?: string;
  message_id?: string; // Platform-specific message ID

  // Content
  content_preview?: string; // First 500 chars
  metadata?: MessageMetadata;

  // Error tracking
  error?: string;
  error_count?: number;
  last_error_at?: string;

  // Audit
  cron_execution_id?: string;
  trigger_mode?: string;

  // Optimistic locking for race condition prevention
  version?: number;
}

export interface MessageTrackingOptions {
  ttl?: number; // Custom TTL in seconds (default: 30 days)
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
export class MessageTracker {
  private dal: any;
  private defaultTTL: number = 2592000; // 30 days

  constructor(env: CloudflareEnvironment) {
    this.dal = createDAL(env);
  }

  /**
   * Generate tracking ID
   */
  private generateTrackingId(
    platform: MessengerPlatform,
    messageType: MessageType,
    timestamp: number
  ): string {
    return `${platform}_${messageType}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new message tracking record
   */
  async createTracking(
    platform: MessengerPlatform,
    messageType: MessageType,
    recipientId?: string,
    metadata?: MessageMetadata,
    options?: MessageTrackingOptions
  ): Promise<TrackingResult> {
    const timestamp = Date.now();
    const trackingId = this.generateTrackingId(platform, messageType, timestamp);

    const record: MessageTrackingRecord = {
      tracking_id: trackingId,
      platform,
      message_type: messageType,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      recipient_id: recipientId,
      metadata,
      error_count: 0,
    };

    try {
      logger.info('Creating message tracking record', {
        tracking_id: trackingId,
        platform,
        message_type: messageType,
      });

      const key = `msg_tracking_${trackingId}`;
      const ttl = options?.ttl ?? this.defaultTTL;

      const writeResult = await this.dal.write(key, record, { expirationTtl: ttl });

      if (writeResult.success) {
        logger.info('Message tracking created', { tracking_id: trackingId });
        return {
          success: true,
          tracking_id: trackingId,
        };
      }

      return {
        success: false,
        tracking_id: trackingId,
        error: writeResult.error,
      };

    } catch (error: any) {
      logger.error('Failed to create message tracking', {
        tracking_id: trackingId,
        error: (error instanceof Error ? error.message : String(error)),
      });

      return {
        success: false,
        tracking_id: trackingId,
        error: error.message,
      };
    }
  }

  /**
   * Update message status with optimistic locking
   */
  async updateStatus(
    trackingId: string,
    status: MessageStatus,
    messageId?: string,
    error?: string
  ): Promise<boolean> {
    const maxRetries = 3;
    const key = `msg_tracking_${trackingId}`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.info('Updating message status', { tracking_id: trackingId, status, attempt });

        const readResult: any = await this.dal.read(key);

        if (!readResult.success || !readResult.data) {
          logger.warn('Tracking record not found', { tracking_id: trackingId });
          return false;
        }

        const record = readResult.data;
        const currentVersion = record.version || 0;

        // Apply updates
        record.status = status;
        record.updated_at = new Date().toISOString();
        record.version = currentVersion + 1;

        if (messageId) {
          record.message_id = messageId;
        }

        if (error) {
          record.error = error;
          record.error_count = (record.error_count ?? 0) + 1;
          record.last_error_at = new Date().toISOString();
        }

        // Verify version hasn't changed before writing
        const verifyResult: any = await this.dal.read(key);
        if (verifyResult.success && verifyResult.data &&
            (verifyResult.data.version || 0) !== currentVersion) {
          logger.warn('Version conflict, retrying update', {
            tracking_id: trackingId,
            expected_version: currentVersion,
            actual_version: verifyResult.data.version || 0
          });
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
          continue;
        }

        const writeResult = await this.dal.write(key, record, { expirationTtl: this.defaultTTL });

        if (writeResult.success) {
          logger.info('Message status updated', { tracking_id: trackingId, status, version: record.version });
          return true;
        }

        logger.error('Failed to update status', { tracking_id: trackingId });
        return false;

      } catch (error: any) {
        if (attempt === maxRetries - 1) {
          logger.error('Update failed after retries', { tracking_id: trackingId, error: (error instanceof Error ? error.message : String(error)) });
          return false;
        }
        logger.warn('Retrying update due to error', { tracking_id: trackingId, attempt, error: error.message });
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }

    return false;
  }

  /**
   * Get tracking record
   */
  async getTracking(trackingId: string): Promise<MessageTrackingRecord | null> {
    try {
      const key = `msg_tracking_${trackingId}`;
      const result: any = await this.dal.read(key);

      if (result.success && result.data) {
        return result.data;
      }

      return null;

    } catch (error: any) {
      logger.error('Error getting tracking record', {
        tracking_id: trackingId,
        error: (error instanceof Error ? error.message : String(error)),
      });
      return null;
    }
  }

  /**
   * List messages by platform
   */
  async listByPlatform(
    platform: MessengerPlatform,
    limit?: number
  ): Promise<MessageTrackingRecord[]> {
    try {
      const prefix = `msg_tracking_${platform}_`;
      const keys = await this.dal.listKeys(prefix, limit);

      const records: MessageTrackingRecord[] = [];

      for (const key of keys.keys) {
        const result: any = await this.dal.read(key);
        if (result.success && result.data) {
          records.push(result.data as MessageTrackingRecord);
        }
      }

      return records;

    } catch (error: any) {
      logger.error('Error listing messages by platform', {
        platform,
        error: (error instanceof Error ? error.message : String(error)),
      });
      return [];
    }
  }

  /**
   * Get message statistics
   */
  async getStats(platform?: MessengerPlatform): Promise<MessageStats> {
    try {
      const prefix = platform ? `msg_tracking_${platform}_` : 'msg_tracking_';
      const keys = await this.dal.listKeys(prefix, 1000);

      const stats: MessageStats = {
        total: 0,
        by_status: {
          pending: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          retrying: 0,
        },
        by_platform: {
          facebook: 0,
          telegram: 0,
          slack: 0,
          discord: 0,
          email: 0,
          sms: 0,
          webhook: 0,
          other: 0,
        },
        by_type: {
          friday_weekend_report: 0,
          weekly_accuracy_report: 0,
          morning_predictions: 0,
          midday_update: 0,
          end_of_day_summary: 0,
          weekly_review: 0,
          alert: 0,
          notification: 0,
          custom: 0,
        },
        success_rate: 0,
      };

      let successCount = 0;

      for (const key of keys.keys) {
        const result: any = await this.dal.read(key);
        if (result.success && result.data) {
          const record = result.data as MessageTrackingRecord;
          stats.total++;
          if (record.status in stats.by_status) {
            stats.by_status[record.status]++;
          }
          if (record.platform in stats.by_platform) {
            stats.by_platform[record.platform]++;
          }
          if (record.message_type in stats.by_type) {
            stats.by_type[record.message_type]++;
          }

          if (record.status === 'sent' || record.status === 'delivered') {
            successCount++;
          }
        }
      }

      stats.success_rate = stats.total > 0 ? (successCount / stats.total) * 100 : 0;

      return stats;

    } catch (error: any) {
      logger.error('Error getting message stats', { error: (error instanceof Error ? error.message : String(error)) });
      return {
        total: 0,
        by_status: { pending: 0, sent: 0, delivered: 0, failed: 0, retrying: 0 },
        by_platform: { facebook: 0, telegram: 0, slack: 0, discord: 0, email: 0, sms: 0, webhook: 0, other: 0 },
        by_type: { friday_weekend_report: 0, weekly_accuracy_report: 0, morning_predictions: 0, midday_update: 0, end_of_day_summary: 0, weekly_review: 0, alert: 0, notification: 0, custom: 0 },
        success_rate: 0,
      };
    }
  }

  /**
   * Clean up old tracking records
   */
  async cleanup(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffTimestamp = cutoffDate.toISOString();

      logger.info('Starting message tracking cleanup', {
        older_than_days: olderThanDays,
        cutoff_date: cutoffTimestamp,
      });

      const keys = await this.dal.listKeys('msg_tracking_', 1000);
      let deletedCount = 0;

      for (const key of keys.keys) {
        const result: any = await this.dal.read(key);
        if (result.success && result.data) {
          const record = result.data as MessageTrackingRecord;
          if (record.created_at < cutoffTimestamp) {
            const deleted = await this.dal.deleteKey(key);
            if (deleted) {
              deletedCount++;
            }
          }
        }
      }

      logger.info('Message tracking cleanup complete', { deleted_count: deletedCount });
      return deletedCount;

    } catch (error: any) {
      logger.error('Error during cleanup', { error: (error instanceof Error ? error.message : String(error)) });
      return 0;
    }
  }
}

/**
 * Factory function
 */
export function createMessageTracker(env: CloudflareEnvironment): MessageTracker {
  return new MessageTracker(env);
}

/**
 * Export types for JavaScript usage
 */
export type {
  MessageTrackingRecord as TrackingRecord,
  MessageMetadata as Metadata,
};