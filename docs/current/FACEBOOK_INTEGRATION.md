# Facebook Messenger Integration

**Updated**: 2025-09-30
**Status**: ✅ Production-Ready with Message Tracking
**Location**: `src/modules/facebook.js`

## Overview

Facebook Messenger integration for the TFT Trading System with platform-agnostic message tracking.

## Architecture Evolution

### Previous Architecture (Before 2025-09-30)
- 36+ direct KV operations embedded in messaging functions
- Message delivery tracking mixed with KV storage logic
- Tight coupling between messaging and data persistence
- No separation of concerns

### Current Architecture (After 2025-09-30)
- **Pure Messaging Layer**: `facebook.js` handles only message sending
- **Message Tracking Layer**: `msg-tracking.ts` handles delivery tracking
- **Data Access Layer**: `dal.ts` handles all KV operations
- **Clean Separation**: Each layer has single responsibility

## Facebook Error #10 Resolution

**Issue**: Facebook API policy restriction - messages sent outside 24-hour window fail with Error #10
**Resolution Date**: 2025-09-29
**Solution**: Removed problematic `messaging_type` and `MESSAGE_TAG` fields from API calls

### Before
```javascript
{
  recipient: { id: recipientId },
  message: { text: messageText },
  messaging_type: 'UPDATE',  // ❌ Removed
  tag: 'ACCOUNT_UPDATE'       // ❌ Removed
}
```

### After
```javascript
{
  recipient: { id: recipientId },
  message: { text: messageText }  // ✅ Minimal payload
}
```

## Message Functions

### 1. Friday Weekend Report
**Function**: `sendFridayWeekendReportWithTracking()`
**Schedule**: Friday 4:05 PM EST
**Purpose**: Weekly market close analysis + Monday predictions

```javascript
await sendFridayWeekendReportWithTracking(analysisResult, env, cronExecutionId, triggerMode);
```

**Tracking Type**: `friday_weekend_report`
**Dashboard**: `/weekly-review`

### 2. Weekly Accuracy Report
**Function**: `sendWeeklyAccuracyReportWithTracking()`
**Schedule**: Sunday 10:00 AM EST
**Purpose**: Weekly performance summary with accuracy metrics

```javascript
await sendWeeklyAccuracyReportWithTracking(env, cronExecutionId);
```

**Tracking Type**: `weekly_accuracy_report`
**Dashboard**: `/weekly-review`

### 3. Morning Predictions
**Function**: `sendMorningPredictionsWithTracking()`
**Schedule**: Weekdays 8:30 AM EST
**Purpose**: Pre-market briefing with high-confidence signals

```javascript
await sendMorningPredictionsWithTracking(analysisResult, env, cronExecutionId);
```

**Tracking Type**: `morning_predictions`
**Dashboard**: `/pre-market-briefing`

### 4. Midday Validation
**Function**: `sendMiddayValidationWithTracking()`
**Schedule**: Weekdays 12:00 PM EST
**Purpose**: Intraday performance tracking

```javascript
await sendMiddayValidationWithTracking(analysisResult, env, cronExecutionId);
```

**Tracking Type**: `midday_update`
**Dashboard**: `/intraday-check`

### 5. Daily Validation
**Function**: `sendDailyValidationWithTracking()`
**Schedule**: Weekdays 4:05 PM EST
**Purpose**: End-of-day summary + tomorrow's outlook

```javascript
await sendDailyValidationWithTracking(analysisResult, env, cronExecutionId);
```

**Tracking Type**: `end_of_day_summary`
**Dashboard**: `/end-of-day-summary`

## Message Tracking Integration

### Standard Pattern

All 5 functions follow the same pattern:

```javascript
// Step 1: Create tracking
const tracker = createMessageTracker(env);
let trackingId = null;

try {
  const trackingResult = await tracker.createTracking(
    'facebook',
    'morning_predictions',
    env.FACEBOOK_RECIPIENT_ID,
    {
      symbols_processed: symbolCount,
      analysis_date: '2025-09-30',
      content_preview: reportText.substring(0, 500),
      dashboard_url: 'https://...',
      cron_execution_id: cronExecutionId
    }
  );

  if (trackingResult.success) {
    trackingId = trackingResult.tracking_id;
  }
} catch (trackingError) {
  console.error('Tracking error:', trackingError.message);
  // Continue to Facebook send even if tracking fails
}

// Step 2: Send Facebook message
try {
  const fbResult = await sendFacebookMessage(reportText, env);

  if (fbResult.success) {
    // Step 3: Update tracking with success
    if (trackingId) {
      await tracker.updateStatus(trackingId, 'sent', fbResult.message_id);
    }
  } else {
    // Step 4: Update tracking with failure
    if (trackingId) {
      await tracker.updateStatus(trackingId, 'failed', undefined, fbResult.error);
    }
  }
} catch (fbError) {
  // Step 5: Update tracking with exception
  if (trackingId) {
    await tracker.updateStatus(trackingId, 'failed', undefined, fbError.message);
  }
}

// Step 6: Return status
return {
  success: facebookSuccess,
  tracking_id: trackingId,
  facebook_success: facebookSuccess,
  facebook_error: facebookError,
  timestamp: now.toISOString()
};
```

## Pure Messaging Utility

### `sendFacebookMessage()`
**Purpose**: Generic Facebook message sender
**Location**: `facebook.js:338`

```javascript
export async function sendFacebookMessage(messageText, env) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: env.FACEBOOK_RECIPIENT_ID },
          message: { text: messageText }
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message_id: data.message_id,
        recipient_id: data.recipient_id
      };
    }

    const errorText = await response.text();
    return {
      success: false,
      error: errorText
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

**Benefits**:
- ✅ Pure messaging logic (no side effects)
- ✅ No direct KV access
- ✅ Simple error handling
- ✅ Reusable across all message types

## Dual AI Message Formatting

### Dual AI Report Format
```javascript
function formatDualAIReport(symbol, signal) {
  const gptSentiment = signal.models?.gpt?.sentiment || 'neutral';
  const distilBertSentiment = signal.models?.distilbert?.sentiment || 'neutral';
  const agreement = signal.comparison?.agree || 'DISAGREE';

  let report = `\n${symbol} - ${agreement === 'AGREE' ? '✅' : '⚠️'} ${agreement}\n`;
  report += `  GPT: ${gptSentiment.toUpperCase()}\n`;
  report += `  DistilBERT: ${distilBertSentiment.toUpperCase()}\n`;

  if (agreement === 'AGREE') {
    report += `  → Recommendation: Strong ${gptSentiment} signal\n`;
  } else if (agreement === 'PARTIAL_AGREE') {
    report += `  → Recommendation: Moderate confidence\n`;
  } else {
    report += `  → Recommendation: Avoid or wait for clarity\n`;
  }

  return report;
}
```

### Legacy Report Format
```javascript
function formatLegacyReport(symbol, signal) {
  const sentimentLayer = signal.sentiment_layers?.[0];
  const sentiment = sentimentLayer?.sentiment || 'neutral';
  const confidence = sentimentLayer?.confidence || 0;

  let report = `\n${symbol} - ${sentiment.toUpperCase()} (${Math.round(confidence * 100)}%)\n`;
  return report;
}
```

## Configuration

### Environment Variables Required
```bash
FACEBOOK_PAGE_TOKEN=<your_facebook_page_access_token>
FACEBOOK_RECIPIENT_ID=<recipient_psid>
```

### Configuration Check
All functions verify configuration before sending:

```javascript
if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
  console.log('Facebook not configured - skipping message');
  return;
}
```

## Refactoring Summary

### Changes Made (2025-09-30)
1. ✅ Removed 36+ direct KV operations from `facebook.js`
2. ✅ Integrated `createMessageTracker()` in all 5 functions
3. ✅ Replaced KV storage with `tracker.createTracking()`
4. ✅ Replaced KV updates with `tracker.updateStatus()`
5. ✅ Updated return statements to use `tracking_id`
6. ✅ Maintained all original functionality

### Code Reduction
- **Before**: 1200+ lines with embedded KV logic
- **After**: 964 lines of pure messaging
- **Reduction**: ~20% code reduction through separation of concerns

### Maintainability Improvements
- ✅ Single responsibility per function
- ✅ Platform-agnostic tracking
- ✅ Type-safe data access
- ✅ Comprehensive error handling
- ✅ Easy to test and debug

## Related Documentation

- [Message Tracking](./MESSAGE_TRACKING.md) - Platform-agnostic message tracking
- [Data Access Layer](./DATA_ACCESS_LAYER.md) - TypeScript DAL for KV operations
- [CLAUDE.md](../../CLAUDE.md) - Complete 4-report system documentation