/**
 * Message Tracking Usage Example
 * Shows how to use the generic message tracking module from TypeScript
 */
import type { CloudflareEnvironment } from '../types';
/**
 * Example: Sending a Facebook message with tracking
 */
export declare function exampleFacebookMessageWithTracking(env: CloudflareEnvironment): Promise<void>;
/**
 * Example: Sending Telegram message with tracking
 */
export declare function exampleTelegramMessageWithTracking(env: CloudflareEnvironment): Promise<void>;
/**
 * Example: Get message statistics
 */
export declare function exampleGetMessageStats(env: CloudflareEnvironment): Promise<void>;
/**
 * Example: List recent Facebook messages
 */
export declare function exampleListFacebookMessages(env: CloudflareEnvironment): Promise<void>;
/**
 * Example: Cleanup old tracking records
 */
export declare function exampleCleanupOldTracking(env: CloudflareEnvironment): Promise<void>;
/**
 * BEFORE (facebook.js with embedded KV):
 * ```ts
 * const messagingKey = `facebook_status_${date}_${messageType}`;
 * await env.MARKET_ANALYSIS_CACHE.put(messagingKey, JSON.stringify({...}));
 * // ... send message ...
 * const updatedKvData = JSON.parse(await env.MARKET_ANALYSIS_CACHE.get(messagingKey));
 * updatedKvData.status = 'sent';
 * await env.MARKET_ANALYSIS_CACHE.put(messagingKey, JSON.stringify(updatedKvData));
 * ```
 *
 * AFTER (pure messaging + tracking):
 * ```ts
 * const tracker = createMessageTracker(env);
 * const { tracking_id } = await tracker.createTracking('facebook', 'daily_report');
 * // ... send message ...
 * await tracker.updateStatus(tracking_id, 'sent', message_id);
 * ```
 *
 * Benefits:
 * - Separation of concerns (messaging vs tracking)
 * - Platform-agnostic design
 * - Type-safe interfaces
 * - Consistent error handling
 * - Audit trail for compliance
 * - Easy to extend to other platforms (Telegram, Slack, etc.)
 */ 
//# sourceMappingURL=msg-tracking-example.d.ts.map