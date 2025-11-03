/**
 * Message Tracking Usage Example
 * Shows how to use the generic message tracking module from TypeScript
 */

import { createMessageTracker } from './msg-tracking.js';
import type { CloudflareEnvironment } from '../../types.js';

/**
 * Example: Sending a Facebook message with tracking
 */
export async function exampleFacebookMessageWithTracking(
  env: CloudflareEnvironment
): Promise<void> {
  const tracker = createMessageTracker(env);

  // Step 1: Create tracking record BEFORE sending
  const trackingResult = await tracker.createTracking(
    'facebook',                      // platform
    'morning_predictions',           // message type
    env.FACEBOOK_RECIPIENT_ID!,      // recipient
    {                                // metadata
      symbols_processed: 5,
      analysis_date: '2025-09-30',
      content_preview: 'Market analysis for today...'
    }
  );

  if (!trackingResult.success) {
    console.error('Failed to create tracking:', trackingResult.error);
    return;
  }

  const trackingId = trackingResult.tracking_id;
  console.log('Tracking created:', trackingId);

  try {
    // Step 2: Send the actual message (pure messaging)
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: { id: env.FACEBOOK_RECIPIENT_ID },
          message: { text: 'Your message here' }
        })
      }
    );

    if (response.ok) {
      const data = await response.json() as any;

      // Step 3: Update tracking status to 'sent'
      await tracker.updateStatus(
        trackingId,
        'sent',
        data.message_id  // Platform message ID
      );

      console.log('Message sent successfully');
    } else {
      const errorText = await response.text();

      // Step 4: Update tracking status to 'failed'
      await tracker.updateStatus(
        trackingId,
        'failed',
        undefined,
        errorText
      );

      console.error('Message failed:', errorText);
    }

  } catch (error: any) {
    // Step 5: Update tracking on exception
    await tracker.updateStatus(
      trackingId,
      'failed',
      undefined,
      (error instanceof Error ? error.message : String(error))
    );

    throw error;
  }
}

/**
 * Example: Sending Telegram message with tracking
 */
export async function exampleTelegramMessageWithTracking(
  env: CloudflareEnvironment
): Promise<void> {
  const tracker = createMessageTracker(env);

  const trackingResult = await tracker.createTracking(
    'telegram',
    'alert',
    env.TELEGRAM_CHAT_ID!,
    {
      alert_type: 'price_movement',
      symbol: 'AAPL'
    }
  );

  // ... send telegram message ...
  // ... update tracking status ...
}

/**
 * Example: Get message statistics
 */
export async function exampleGetMessageStats(
  env: CloudflareEnvironment
): Promise<void> {
  const tracker = createMessageTracker(env);

  // All platforms
  const allStats = await tracker.getStats();
  console.log('Total messages:', allStats.total);
  console.log('Success rate:', allStats.success_rate + '%');
  console.log('By status:', allStats.by_status);
  console.log('By platform:', allStats.by_platform);

  // Facebook only
  const facebookStats = await tracker.getStats('facebook');
  console.log('Facebook messages:', facebookStats.total);
}

/**
 * Example: List recent Facebook messages
 */
export async function exampleListFacebookMessages(
  env: CloudflareEnvironment
): Promise<void> {
  const tracker = createMessageTracker(env);

  const messages = await tracker.listByPlatform('facebook', 10);
  for (const msg of messages) {
    console.log(`[${msg.status}] ${msg.message_type} - ${msg.created_at}`);
  }
}

/**
 * Example: Cleanup old tracking records
 */
export async function exampleCleanupOldTracking(
  env: CloudflareEnvironment
): Promise<void> {
  const tracker = createMessageTracker(env);

  // Delete tracking records older than 90 days
  const deletedCount = await tracker.cleanup(90);
  console.log(`Cleaned up ${deletedCount} old tracking records`);
}

/**
 * BEFORE (facebook.js with embedded KV):
 * ```ts
 * const messagingKey = `facebook_status_${date}_${messageType}`;
 * await env.TRADING_RESULTS.put(messagingKey, JSON.stringify({...}));
 * // ... send message ...
 * const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
 * updatedKvData.status = 'sent';
 * await env.TRADING_RESULTS.put(messagingKey, JSON.stringify(updatedKvData));
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