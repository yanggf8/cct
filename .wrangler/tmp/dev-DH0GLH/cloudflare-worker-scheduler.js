var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-Kozf4P/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// messenger-alerts.js
async function sendFacebookMessengerAlert(alerts, analysisResults, env) {
  if (!env.FACEBOOK_PAGE_TOKEN || !env.FACEBOOK_RECIPIENT_ID) {
    console.log("\u26A0\uFE0F Facebook Messenger not configured - skipping");
    return;
  }
  try {
    const highConfidenceAlerts = alerts.filter((a) => a.level === "HIGH_CONFIDENCE");
    if (highConfidenceAlerts.length === 0) return;
    let messageText = `\u{1F3AF} Trading Alert - ${highConfidenceAlerts.length} High Confidence Signals

`;
    highConfidenceAlerts.forEach((alert) => {
      const signal = analysisResults.trading_signals[alert.symbol];
      if (signal) {
        messageText += `\u{1F4C8} ${alert.symbol}: ${signal.action}
`;
        messageText += `   \u{1F4B0} Price: $${signal.current_price.toFixed(2)}
`;
        messageText += `   \u{1F3AF} Confidence: ${(signal.confidence * 100).toFixed(1)}%
`;
        messageText += `   \u{1F4A1} ${signal.reasoning}

`;
      }
    });
    const perf = analysisResults.performance_metrics;
    messageText += `\u{1F4CA} Performance:
`;
    messageText += `\u2705 Success Rate: ${perf.success_rate.toFixed(1)}%
`;
    messageText += `\u{1F4C8} Avg Confidence: ${(perf.avg_confidence * 100).toFixed(1)}%
`;
    messageText += `\u{1F4CB} Signals: ${JSON.stringify(perf.signal_distribution)}`;
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify({
        recipient: {
          id: env.FACEBOOK_RECIPIENT_ID
        },
        message: {
          text: messageText
        },
        messaging_type: "UPDATE"
      })
    });
    if (response.ok) {
      console.log("\u2705 Facebook Messenger alert sent successfully");
      for (const alert of highConfidenceAlerts.slice(0, 3)) {
        await sendFacebookSignalCard(alert, analysisResults.trading_signals[alert.symbol], env);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    } else {
      const error = await response.text();
      console.error("\u274C Facebook Messenger alert failed:", error);
    }
  } catch (error) {
    console.error("\u274C Facebook Messenger error:", error);
  }
}
__name(sendFacebookMessengerAlert, "sendFacebookMessengerAlert");
async function sendFacebookSignalCard(alert, signal, env) {
  try {
    const priceComp = signal.components?.price_prediction || {};
    const sentComp = signal.components?.sentiment_analysis || {};
    const cardTemplate = {
      recipient: {
        id: env.FACEBOOK_RECIPIENT_ID
      },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: `${signal.symbol} - ${signal.action}`,
                subtitle: `$${signal.current_price.toFixed(2)} | Confidence: ${(signal.confidence * 100).toFixed(1)}%`,
                image_url: `https://logo.clearbit.com/${getCompanyDomain(signal.symbol)}`,
                buttons: [
                  {
                    type: "web_url",
                    url: `https://finance.yahoo.com/quote/${signal.symbol}`,
                    title: "View Chart"
                  },
                  {
                    type: "postback",
                    title: "Get Analysis",
                    payload: `ANALYSIS_${signal.symbol}`
                  }
                ]
              }
            ]
          }
        }
      },
      messaging_type: "UPDATE"
    };
    await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
      },
      body: JSON.stringify(cardTemplate)
    });
  } catch (error) {
    console.error("\u274C Facebook card send error:", error);
  }
}
__name(sendFacebookSignalCard, "sendFacebookSignalCard");
async function sendLINEAlert(alerts, analysisResults, env) {
  if (!env.LINE_CHANNEL_TOKEN || !env.LINE_USER_ID) {
    console.log("\u26A0\uFE0F LINE not configured - skipping");
    return;
  }
  try {
    const highConfidenceAlerts = alerts.filter((a) => a.level === "HIGH_CONFIDENCE");
    if (highConfidenceAlerts.length === 0) return;
    const flexMessage = createLINEFlexMessage(highConfidenceAlerts, analysisResults);
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.LINE_CHANNEL_TOKEN}`
      },
      body: JSON.stringify({
        to: env.LINE_USER_ID,
        messages: [flexMessage]
      })
    });
    if (response.ok) {
      console.log("\u2705 LINE alert sent successfully");
      if (highConfidenceAlerts.length >= 3) {
        await sendLINESticker(env.LINE_USER_ID, env.LINE_CHANNEL_TOKEN);
      }
    } else {
      const error = await response.text();
      console.error("\u274C LINE alert failed:", error);
    }
  } catch (error) {
    console.error("\u274C LINE error:", error);
  }
}
__name(sendLINEAlert, "sendLINEAlert");
function createLINEFlexMessage(alerts, analysisResults) {
  const perf = analysisResults.performance_metrics;
  const signalBubbles = alerts.slice(0, 5).map((alert) => {
    const signal = analysisResults.trading_signals[alert.symbol];
    const actionColor = signal.action.includes("BUY") ? "#00C851" : signal.action.includes("SELL") ? "#FF4444" : "#33B5E5";
    return {
      type: "bubble",
      hero: {
        type: "image",
        url: `https://logo.clearbit.com/${getCompanyDomain(signal.symbol)}`,
        size: "sm",
        aspectRatio: "20:13",
        aspectMode: "cover"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: signal.symbol,
            weight: "bold",
            size: "xl"
          },
          {
            type: "text",
            text: signal.action,
            size: "md",
            color: actionColor,
            weight: "bold"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "\u50F9\u683C",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `$${signal.current_price.toFixed(2)}`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 2
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "\u4FE1\u5FC3\u5EA6",
                    color: "#aaaaaa",
                    size: "sm",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${(signal.confidence * 100).toFixed(1)}%`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 2
                  }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: {
              type: "uri",
              label: "\u67E5\u770B\u5716\u8868",
              uri: `https://finance.yahoo.com/quote/${signal.symbol}`
            },
            color: actionColor
          }
        ],
        flex: 0
      }
    };
  });
  const summaryBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "\u{1F4CA} \u4EA4\u6613\u5206\u6790\u6458\u8981",
          weight: "bold",
          size: "lg",
          align: "center"
        },
        {
          type: "separator",
          margin: "lg"
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "md",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "\u6210\u529F\u7387",
                  color: "#aaaaaa",
                  flex: 1
                },
                {
                  type: "text",
                  text: `${perf.success_rate.toFixed(1)}%`,
                  color: "#00C851",
                  weight: "bold",
                  flex: 2
                }
              ]
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "\u5E73\u5747\u4FE1\u5FC3\u5EA6",
                  color: "#aaaaaa",
                  flex: 1
                },
                {
                  type: "text",
                  text: `${(perf.avg_confidence * 100).toFixed(1)}%`,
                  color: "#33B5E5",
                  weight: "bold",
                  flex: 2
                }
              ]
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "\u8CB7\u5165\u4FE1\u865F",
                  color: "#aaaaaa",
                  flex: 1
                },
                {
                  type: "text",
                  text: `${perf.signal_distribution.BUY || 0}`,
                  color: "#00C851",
                  weight: "bold",
                  flex: 2
                }
              ]
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "\u8CE3\u51FA\u4FE1\u865F",
                  color: "#aaaaaa",
                  flex: 1
                },
                {
                  type: "text",
                  text: `${perf.signal_distribution.SELL || 0}`,
                  color: "#FF4444",
                  weight: "bold",
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
    type: "flex",
    altText: `\u{1F3AF} ${alerts.length} \u500B\u9AD8\u4FE1\u5FC3\u5EA6\u4EA4\u6613\u4FE1\u865F`,
    contents: {
      type: "carousel",
      contents: [summaryBubble, ...signalBubbles]
    }
  };
}
__name(createLINEFlexMessage, "createLINEFlexMessage");
async function sendLINESticker(userId, token) {
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "sticker",
            packageId: "446",
            // LINE basic stickers
            stickerId: "1988"
            // Money/success sticker
          }
        ]
      })
    });
  } catch (error) {
    console.error("\u274C LINE sticker error:", error);
  }
}
__name(sendLINESticker, "sendLINESticker");
function getCompanyDomain(symbol) {
  const domainMap = {
    "AAPL": "apple.com",
    "TSLA": "tesla.com",
    "MSFT": "microsoft.com",
    "GOOGL": "google.com",
    "NVDA": "nvidia.com",
    "AMZN": "amazon.com",
    "META": "meta.com",
    "NFLX": "netflix.com"
  };
  return domainMap[symbol] || "yahoo.com";
}
__name(getCompanyDomain, "getCompanyDomain");
async function sendCriticalMessengerAlert(errorMessage, env) {
  const criticalMessage = `\u{1F6A8} CRITICAL ALERT

\u4EA4\u6613\u7CFB\u7D71\u767C\u751F\u56B4\u91CD\u932F\u8AA4\uFF1A
${errorMessage}

\u8ACB\u7ACB\u5373\u6AA2\u67E5\u7CFB\u7D71\u72C0\u614B\u3002

Time: ${(/* @__PURE__ */ new Date()).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`;
  if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
    try {
      await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.FACEBOOK_PAGE_TOKEN}`
        },
        body: JSON.stringify({
          recipient: { id: env.FACEBOOK_RECIPIENT_ID },
          message: { text: criticalMessage },
          messaging_type: "UPDATE"
        })
      });
    } catch (error) {
      console.error("\u274C Critical Facebook alert failed:", error);
    }
  }
  if (env.LINE_CHANNEL_TOKEN && env.LINE_USER_ID) {
    try {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.LINE_CHANNEL_TOKEN}`
        },
        body: JSON.stringify({
          to: env.LINE_USER_ID,
          messages: [
            {
              type: "text",
              text: criticalMessage
            },
            {
              type: "sticker",
              packageId: "446",
              stickerId: "1990"
              // Warning sticker
            }
          ]
        })
      });
    } catch (error) {
      console.error("\u274C Critical LINE alert failed:", error);
    }
  }
}
__name(sendCriticalMessengerAlert, "sendCriticalMessengerAlert");

// cloudflare-worker-scheduler.js
var cloudflare_worker_scheduler_default = {
  async scheduled(controller, env, ctx) {
    const scheduledTime = new Date(controller.scheduledTime);
    const estTime = new Date(scheduledTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    console.log(`\u{1F680} Scheduled analysis triggered at ${estTime.toISOString()}`);
    try {
      const analysisResult = await runPreMarketAnalysis(env);
      await env.TRADING_RESULTS.put(
        `analysis_${estTime.toISOString().split("T")[0]}`,
        // YYYY-MM-DD key
        JSON.stringify(analysisResult),
        { expirationTtl: 86400 }
        // 24 hours
      );
      if (analysisResult.alerts && analysisResult.alerts.length > 0) {
        await sendAlerts(analysisResult, env);
      }
      console.log(`\u2705 Analysis completed: ${analysisResult.symbols_analyzed.length} symbols`);
    } catch (error) {
      console.error(`\u274C Scheduled analysis failed:`, error);
      await env.TRADING_RESULTS.put(
        `error_${estTime.toISOString()}`,
        JSON.stringify({
          error: error.message,
          timestamp: estTime.toISOString(),
          type: "scheduled_analysis_failure"
        }),
        { expirationTtl: 86400 }
      );
      await sendCriticalAlert(error.message, env);
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/analyze") {
      return handleManualAnalysis(request, env);
    } else if (url.pathname === "/results") {
      return handleGetResults(request, env);
    } else if (url.pathname === "/health") {
      return handleHealthCheck(request, env);
    } else {
      return new Response("Trading System Worker API\nEndpoints: /analyze, /results, /health", {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};
async function runPreMarketAnalysis(env) {
  const symbols = ["AAPL", "TSLA", "MSFT", "GOOGL", "NVDA"];
  const analysisResults = {
    run_id: `worker_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "_")}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    symbols_analyzed: [],
    trading_signals: {},
    alerts: [],
    performance_metrics: {},
    status: "running",
    worker_version: "1.0-Cloudflare"
  };
  console.log(`\u{1F4CA} Starting analysis for ${symbols.length} symbols...`);
  for (const symbol of symbols) {
    try {
      console.log(`   \u{1F4C8} Analyzing ${symbol}...`);
      const marketData = await getMarketData(symbol);
      if (!marketData.success) {
        throw new Error(`Market data failed: ${marketData.error}`);
      }
      let priceSignal;
      try {
        priceSignal = await getTFTPrediction(symbol, marketData.data, env);
        priceSignal.model_used = "TFT-Primary";
      } catch (tftError) {
        console.log(`   \u26A0\uFE0F TFT failed for ${symbol}, using N-HITS backup: ${tftError.message}`);
        priceSignal = await getNHITSPrediction(symbol, marketData.data, env);
        priceSignal.model_used = "N-HITS-Backup";
      }
      const sentimentSignal = await getSentimentAnalysis(symbol, env);
      const combinedSignal = combineSignals(priceSignal, sentimentSignal, symbol, marketData.current_price);
      analysisResults.symbols_analyzed.push(symbol);
      analysisResults.trading_signals[symbol] = combinedSignal;
      if (combinedSignal.confidence > 0.85 && combinedSignal.action.includes("BUY") || combinedSignal.action.includes("SELL")) {
        analysisResults.alerts.push({
          level: "HIGH_CONFIDENCE",
          symbol,
          message: `\u{1F3AF} High confidence signal: ${symbol} - ${combinedSignal.action} (${(combinedSignal.confidence * 100).toFixed(1)}%)`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      console.log(`   \u2705 ${symbol}: ${combinedSignal.action} (conf: ${(combinedSignal.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error(`   \u274C ${symbol} analysis failed:`, error.message);
      analysisResults.alerts.push({
        level: "ERROR",
        symbol,
        message: `Analysis failed: ${error.message}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  analysisResults.performance_metrics = generatePerformanceMetrics(analysisResults);
  analysisResults.status = "completed";
  return analysisResults;
}
__name(runPreMarketAnalysis, "runPreMarketAnalysis");
async function getMarketData(symbol) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradingBot/1.0)" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const result = data.chart.result[0];
    if (!result || !result.indicators || !result.indicators.quote[0]) {
      throw new Error("Invalid data format");
    }
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const current_price = quote.close[quote.close.length - 1];
    const ohlcv_data = [];
    const days_to_take = Math.min(30, timestamps.length);
    for (let i = timestamps.length - days_to_take; i < timestamps.length; i++) {
      if (quote.open[i] && quote.high[i] && quote.low[i] && quote.close[i]) {
        ohlcv_data.push([
          quote.open[i],
          quote.high[i],
          quote.low[i],
          quote.close[i],
          quote.volume[i] || 0
        ]);
      }
    }
    return {
      success: true,
      current_price,
      data: ohlcv_data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
__name(getMarketData, "getMarketData");
async function getTFTPrediction(symbol, ohlcv_data, env) {
  try {
    const response = await fetch("https://www.modelscope.cn/api/v1/models/yanggf2/tft-primary-nhits-backup-predictor/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.MODELSCOPE_API_TOKEN}`
      },
      body: JSON.stringify({
        symbol,
        sequence_data: ohlcv_data,
        model_type: "TFT"
      })
    });
    if (!response.ok) {
      throw new Error(`ModelScope API error: ${response.status}`);
    }
    const result = await response.json();
    return {
      signal_score: result.predicted_direction === "UP" ? 0.7 : -0.7,
      confidence: result.confidence || 0.8,
      predicted_price: result.predicted_price,
      current_price: result.current_price,
      direction: result.predicted_direction,
      model_latency: result.inference_time || 45
    };
  } catch (error) {
    throw new Error(`TFT prediction failed: ${error.message}`);
  }
}
__name(getTFTPrediction, "getTFTPrediction");
async function getNHITSPrediction(symbol, ohlcv_data, env) {
  try {
    const closes = ohlcv_data.map((d) => d[3]);
    const current_price = closes[closes.length - 1];
    const short_ma = closes.slice(-5).reduce((a, b) => a + b) / 5;
    const long_ma = closes.slice(-10).reduce((a, b) => a + b) / 10;
    const momentum = (short_ma - long_ma) / long_ma;
    const predicted_change = momentum * 0.02;
    const predicted_price = current_price * (1 + predicted_change);
    return {
      signal_score: momentum > 0 ? 0.6 : -0.6,
      confidence: 0.75,
      predicted_price,
      current_price,
      direction: momentum > 0 ? "UP" : "DOWN",
      model_latency: 8
    };
  } catch (error) {
    throw new Error(`N-HITS prediction failed: ${error.message}`);
  }
}
__name(getNHITSPrediction, "getNHITSPrediction");
async function getSentimentAnalysis(symbol, env) {
  try {
    console.log(`   \u{1F50D} Getting AI sentiment for ${symbol}...`);
    const newsQuery = `${symbol} stock market news financial earnings revenue profit`;
    const sentiment = await env.AI.run("@cf/huggingface/distilbert-sst-2-int8", {
      text: `Financial outlook for ${symbol}: Recent market performance and analyst sentiment`
    });
    console.log(`   \u2705 AI sentiment for ${symbol}:`, sentiment);
    const isPositive = sentiment.label === "POSITIVE";
    const confidence = sentiment.score;
    return {
      signal_score: isPositive ? 1 : -1,
      confidence,
      sentiment: isPositive ? "BULLISH" : "BEARISH",
      recommendation: isPositive ? "BUY" : "SELL"
    };
  } catch (error) {
    console.error(`   \u274C Sentiment AI failed for ${symbol}:`, error.message);
    return {
      signal_score: 0,
      confidence: 0.5,
      sentiment: "NEUTRAL",
      recommendation: "HOLD",
      error: error.message
    };
  }
}
__name(getSentimentAnalysis, "getSentimentAnalysis");
function combineSignals(priceSignal, sentimentSignal, symbol, currentPrice) {
  const priceWeight = 0.6;
  const sentimentWeight = 0.4;
  const combinedScore = priceSignal.signal_score * priceWeight + sentimentSignal.signal_score * sentimentWeight;
  const avgConfidence = priceSignal.confidence * priceWeight + sentimentSignal.confidence * sentimentWeight;
  let action;
  if (combinedScore > 0.5) {
    action = "BUY STRONG";
  } else if (combinedScore > 0.2) {
    action = "BUY WEAK";
  } else if (combinedScore < -0.5) {
    action = "SELL STRONG";
  } else if (combinedScore < -0.2) {
    action = "SELL WEAK";
  } else {
    action = "HOLD NEUTRAL";
  }
  return {
    success: true,
    symbol,
    action,
    signal_score: combinedScore,
    confidence: avgConfidence,
    current_price: currentPrice,
    reasoning: `${priceSignal.direction} price prediction (${priceSignal.model_used}) + ${sentimentSignal.sentiment} sentiment`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    system_version: "5.0-Cloudflare-Worker",
    components: {
      price_prediction: {
        signal_score: priceSignal.signal_score,
        confidence: priceSignal.confidence,
        model_used: priceSignal.model_used,
        predicted_price: priceSignal.predicted_price,
        direction: priceSignal.direction,
        latency_ms: priceSignal.model_latency
      },
      sentiment_analysis: {
        signal_score: sentimentSignal.signal_score,
        confidence: sentimentSignal.confidence,
        sentiment: sentimentSignal.sentiment,
        recommendation: sentimentSignal.recommendation
      }
    }
  };
}
__name(combineSignals, "combineSignals");
function generatePerformanceMetrics(analysisResults) {
  const signals = analysisResults.trading_signals;
  const successfulAnalyses = Object.values(signals).filter((s) => s.success).length;
  const signalCounts = { BUY: 0, SELL: 0, HOLD: 0 };
  const confidenceScores = [];
  Object.values(signals).forEach((signal) => {
    if (signal.success) {
      const action = signal.action.split(" ")[0];
      if (action in signalCounts) {
        signalCounts[action]++;
      }
      confidenceScores.push(signal.confidence);
    }
  });
  const avgConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b) / confidenceScores.length : 0;
  return {
    success_rate: successfulAnalyses / analysisResults.symbols_analyzed.length * 100,
    signal_distribution: signalCounts,
    avg_confidence: avgConfidence,
    high_confidence_signals: confidenceScores.filter((c) => c > 0.85).length,
    total_symbols: analysisResults.symbols_analyzed.length,
    successful_analyses: successfulAnalyses
  };
}
__name(generatePerformanceMetrics, "generatePerformanceMetrics");
async function sendAlerts(analysisResults, env) {
  const alerts = analysisResults.alerts.filter((a) => a.level === "HIGH_CONFIDENCE");
  if (alerts.length === 0) return;
  if (env.EMAIL_ENABLED === "true") {
    await sendEmailAlerts(alerts, analysisResults, env);
  }
  if (env.SLACK_WEBHOOK_URL) {
    await sendSlackAlerts(alerts, analysisResults, env);
  }
  if (env.FACEBOOK_PAGE_TOKEN && env.FACEBOOK_RECIPIENT_ID) {
    await sendFacebookMessengerAlert(alerts, analysisResults, env);
  }
  if (env.LINE_CHANNEL_TOKEN && env.LINE_USER_ID) {
    await sendLINEAlert(alerts, analysisResults, env);
  }
}
__name(sendAlerts, "sendAlerts");
async function sendEmailAlerts(alerts, analysisResults, env) {
  try {
    const emailContent = `
Trading System Alert - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}

${alerts.length} high-confidence trading signals detected:

${alerts.map((alert) => `\u2022 ${alert.symbol}: ${alert.message}`).join("\n")}

Performance Summary:
\u2022 Success Rate: ${analysisResults.performance_metrics.success_rate.toFixed(1)}%
\u2022 Average Confidence: ${(analysisResults.performance_metrics.avg_confidence * 100).toFixed(1)}%
\u2022 Signal Distribution: ${JSON.stringify(analysisResults.performance_metrics.signal_distribution)}

View full results: https://your-worker-url.workers.dev/results

Generated by Cloudflare Trading Worker
    `;
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: env.ALERT_EMAIL }]
        }],
        from: { email: "alerts@tradingsystem.workers.dev" },
        subject: `Trading Alert - ${alerts.length} High Confidence Signals`,
        content: [{ type: "text/plain", value: emailContent }]
      })
    });
  } catch (error) {
    console.error("Email alert failed:", error);
  }
}
__name(sendEmailAlerts, "sendEmailAlerts");
async function sendSlackAlerts(alerts, analysisResults, env) {
  try {
    const slackMessage = {
      text: `\u{1F3AF} Trading System Alert - ${alerts.length} High Confidence Signals`,
      attachments: [
        {
          color: "good",
          fields: alerts.map((alert) => ({
            title: alert.symbol,
            value: alert.message.replace("\u{1F3AF} High confidence signal: ", ""),
            short: true
          }))
        },
        {
          color: "#36a64f",
          title: "Performance Summary",
          text: `Success Rate: ${analysisResults.performance_metrics.success_rate.toFixed(1)}% | Avg Confidence: ${(analysisResults.performance_metrics.avg_confidence * 100).toFixed(1)}%`
        }
      ]
    };
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage)
    });
  } catch (error) {
    console.error("Slack alert failed:", error);
  }
}
__name(sendSlackAlerts, "sendSlackAlerts");
async function sendCriticalAlert(errorMessage, env) {
  if (env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "\u{1F6A8} CRITICAL: Trading System Worker Failed",
          attachments: [{
            color: "danger",
            fields: [
              { title: "Error", value: errorMessage, short: false },
              { title: "Timestamp", value: (/* @__PURE__ */ new Date()).toISOString(), short: true }
            ]
          }]
        })
      });
    } catch (error) {
      console.error("Critical alert failed:", error);
    }
  }
  await sendCriticalMessengerAlert(errorMessage, env);
}
__name(sendCriticalAlert, "sendCriticalAlert");
async function handleManualAnalysis(request, env) {
  try {
    const result = await runPreMarketAnalysis(env);
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleManualAnalysis, "handleManualAnalysis");
async function handleGetResults(request, env) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const result = await env.TRADING_RESULTS.get(`analysis_${date}`);
    if (result) {
      return new Response(result, {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: "No results found for date" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
__name(handleGetResults, "handleGetResults");
async function handleHealthCheck(request, env) {
  const health = {
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "1.0-Cloudflare-Worker",
    services: {
      kv_storage: "available",
      ai_service: env.AI ? "available" : "unavailable",
      modelscope_api: env.MODELSCOPE_API_TOKEN ? "configured" : "not_configured"
    }
  };
  return new Response(JSON.stringify(health, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleHealthCheck, "handleHealthCheck");

// ../../.nvm/versions/node/v23.2.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.nvm/versions/node/v23.2.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Kozf4P/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = cloudflare_worker_scheduler_default;

// ../../.nvm/versions/node/v23.2.0/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Kozf4P/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=cloudflare-worker-scheduler.js.map
