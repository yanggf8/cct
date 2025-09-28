/**
 * Enhanced 4-Tier Facebook Messaging System
 * Real-time notifications for complete trading workflow
 */

import { createLogger } from './logging.js';
import { kvStorageManager } from './kv-storage-manager.js';
import { realTimeSignalTracker } from './real-time-tracking.js';

const logger = createLogger('facebook-messaging-system');

/**
 * 4-Tier Message Types
 */
const MESSAGE_TYPES = {
  PRE_MARKET_BRIEFING: 'pre_market_briefing',
  INTRADAY_CHECK: 'intraday_check',
  END_OF_DAY_SUMMARY: 'end_of_day_summary',
  WEEKLY_REVIEW: 'weekly_review'
};

/**
 * Message Templates
 */
const MESSAGE_TEMPLATES = {
  [MESSAGE_TYPES.PRE_MARKET_BRIEFING]: {
    emoji: '🌅',
    title: 'PRE-MARKET BRIEFING',
    time: '8:30 AM EST',
    dashboard: 'pre-market-briefing',
    description: 'High-confidence signals & market preparation'
  },
  [MESSAGE_TYPES.INTRADAY_CHECK]: {
    emoji: '📊',
    title: 'INTRADAY PERFORMANCE CHECK',
    time: '12:00 PM EST',
    dashboard: 'intraday-check',
    description: 'Real-time signal tracking & model health'
  },
  [MESSAGE_TYPES.END_OF_DAY_SUMMARY]: {
    emoji: '🏁',
    title: 'END-OF-DAY SUMMARY',
    time: '4:05 PM EST',
    dashboard: 'end-of-day-summary',
    description: 'Market close analysis & tomorrow outlook'
  },
  [MESSAGE_TYPES.WEEKLY_REVIEW]: {
    emoji: '📈',
    title: 'WEEKLY REVIEW',
    time: 'Sunday 10:00 AM EST',
    dashboard: 'weekly-review',
    description: 'Comprehensive pattern analysis & insights'
  }
};

/**
 * Enhanced Facebook Messaging System
 */
class FacebookMessagingSystem {
  constructor() {
    this.baseUrl = 'https://tft-trading-system.yanggf.workers.dev';
  }

  /**
   * Send Pre-Market Briefing (8:30 AM)
   */
  async sendPreMarketBriefing(env, analysisData, signalsData) {
    return this.sendMessage(
      env,
      MESSAGE_TYPES.PRE_MARKET_BRIEFING,
      analysisData,
      signalsData
    );
  }

  /**
   * Send Intraday Check (12:00 PM)
   */
  async sendIntradayCheck(env, performanceData, signalsData) {
    return this.sendMessage(
      env,
      MESSAGE_TYPES.INTRADAY_CHECK,
      performanceData,
      signalsData
    );
  }

  /**
   * Send End-of-Day Summary (4:05 PM)
   */
  async sendEndOfDaySummary(env, marketData, signalsData) {
    return this.sendMessage(
      env,
      MESSAGE_TYPES.END_OF_DAY_SUMMARY,
      marketData,
      signalsData
    );
  }

  /**
   * Send Weekly Review (Sunday)
   */
  async sendWeeklyReview(env, weeklyData, signalsData) {
    return this.sendMessage(
      env,
      MESSAGE_TYPES.WEEKLY_REVIEW,
      weeklyData,
      signalsData
    );
  }

  /**
   * Core message sending function
   */
  async sendMessage(env, messageType, data, signalsData) {
    const cronExecutionId = crypto.randomUUID();
    logger.info('📤 [FB-MSG] Starting message sending', {
      messageType,
      cronExecutionId
    });

    try {
      // Validate configuration
      if (!this.validateFacebookConfig(env)) {
        logger.warn('Facebook not configured - skipping message', { messageType });
        return false;
      }

      // Build message content
      const messageContent = await this.buildMessageContent(messageType, data, signalsData);

      // Store message in KV
      const messagingKey = `fb_${messageType}_${Date.now()}`;
      await this.storeMessageInKV(env, messagingKey, messageType, messageContent, cronExecutionId);

      // Send to Facebook
      const facebookSuccess = await this.sendToFacebook(env, messageContent, messageType);

      // Update delivery status
      await this.updateDeliveryStatus(env, messagingKey, facebookSuccess);

      logger.info('✅ [FB-MSG] Message processing completed', {
        messageType,
        cronExecutionId,
        facebookSuccess
      });

      return facebookSuccess;

    } catch (error) {
      logger.error('❌ [FB-MSG] Failed to send message', {
        messageType,
        cronExecutionId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Validate Facebook configuration
   */
  validateFacebookConfig(env) {
    return env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID;
  }

  /**
   * Build message content based on type
   */
  async buildMessageContent(messageType, data, signalsData) {
    const template = MESSAGE_TEMPLATES[messageType];
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    let message = `${template.emoji} **${template.title}**\n`;
    message += `🗓️ ${dateStr} ${template.time}\n\n`;

    // Add type-specific content
    switch (messageType) {
      case MESSAGE_TYPES.PRE_MARKET_BRIEFING:
        message += await this.buildPreMarketContent(data, signalsData);
        break;
      case MESSAGE_TYPES.INTRADAY_CHECK:
        message += await this.buildIntradayContent(data, signalsData);
        break;
      case MESSAGE_TYPES.END_OF_DAY_SUMMARY:
        message += await this.buildEndOfDayContent(data, signalsData);
        break;
      case MESSAGE_TYPES.WEEKLY_REVIEW:
        message += await this.buildWeeklyContent(data, signalsData);
        break;
    }

    // Add dashboard link
    message += `\n📊 **${template.title} DASHBOARD:**\n`;
    message += `🔗 ${this.baseUrl}/${template.dashboard}\n`;
    message += `📈 View ${template.description.toLowerCase()}\n\n`;

    // Add system status
    message += `⚙️ **System Status:** Operational ✅\n`;
    message += `🤖 **Models:** TFT + N-HITS Ensemble\n`;
    message += `📊 **Analysis Time:** Real-time\n\n`;

    // Add next update timing
    message += this.getNextUpdateTiming(messageType);

    // Add disclaimer
    message += `⚠️ **DISCLAIMER:** Research/educational purposes only. AI models may be inaccurate. Not financial advice - consult licensed professionals before trading.`;

    return message;
  }

  /**
   * Build Pre-Market Briefing content
   */
  async buildPreMarketContent(analysisData, signalsData) {
    const highConfidenceSignals = signalsData?.signals?.filter(s => s.confidence >= 70) || [];

    let content = `🎯 **High-Confidence Signals (≥70%):**\n`;

    if (highConfidenceSignals.length === 0) {
      content += `   No high-confidence signals identified\n`;
    } else {
      highConfidenceSignals.slice(0, 5).forEach(signal => {
        const direction = signal.prediction === 'up' ? '📈' :
                        signal.prediction === 'down' ? '📉' : '➡️';
        content += `   ${signal.symbol}: ${direction} ${signal.confidence}% confidence\n`;
      });

      if (highConfidenceSignals.length > 5) {
        content += `   ... and ${highConfidenceSignals.length - 5} more signals\n`;
      }
    }

    content += `\n📊 **Market Sentiment:**\n`;
    const bullishCount = highConfidenceSignals.filter(s => s.prediction === 'up').length;
    const bearishCount = highConfidenceSignals.filter(s => s.prediction === 'down').length;
    content += `   Bullish: ${bullishCount} | Bearish: ${bearishCount} | Neutral: ${highConfidenceSignals.length - bullishCount - bearishCount}\n\n`;

    content += `🚀 **Market Preparation:** Complete\n`;

    return content;
  }

  /**
   * Build Intraday Check content
   */
  async buildIntradayContent(performanceData, signalsData) {
    const signalSummary = performanceData || {};

    let content = `📊 **Signal Performance Summary:**\n`;
    content += `   Total Signals: ${signalSummary.totalSignals || 0}\n`;
    content += `   High Confidence: ${signalSummary.highConfidenceSignals || 0}\n`;
    content += `   Validated: ${signalSummary.validatedSignals || 0}\n`;
    content += `   Divergent: ${signalSummary.divergentSignals || 0}\n\n`;

    if (signalSummary.averageAccuracy > 0) {
      content += `🎯 **Live Accuracy:** ${Math.round(signalSummary.averageAccuracy * 100)}%\n\n`;
    }

    content += `⚠️ **Alert Status:** `;
    if (signalSummary.divergentSignals > 0) {
      content += `${signalSummary.divergentSignals} divergent signals detected\n`;
    } else {
      content += `All signals tracking normally\n`;
    }

    return content;
  }

  /**
   * Build End-of-Day Summary content
   */
  async buildEndOfDayContent(marketData, signalsData) {
    let content = `🏁 **Market Close Summary:**\n`;

    if (marketData && marketData.closingData) {
      content += `   Market Status: ${marketData.closingData.status || 'Normal Close'}\n`;
      content += `   Volatility: ${marketData.closingData.volatility || 'Moderate'}\n`;
    }

    content += `\n📈 **Signal Performance:**\n`;
    if (signalsData && signalsData.signals) {
      const correctSignals = signalsData.signals.filter(s => s.status === 'validated').length;
      const totalSignals = signalsData.signals.length;
      const accuracy = totalSignals > 0 ? (correctSignals / totalSignals) * 100 : 0;
      content += `   Daily Accuracy: ${Math.round(accuracy)}% (${correctSignals}/${totalSignals})\n`;
    }

    content += `\n🔮 **Tomorrow Outlook:**\n`;
    content += `   Bias: ${marketData?.tomorrowBias || 'Neutral'}\n`;
    content += `   Confidence: ${marketData?.tomorrowConfidence || 'Medium'}\n`;
    content += `   Focus: ${marketData?.tomorrowFocus || 'Market Open'}\n`;

    return content;
  }

  /**
   * Build Weekly Review content
   */
  async buildWeeklyContent(weeklyData, signalsData) {
    let content = `📈 **Weekly Performance Summary:**\n`;

    if (weeklyData && weeklyData.weeklyOverview) {
      content += `   Trading Days: ${weeklyData.weeklyOverview.totalTradingDays || 5}\n`;
      content += `   Total Signals: ${weeklyData.weeklyOverview.totalSignals || 0}\n`;
      content += `   Weekly Performance: ${weeklyData.weeklyOverview.weeklyPerformance || 'Moderate'}\n`;
    }

    if (weeklyData && weeklyData.accuracyMetrics) {
      content += `   Average Accuracy: ${weeklyData.accuracyMetrics.weeklyAverage || 0}%\n`;
    }

    content += `\n🎯 **Key Insights:**\n`;
    if (weeklyData && weeklyData.insights) {
      weeklyData.insights.slice(0, 3).forEach(insight => {
        content += `   • ${insight.message}\n`;
      });
    }

    content += `\n📊 **Next Week Outlook:**\n`;
    if (weeklyData && weeklyData.nextWeekOutlook) {
      content += `   Market Bias: ${weeklyData.nextWeekOutlook.marketBias}\n`;
      content += `   Confidence Level: ${weeklyData.nextWeekOutlook.confidenceLevel}\n`;
      content += `   Key Focus: ${weeklyData.nextWeekOutlook.keyFocus}\n`;
    }

    return content;
  }

  /**
   * Get next update timing based on message type
   */
  getNextUpdateTiming(messageType) {
    const timings = {
      [MESSAGE_TYPES.PRE_MARKET_BRIEFING]: '🎯 **Next Update:** 12:00 PM EST (Intraday Check)\n',
      [MESSAGE_TYPES.INTRADAY_CHECK]: '🎯 **Next Update:** 4:05 PM EST (End-of-Day Summary)\n',
      [MESSAGE_TYPES.END_OF_DAY_SUMMARY]: '🎯 **Next Update:** Tomorrow 8:30 AM EST (Pre-Market Briefing)\n',
      [MESSAGE_TYPES.WEEKLY_REVIEW]: '🎯 **Next Update:** Monday 8:30 AM EST (Pre-Market Briefing)\n'
    };

    return timings[messageType] || '🎯 **Next Update:** Scheduled\n';
  }

  /**
   * Store message in KV storage
   */
  async storeMessageInKV(env, messagingKey, messageType, messageContent, cronExecutionId) {
    try {
      const kvData = {
        messageType,
        messageContent: messageContent.substring(0, 500) + '...',
        cronExecutionId,
        timestamp: new Date().toISOString(),
        facebookDeliveryStatus: 'pending',
        messageSent: false,
        dashboardUrl: `${this.baseUrl}/${MESSAGE_TEMPLATES[messageType].dashboard}`
      };

      await env.TRADING_RESULTS.put(messagingKey, JSON.stringify(kvData), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days
      });

      logger.debug('Stored message in KV', { messagingKey, messageType });

    } catch (error) {
      logger.error('Failed to store message in KV', {
        messagingKey,
        messageType,
        error: error.message
      });
    }
  }

  /**
   * Send message to Facebook
   */
  async sendToFacebook(env, messageContent, messageType) {
    try {
      const payload = {
        recipient: { id: env.FACEBOOK_RECIPIENT_ID },
        message: { text: messageContent },
        messaging_type: 'MESSAGE_TAG',
        tag: 'CONFIRMED_EVENT_UPDATE'
      };

      const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${env.FACEBOOK_PAGE_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        logger.info('Facebook message sent successfully', { messageType });
        return true;
      } else {
        const errorText = await response.text();
        logger.error('Facebook API failed', { messageType, error: errorText });
        return false;
      }

    } catch (error) {
      logger.error('Facebook send error', { messageType, error: error.message });
      return false;
    }
  }

  /**
   * Update delivery status in KV
   */
  async updateDeliveryStatus(env, messagingKey, success) {
    try {
      const kvData = await env.TRADING_RESULTS.get(messagingKey);
      if (kvData) {
        const parsed = JSON.parse(kvData);
        parsed.messageSent = success;
        parsed.facebookDeliveryStatus = success ? 'delivered' : 'failed';
        parsed.deliveryTimestamp = new Date().toISOString();

        await env.TRADING_RESULTS.put(messagingKey, JSON.stringify(parsed), {
          expirationTtl: 7 * 24 * 60 * 60
        });

        logger.debug('Updated delivery status', { messagingKey, success });
      }
    } catch (error) {
      logger.error('Failed to update delivery status', {
        messagingKey,
        success,
        error: error.message
      });
    }
  }
}

// Global instance
const facebookMessagingSystem = new FacebookMessagingSystem();

export {
  FacebookMessagingSystem,
  MESSAGE_TYPES,
  MESSAGE_TEMPLATES,
  facebookMessagingSystem
};