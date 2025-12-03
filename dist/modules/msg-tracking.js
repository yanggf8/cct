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
import { createLogger } from './logging.js';
const logger = createLogger('msg-tracking');
/**
 * Message Tracking Class
 */
export class MessageTracker {
    constructor(env) {
        this.defaultTTL = 2592000; // 30 days
        this.dal = createDAL(env);
    }
    /**
     * Generate tracking ID
     */
    generateTrackingId(platform, messageType, timestamp) {
        return `${platform}_${messageType}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Create a new message tracking record
     */
    async createTracking(platform, messageType, recipientId, metadata, options) {
        const timestamp = Date.now();
        const trackingId = this.generateTrackingId(platform, messageType, timestamp);
        const record = {
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
        }
        catch (error) {
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
    async updateStatus(trackingId, status, messageId, error) {
        const maxRetries = 3;
        const key = `msg_tracking_${trackingId}`;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                logger.info('Updating message status', { tracking_id: trackingId, status, attempt });
                const readResult = await this.dal.read(key);
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
                const verifyResult = await this.dal.read(key);
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
            }
            catch (error) {
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
    async getTracking(trackingId) {
        try {
            const key = `msg_tracking_${trackingId}`;
            const result = await this.dal.read(key);
            if (result.success && result.data) {
                return result.data;
            }
            return null;
        }
        catch (error) {
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
    async listByPlatform(platform, limit) {
        try {
            const prefix = `msg_tracking_${platform}_`;
            const keys = await this.dal.listKeys(prefix, limit);
            const records = [];
            for (const key of keys.keys) {
                const result = await this.dal.read(key);
                if (result.success && result.data) {
                    records.push(result.data);
                }
            }
            return records;
        }
        catch (error) {
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
    async getStats(platform) {
        try {
            const prefix = platform ? `msg_tracking_${platform}_` : 'msg_tracking_';
            const keys = await this.dal.listKeys(prefix, 1000);
            const stats = {
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
                const result = await this.dal.read(key);
                if (result.success && result.data) {
                    const record = result.data;
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
        }
        catch (error) {
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
    async cleanup(olderThanDays = 30) {
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
                const result = await this.dal.read(key);
                if (result.success && result.data) {
                    const record = result.data;
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
        }
        catch (error) {
            logger.error('Error during cleanup', { error: (error instanceof Error ? error.message : String(error)) });
            return 0;
        }
    }
}
/**
 * Factory function
 */
export function createMessageTracker(env) {
    return new MessageTracker(env);
}
//# sourceMappingURL=msg-tracking.js.map