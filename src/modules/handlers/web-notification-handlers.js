/**
 * Web Notification HTTP Request Handlers
 * Handles Chrome web notification system for 4 Moment Report alerts
 * Replaces Facebook Messenger integration
 */

import { WebNotificationManager, NotificationType } from '../web-notifications.js';
import { createLogger, logBusinessMetric } from '../logging.js';
import { KVKeyFactory, KeyTypes } from '../kv-key-factory.js';
import { createDAL } from '../dal.js';

const logger = createLogger('web-notification-handlers');

/**
 * Handle notification subscription registration
 */
export async function handleNotificationSubscription(request, env) {
  const requestId = crypto.randomUUID();
  logger.info('Notification subscription request received', { requestId });

  try {
    const subscription = await request.json();

    // Validate subscription data
    if (!subscription.endpoint || !subscription.keys) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid subscription data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const notificationManager = new WebNotificationManager(env);
    const result = await notificationManager.registerSubscriber(subscription);

    if (result.success) {
      // Log business metric
      logBusinessMetric('notification_subscription_registered', {
        subscriptionId: result.subscriptionId,
        endpoint: subscription.endpoint
      });

      return new Response(JSON.stringify({
        success: true,
        subscriptionId: result.subscriptionId,
        message: 'Successfully subscribed to notifications'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    logger.error('Notification subscription error', {
      error: error.message,
      requestId
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process subscription'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle notification subscription unregistration
 */
export async function handleNotificationUnsubscription(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('id');

  if (!subscriptionId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Subscription ID required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  logger.info('Notification unsubscription request', { requestId, subscriptionId });

  try {
    const notificationManager = new WebNotificationManager(env);
    const success = await notificationManager.unregisterSubscriber(subscriptionId);

    if (success) {
      logBusinessMetric('notification_subscription_unregistered', {
        subscriptionId
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Successfully unsubscribed from notifications'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to unsubscribe'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    logger.error('Notification unsubscription error', {
      error: error.message,
      requestId,
      subscriptionId
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process unsubscription'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle notification preferences update
 */
export async function handleNotificationPreferences(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('id');

  if (!subscriptionId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Subscription ID required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  logger.info('Notification preferences update', { requestId, subscriptionId });

  try {
    const preferences = await request.json();

    // Validate preferences
    const validPreferences = {
      enabled: Boolean(preferences.enabled),
      preMarket: Boolean(preferences.preMarket),
      intraday: Boolean(preferences.intraday),
      endOfDay: Boolean(preferences.endOfDay),
      weeklyReview: Boolean(preferences.weeklyReview),
      minConfidence: Math.max(0, Math.min(1, Number(preferences.minConfidence) || 0.7)),
      quietHours: {
        enabled: Boolean(preferences.quietHours?.enabled),
        start: preferences.quietHours?.start || '22:00',
        end: preferences.quietHours?.end || '07:00'
      },
      soundEnabled: Boolean(preferences.soundEnabled),
      vibrationEnabled: Boolean(preferences.vibrationEnabled)
    };

    const notificationManager = new WebNotificationManager(env);
    await notificationManager.setUserPreferences(subscriptionId, validPreferences);

    logBusinessMetric('notification_preferences_updated', {
      subscriptionId,
      preferences: validPreferences
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Preferences updated successfully',
      preferences: validPreferences
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Notification preferences update error', {
      error: error.message,
      requestId,
      subscriptionId
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update preferences'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle notification history retrieval
 */
export async function handleNotificationHistory(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get('id');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!subscriptionId) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Subscription ID required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  logger.info('Notification history request', { requestId, subscriptionId, limit });

  try {
    const notificationManager = new WebNotificationManager(env);
    const history = await notificationManager.getNotificationHistory(subscriptionId, limit);

    return new Response(JSON.stringify({
      success: true,
      history,
      count: history.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Notification history error', {
      error: error.message,
      requestId,
      subscriptionId
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve notification history'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle test notification sending
 */
export async function handleTestNotification(request, env) {
  const requestId = crypto.randomUUID();
  logger.info('Test notification request', { requestId });

  try {
    const { type = 'pre_market', subscriptionId } = await request.json();

    const notificationManager = new WebNotificationManager(env);

    let notification;
    switch (type) {
      case 'pre_market':
        notification = await notificationManager.createPreMarketNotification({
          symbols: ['AAPL', 'MSFT'],
          insights: ['Strong bullish sentiment detected'],
          confidence: 0.85
        });
        break;
      case 'intraday':
        notification = await notificationManager.createIntradayNotification({
          performingSymbols: ['GOOGL', 'TSLA'],
          accuracy: 0.78
        });
        break;
      case 'end_of_day':
        notification = await notificationManager.createEndOfDayNotification({
          summary: 'Markets closed with mixed results',
          tomorrowOutlook: 'Positive outlook expected',
          confidence: 0.82
        });
        break;
      case 'weekly_review':
        notification = await notificationManager.createWeeklyReviewNotification({
          weekNumber: 42,
          topPerformers: ['NVDA', 'AMD'],
          accuracy: 0.80
        });
        break;
      default:
        throw new Error('Invalid notification type');
    }

    // Update notification title for test
    notification.title = `🧪 Test: ${notification.title}`;
    notification.body = `This is a test notification. ${notification.body}`;

    const result = await notificationManager.sendNotification(notification);

    logBusinessMetric('test_notification_sent', {
      type,
      sent: result.sent,
      failed: result.failed
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Test notification sent successfully',
      result,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Test notification error', {
      error: error.message,
      requestId
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to send test notification'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle notification status check
 */
export async function handleNotificationStatus(request, env) {
  const requestId = crypto.randomUUID();
  logger.info('Notification status request', { requestId });

  try {
    const notificationManager = new WebNotificationManager(env);

    // Get notification statistics from KV
    const today = new Date().toISOString().split('T')[0];
    const analyticsKey = KVKeyFactory.generateKey(KeyTypes.PERFORMANCE_METADATA, {
      date: today
    });

    const dal = createDAL(env);
    const analytics = await dal.read(analyticsKey) || {};
    const notifications = analytics.notifications || {};

    const status = {
      supported: typeof Notification !== 'undefined',
      permission: 'default', // This would be client-side
      statistics: {
        preMarket: notifications.pre_market || { sent: 0, failed: 0 },
        intraday: notifications.intraday || { sent: 0, failed: 0 },
        endOfDay: notifications.end_of_day || { sent: 0, failed: 0 },
        weeklyReview: notifications.weekly_review || { sent: 0, failed: 0 }
      },
      total: {
        sent: Object.values(notifications).reduce((sum, stat) => sum + (stat.sent || 0), 0),
        failed: Object.values(notifications).reduce((sum, stat) => sum + (stat.failed || 0), 0)
      }
    };

    return new Response(JSON.stringify({
      success: true,
      status
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Notification status error', {
      error: error.message,
      requestId
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get notification status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}