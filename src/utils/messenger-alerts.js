/**
 * Messenger Alerts - Facebook Messenger & LINE Integration
 * Send trading alerts via Facebook Messenger and LINE messaging platforms
 */

/**
 * Send Facebook Messenger alert
 */
async function sendFacebookMessengerAlert(alerts, analysisResults, env) {
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
      })
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

  } catch (error) {
    console.error('❌ Facebook Messenger error:', error);
  }
}

/**
 * Send detailed signal card via Facebook Messenger
 */
async function sendFacebookSignalCard(alert, signal, env) {
  try {
    const priceComp = signal.components?.price_prediction || {};
    const sentComp = signal.components?.sentiment_analysis || {};
    
    // Create rich card template
    const cardTemplate = {
      recipient: {
        id: env.FACEBOOK_RECIPIENT_ID
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

  } catch (error) {
    console.error('❌ Facebook card send error:', error);
  }
}

/**
 * Send LINE (Taiwan) alert
 */
async function sendLINEAlert(alerts, analysisResults, env) {
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
      })
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

  } catch (error) {
    console.error('❌ LINE error:', error);
  }
}

/**
 * Create LINE Flex Message for trading alerts
 */
function createLINEFlexMessage(alerts, analysisResults) {
  const perf = analysisResults.performance_metrics;
  
  // Create signal bubbles
  const signalBubbles = alerts.slice(0, 5).map(alert => {
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
  const summaryBubble = {
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
 */
async function sendLINESticker(userId, token) {
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
      })
    });
  } catch (error) {
    console.error('❌ LINE sticker error:', error);
  }
}

/**
 * Get company domain for logo fetching
 */
function getCompanyDomain(symbol) {
  const domainMap = {
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
 */
async function sendCriticalMessengerAlert(errorMessage, env) {
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
        })
      });
    } catch (error) {
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
        })
      });
    } catch (error) {
      console.error('❌ Critical LINE alert failed:', error);
    }
  }
}

// Export functions for use in main worker
export {
  sendFacebookMessengerAlert,
  sendLINEAlert,
  sendCriticalMessengerAlert
};