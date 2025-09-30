# Message Tracking System - Platform-Agnostic

**Created**: 2025-09-30
**Status**: ✅ Production-Ready
**Location**: `src/modules/msg-tracking.ts`

## Overview

Generic, platform-agnostic message delivery tracking system compatible with multiple messengers (Facebook, Telegram, Slack, Discord, Email, SMS, etc.).

## Architecture

### Design Principles
- **Platform-Agnostic**: Works with any messaging platform
- **Type-Safe**: Full TypeScript type definitions
- **Audit Trail**: Complete message delivery history
- **Retry Support**: Track retry attempts and failures
- **Data Access Layer**: Uses TypeScript DAL (no direct KV access)
- **30-Day Retention**: Automatic tracking record expiration

## Key Features

### 1. Supported Platforms

```typescript
export type MessengerPlatform =
  | 'facebook'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'email'
  | 'sms'
  | 'webhook'
  | 'other';
```

### 2. Message Status Tracking

```typescript
export type MessageStatus =
  | 'pending'   // Created, not yet sent
  | 'sent'      // Successfully sent
  | 'delivered' // Confirmed delivery
  | 'failed'    // Send failed
  | 'retrying'; // Retry in progress
```

### 3. Message Types

```typescript
export type MessageType =
  | 'friday_weekend_report'    // Friday market close
  | 'weekly_accuracy_report'   // Sunday weekly review
  | 'morning_predictions'      // 8:30 AM pre-market
  | 'midday_update'            // 12:00 PM intraday
  | 'end_of_day_summary'       // 4:05 PM daily close
  | 'weekly_review'            // Weekly pattern analysis
  | 'alert'                    // Custom alerts
  | 'notification'             // General notifications
  | 'custom';                  // Custom message types
```

## Usage

### Basic Workflow

```javascript
import { createMessageTracker } from './msg-tracking.js';

const tracker = createMessageTracker(env);

// Step 1: Create tracking BEFORE sending
const trackingResult = await tracker.createTracking(
  'facebook',
  'morning_predictions',
  recipientId,
  {
    symbols_processed: 5,
    analysis_date: '2025-09-30',
    content_preview: 'Market analysis...'
  }
);

const trackingId = trackingResult.tracking_id;

// Step 2: Send message (pure messaging)
try {
  const response = await sendMessage(...);

  if (response.ok) {
    // Step 3: Update tracking to 'sent'
    await tracker.updateStatus(trackingId, 'sent', messageId);
  } else {
    // Step 4: Update tracking to 'failed'
    await tracker.updateStatus(trackingId, 'failed', undefined, errorText);
  }
} catch (error) {
  // Step 5: Update tracking on exception
  await tracker.updateStatus(trackingId, 'failed', undefined, error.message);
}
```

### Tracking Record Structure

```typescript
interface MessageTrackingRecord {
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
  message_id?: string;  // Platform-specific message ID

  // Content
  content_preview?: string;  // First 500 chars
  metadata?: MessageMetadata;

  // Error tracking
  error?: string;
  error_count?: number;
  last_error_at?: string;

  // Audit
  cron_execution_id?: string;
  trigger_mode?: string;
}
```

### Metadata Examples

```javascript
// Facebook morning predictions
{
  symbols_processed: 5,
  analysis_date: '2025-09-30',
  content_preview: 'PRE-MARKET BRIEFING...',
  dashboard_url: 'https://tft-trading-system.yanggf.workers.dev/pre-market-briefing',
  trigger_mode: 'morning_prediction_alerts',
  cron_execution_id: 'cron_abc123',
  bullish_count: 3,
  bearish_count: 2,
  high_confidence_count: 4
}

// Telegram alert
{
  alert_type: 'price_movement',
  symbol: 'AAPL',
  threshold_breached: '+5%',
  current_price: 175.50
}
```

## Advanced Features

### 1. Message Statistics

```javascript
// All platforms
const allStats = await tracker.getStats();
console.log('Total:', allStats.total);
console.log('Success rate:', allStats.success_rate + '%');
console.log('By status:', allStats.by_status);
console.log('By platform:', allStats.by_platform);

// Facebook only
const fbStats = await tracker.getStats('facebook');
console.log('Facebook messages:', fbStats.total);
```

### 2. List Messages by Platform

```javascript
const messages = await tracker.listByPlatform('facebook', 10);
for (const msg of messages) {
  console.log(`[${msg.status}] ${msg.message_type} - ${msg.created_at}`);
}
```

### 3. Cleanup Old Records

```javascript
// Delete tracking records older than 90 days
const deletedCount = await tracker.cleanup(90);
console.log(`Cleaned up ${deletedCount} old tracking records`);
```

## Integration with Facebook Messaging

All 5 Facebook messaging functions now use message tracking:

### Before (Direct KV Storage)
```javascript
// 36+ KV operations embedded in facebook.js
const messagingKey = `facebook_status_${date}_${messageType}`;
await env.TRADING_RESULTS.put(messagingKey, JSON.stringify({...}));
// ... send message ...
const updatedKvData = JSON.parse(await env.TRADING_RESULTS.get(messagingKey));
updatedKvData.status = 'sent';
await env.TRADING_RESULTS.put(messagingKey, JSON.stringify(updatedKvData));
```

### After (Message Tracking)
```javascript
// Pure messaging + tracking separation
const tracker = createMessageTracker(env);
const { tracking_id } = await tracker.createTracking('facebook', 'daily_report');
// ... send message ...
await tracker.updateStatus(tracking_id, 'sent', message_id);
```

## Benefits

### Separation of Concerns
- **Messaging Layer**: Pure message sending logic
- **Tracking Layer**: Independent delivery tracking
- **Data Layer**: TypeScript DAL for KV operations

### Platform Agnostic
- Same tracking interface for all platforms
- Easy to add new platforms (Telegram, Slack, etc.)
- Consistent error handling across platforms

### Type Safety
- TypeScript definitions for all operations
- Compile-time validation
- IDE autocomplete support

### Audit Trail
- Complete message delivery history
- Error tracking with retry counts
- Metadata for debugging and analytics

### Compliance
- 30-day retention policy
- Automatic cleanup of old records
- GDPR-friendly data management

## Refactored Facebook Functions

All 5 Facebook messaging functions now use message tracking:

1. ✅ `sendFridayWeekendReportWithTracking()` - Friday market close + Monday predictions
2. ✅ `sendWeeklyAccuracyReportWithTracking()` - Sunday weekly performance summary
3. ✅ `sendMorningPredictionsWithTracking()` - 8:30 AM pre-market briefing
4. ✅ `sendMiddayValidationWithTracking()` - 12:00 PM intraday performance check
5. ✅ `sendDailyValidationWithTracking()` - 4:05 PM end-of-day summary

**Total Refactoring**: Removed 36+ direct KV operations from facebook.js

## Example File

See `src/modules/msg-tracking-example.js` for comprehensive usage examples including:
- Facebook message tracking
- Telegram message tracking
- Statistics retrieval
- Platform-specific listing
- Cleanup operations

## Related Documentation

- [Data Access Layer](./DATA_ACCESS_LAYER.md) - TypeScript DAL for KV operations
- [KV Key Factory](./KV_KEY_FACTORY.md) - Key generation and management
- [Facebook Integration](./FACEBOOK_INTEGRATION.md) - Facebook messaging implementation