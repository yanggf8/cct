/**
 * Messenger Alerts - Facebook Messenger & LINE Integration
 * Send trading alerts via Facebook Messenger and LINE messaging platforms
 */

/**
 * Interface for Cloudflare environment variables
 */
export interface CloudflareEnvironment {
  FACEBOOK_PAGE_TOKEN?: string;
  FACEBOOK_RECIPIENT_ID?: string;
  LINE_CHANNEL_TOKEN?: string;
  LINE_USER_ID?: string;
}

/**
 * Alert level enumeration
 */
export type AlertLevel = 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE';

/**
 * Trading signal interface
 */
export interface TradingSignal {
  symbol: string;
  action: string;
  current_price: number;
  confidence: number;
  reasoning: string;
  components?: {
    price_prediction?: {
      predicted_price?: number;
      confidence?: number;
      time_horizon?: string;
    };
    sentiment_analysis?: {
      overall_sentiment?: string;
      confidence?: number;
      key_factors?: string[];
    };
  };
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  success_rate: number;
  avg_confidence: number;
  signal_distribution: {
    BUY?: number;
    SELL?: number;
    HOLD?: number;
  };
}

/**
 * Analysis results interface
 */
export interface AnalysisResults {
  trading_signals: Record<string, TradingSignal>;
  performance_metrics: PerformanceMetrics;
}

/**
 * Alert interface
 */
export interface TradingAlert {
  symbol: string;
  level: AlertLevel;
  timestamp?: Date;
  message?: string;
}

/**
 * Facebook Graph API response interface
 */
export interface FacebookGraphResponse {
  recipient_id: string;
  message_id: string;
}

/**
 * Facebook Graph API error interface
 */
export interface FacebookGraphError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
  };
}

/**
 * LINE Messaging API response interface
 */
export interface LineMessageResponse {
  [key: string]: any;
}

/**
 * LINE Messaging API error interface
 */
export interface LineMessageError {
  error: {
    message: string;
    details?: any[];
  };
}

/**
 * Facebook message recipient interface
 */
export interface FacebookRecipient {
  id: string;
}

/**
 * Facebook message interface
 */
export interface FacebookMessage {
  text?: string;
  attachment?: {
    type: 'template';
    payload: {
      template_type: 'generic';
      elements: FacebookGenericElement[];
    };
  };
}

/**
 * Facebook generic template element interface
 */
export interface FacebookGenericElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  buttons?: FacebookButton[];
}

/**
 * Facebook button interface
 */
export interface FacebookButton {
  type: 'web_url' | 'postback';
  url?: string;
  title: string;
  payload?: string;
}

/**
 * Facebook message request payload interface
 */
export interface FacebookMessageRequest {
  recipient: FacebookRecipient;
  message: FacebookMessage;
  messaging_type: 'UPDATE' | 'MESSAGE_TAG' | 'RESPONSE';
}

/**
 * LINE message action interface
 */
export interface LineMessageAction {
  type: 'uri' | 'postback';
  label: string;
  uri?: string;
  data?: string;
}

/**
 * LINE flex content interface
 */
export interface LineFlexContent {
  type: string;
  text?: string;
  weight?: 'bold' | 'normal';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  color?: string;
  align?: 'start' | 'center' | 'end';
  margin?: string;
  spacing?: string;
  wrap?: boolean;
  flex?: number;
  url?: string;
  aspectRatio?: string;
  aspectMode?: string;
  layout?: 'horizontal' | 'vertical' | 'baseline';
  contents?: LineFlexContent[];
  action?: LineMessageAction;
  style?: string;
  height?: string;
}

/**
 * LINE bubble container interface
 */
export interface LineBubbleContainer {
  type: 'bubble';
  hero?: {
    type: 'image';
    url: string;
    size?: string;
    aspectRatio?: string;
    aspectMode?: string;
  };
  body: {
    type: 'box';
    layout: 'vertical';
    contents: LineFlexContent[];
  };
  footer?: {
    type: 'box';
    layout: 'vertical';
    spacing?: string;
    contents: LineFlexContent[];
    flex?: number;
  };
}

/**
 * LINE carousel container interface
 */
export interface LineCarouselContainer {
  type: 'carousel';
  contents: LineBubbleContainer[];
}

/**
 * LINE flex message interface
 */
export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: LineCarouselContainer;
}

/**
 * LINE sticker message interface
 */
export interface LineStickerMessage {
  type: 'sticker';
  packageId: string;
  stickerId: string;
}

/**
 * LINE message push request interface
 */
export interface LineMessagePushRequest {
  to: string;
  messages: (LineFlexMessage | LineStickerMessage | { type: 'text'; text: string })[];
}

/**
 * Company domain mapping interface
 */
export interface CompanyDomainMap {
  [symbol: string]: string;
}

/**
 * Send Facebook Messenger alert
 *
 * @param alerts - Array of trading alerts
 * @param analysisResults - Complete analysis results with trading signals
 * @param env - Cloudflare environment variables
 */
export async function sendFacebookMessengerAlert(
  alerts: TradingAlert[],
  analysisResults: AnalysisResults,
  env: CloudflareEnvironment
): Promise<void> {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log('⚠️ Facebook Messenger not configured - skipping');
    return;
  }

  try {
    const highConfidenceAlerts = alerts.filter(a => a.level === 'HIGH_CONFIDENCE');

    if (highConfidenceAlerts.length === 0) return;

    // Format message for Messenger
    let messageText = `🎯 Trading Alert - ${highConfidenceAlerts.length} High Confidence Signals\n\n`;

    highConfidenceAlerts.forEach(alert => {
      const signal = analysisResults.trading_signals[alert.symbol];
      if (signal) {
        messageText += `📈 ${alert.symbol}: ${signal.action}\n`;
        messageText += `   💰 Price: $${signal.current_price.toFixed(2)}\n`;
        messageText += `   🎯 Confidence: ${(signal.confidence * 100).toFixed(1)}%\n`;
        messageText += `   💡 ${signal.reasoning}\n\n`;
      }
    });

    // Add performance summary
    const perf = analysisResults.performance_metrics;
    messageText += `📊 Performance:\n`;
    messageText += `✅ Success Rate: ${perf.success_rate.toFixed(1)}%\n`;
    messageText += `📈 Avg Confidence: ${(perf.avg_confidence * 100).toFixed(1)}%\n`;
    messageText += `📋 Signals: ${JSON.stringify(perf.signal_distribution)}`;

    // Send via Facebook Graph API
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: {
          id: env.FACEBOOK_RECIPIENT_ID
        },
        message: {
          text: messageText
        },
        messaging_type: 'UPDATE'
      } as FacebookMessageRequest)
    });

    if (response.ok) {
      console.log('✅ Facebook Messenger alert sent successfully');

      // Send individual signal cards for high-value signals
      for (const alert of highConfidenceAlerts.slice(0, 3)) { // Max 3 detailed cards
        await sendFacebookSignalCard(alert, analysisResults.trading_signals[alert.symbol], env);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      }

    } else {
      const error = await response.text();
      console.error('❌ Facebook Messenger alert failed:', error);
    }

  } catch (error: unknown) {
    console.error('❌ Facebook Messenger error:', error);
  }
}

/**
 * Send detailed signal card via Facebook Messenger
 *
 * @param alert - Trading alert information
 * @param signal - Detailed trading signal
 * @param env - Cloudflare environment variables
 */
export async function sendFacebookSignalCard(
  alert: TradingAlert,
  signal: TradingSignal,
  env: CloudflareEnvironment
): Promise<void> {
  try {
    const priceComp = signal.components?.price_prediction || {};
    const sentComp = signal.components?.sentiment_analysis || {};

    // Create rich card template
    const cardTemplate: FacebookMessageRequest = {
      recipient: {
        id: env.FACEBOOK_RECIPIENT_ID!
      },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: [
              {
                title: `${signal.symbol} - ${signal.action}`,
                subtitle: `$${signal.current_price.toFixed(2)} | Confidence: ${(signal.confidence * 100).toFixed(1)}%`,
                image_url: `https://logo.clearbit.com/${getCompanyDomain(signal.symbol)}`,
                buttons: [
                  {
                    type: 'web_url',
                    url: `https://finance.yahoo.com/quote/${signal.symbol}`,
                    title: 'View Chart'
                  },
                  {
                    type: 'postback',
                    title: 'Get Analysis',
                    payload: `ANALYSIS_${signal.symbol}`
                  }
                ]
              }
            ]
          }
        }
      },
      messaging_type: 'UPDATE'
    };

    await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify(cardTemplate)
    });

  } catch (error: unknown) {
    console.error('❌ Facebook card send error:', error);
  }
}

/**
 * Send LINE (Taiwan) alert
 *
 * @param alerts - Array of trading alerts
 * @param analysisResults - Complete analysis results with trading signals
 * @param env - Cloudflare environment variables
 */
export async function sendLINEAlert(
  alerts: TradingAlert[],
  analysisResults: AnalysisResults,
  env: CloudflareEnvironment
): Promise<void> {
  if (!env.LINE_CHANNEL_TOKEN || !env.LINE_USER_ID) {
    console.log('⚠️ LINE not configured - skipping');
    return;
  }

  try {
    const highConfidenceAlerts = alerts.filter(a => a.level === 'HIGH_CONFIDENCE');

    if (highConfidenceAlerts.length === 0) return;

    // Create LINE Flex Message for rich formatting
    const flexMessage = createLINEFlexMessage(highConfidenceAlerts, analysisResults);

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.LINE_CHANNEL_TOKEN}`
      },
      body: JSON.stringify({
        to: env.LINE_USER_ID,
        messages: [flexMessage]
      } as LineMessagePushRequest)
    });

    if (response.ok) {
      console.log('✅ LINE alert sent successfully');

      // Send follow-up sticker for high-impact signals
      if (highConfidenceAlerts.length >= 3) {
        await sendLINESticker(env.LINE_USER_ID, env.LINE_CHANNEL_TOKEN);
      }

    } else {
      const error = await response.text();
      console.error('❌ LINE alert failed:', error);
    }

  } catch (error: unknown) {
    console.error('❌ LINE error:', error);
  }
}

/**
 * Create LINE Flex Message for trading alerts
 *
 * @param alerts - Array of high confidence alerts
 * @param analysisResults - Complete analysis results
 * @returns LINE Flex Message object
 */
export function createLINEFlexMessage(
  alerts: TradingAlert[],
  analysisResults: AnalysisResults
): LineFlexMessage {
  const perf = analysisResults.performance_metrics;

  // Create signal bubbles
  const signalBubbles: LineBubbleContainer[] = alerts.slice(0, 5).map(alert => {
    const signal = analysisResults.trading_signals[alert.symbol];
    const actionColor = signal.action.includes('BUY') ? '#00C851' :
                       signal.action.includes('SELL') ? '#FF4444' : '#33B5E5';

    return {
      type: 'bubble',
      hero: {
        type: 'image',
        url: `https://logo.clearbit.com/${getCompanyDomain(signal.symbol)}`,
        size: 'sm',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: signal.symbol,
            weight: 'bold',
            size: 'xl'
          },
          {
            type: 'text',
            text: signal.action,
            size: 'md',
            color: actionColor,
            weight: 'bold'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '價格',
                    color: '#aaaaaa',
                    size: 'sm',
                    flex: 1
                  },
                  {
                    type: 'text',
                    text: `$${signal.current_price.toFixed(2)}`,
                    wrap: true,
                    color: '#666666',
                    size: 'sm',
                    flex: 2
                  }
                ]
              },
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  {
                    type: 'text',
                    text: '信心度',
                    color: '#aaaaaa',
                    size: 'sm',
                    flex: 1
                  },
                  {
                    type: 'text',
                    text: `${(signal.confidence * 100).toFixed(1)}%`,
                    wrap: true,
                    color: '#666666',
                    size: 'sm',
                    flex: 2
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '查看圖表',
              uri: `https://finance.yahoo.com/quote/${signal.symbol}`
            },
            color: actionColor
          }
        ],
        flex: 0
      }
    };
  });

  // Create summary bubble
  const summaryBubble: LineBubbleContainer = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📊 交易分析摘要',
          weight: 'bold',
          size: 'lg',
          align: 'center'
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '成功率',
                  color: '#aaaaaa',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${perf.success_rate.toFixed(1)}%`,
                  color: '#00C851',
                  weight: 'bold',
                  flex: 2
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '平均信心度',
                  color: '#aaaaaa',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${(perf.avg_confidence * 100).toFixed(1)}%`,
                  color: '#33B5E5',
                  weight: 'bold',
                  flex: 2
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '買入信號',
                  color: '#aaaaaa',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${perf.signal_distribution.BUY || 0}`,
                  color: '#00C851',
                  weight: 'bold',
                  flex: 2
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                {
                  type: 'text',
                  text: '賣出信號',
                  color: '#aaaaaa',
                  flex: 1
                },
                {
                  type: 'text',
                  text: `${perf.signal_distribution.SELL || 0}`,
                  color: '#FF4444',
                  weight: 'bold',
                  flex: 2
                }
              ]
            }
          ]
        }
      ]
    }
  };

  return {
    type: 'flex',
    altText: `🎯 ${alerts.length} 個高信心度交易信號`,
    contents: {
      type: 'carousel',
      contents: [summaryBubble, ...signalBubbles]
    }
  };
}

/**
 * Send celebratory LINE sticker for strong signals
 *
 * @param userId - LINE user ID
 * @param token - LINE channel access token
 */
export async function sendLINESticker(userId: string, token: string): Promise<void> {
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'sticker',
            packageId: '446',  // LINE basic stickers
            stickerId: '1988'  // Money/success sticker
          }
        ]
      } as LineMessagePushRequest)
    });
  } catch (error: unknown) {
    console.error('❌ LINE sticker error:', error);
  }
}

/**
 * Get company domain for logo fetching
 *
 * @param symbol - Stock symbol
 * @returns Company domain string
 */
export function getCompanyDomain(symbol: string): string {
  const domainMap: CompanyDomainMap = {
    'AAPL': 'apple.com',
    'TSLA': 'tesla.com',
    'MSFT': 'microsoft.com',
    'GOOGL': 'google.com',
    'NVDA': 'nvidia.com',
    'AMZN': 'amazon.com',
    'META': 'meta.com',
    'NFLX': 'netflix.com'
  };

  return domainMap[symbol] || 'yahoo.com';
}

/**
 * Send critical system alert via all messenger platforms
 *
 * @param errorMessage - Error message to send
 * @param env - Cloudflare environment variables
 */
export async function sendCriticalMessengerAlert(
  errorMessage: string,
  env: CloudflareEnvironment
): Promise<void> {
  const criticalMessage = `🚨 CRITICAL ALERT\n\n交易系統發生嚴重錯誤：\n${errorMessage}\n\n請立即檢查系統狀態。\n\nTime: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

  // Send to Facebook Messenger
  if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
    try {
      await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
        },
        body: JSON.stringify({
          recipient: { id: env.FACEBOOK_RECIPIENT_ID },
          message: { text: criticalMessage },
          messaging_type: 'UPDATE'
        } as FacebookMessageRequest)
      });
    } catch (error: unknown) {
      console.error('❌ Critical Facebook alert failed:', error);
    }
  }

  // Send to LINE
  if (env.LINE_CHANNEL_TOKEN && env.LINE_USER_ID) {
    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.LINE_CHANNEL_TOKEN}`
        },
        body: JSON.stringify({
          to: env.LINE_USER_ID,
          messages: [
            {
              type: 'text',
              text: criticalMessage
            },
            {
              type: 'sticker',
              packageId: '446',
              stickerId: '1990'  // Warning sticker
            }
          ]
        } as LineMessagePushRequest)
      });
    } catch (error: unknown) {
      console.error('❌ Critical LINE alert failed:', error);
    }
  }
}

// Export all types for external use
export type {
  CloudflareEnvironment,
  AlertLevel,
  TradingSignal,
  PerformanceMetrics,
  AnalysisResults,
  TradingAlert,
  FacebookGraphResponse,
  FacebookGraphError,
  LineMessageResponse,
  LineMessageError,
  FacebookRecipient,
  FacebookMessage,
  FacebookGenericElement,
  FacebookButton,
  FacebookMessageRequest,
  LineMessageAction,
  LineFlexContent,
  LineBubbleContainer,
  LineCarouselContainer,
  LineFlexMessage,
  LineStickerMessage,
  LineMessagePushRequest,
  CompanyDomainMap
};