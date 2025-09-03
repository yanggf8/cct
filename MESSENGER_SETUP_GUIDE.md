# Facebook Messenger & LINE Setup Guide - Trading Alerts

## Overview

Setup guide for receiving TFT trading alerts via Facebook Messenger and LINE (Taiwan). Both platforms offer rich messaging capabilities perfect for real-time trading notifications.

## Facebook Messenger Setup

### Step 1: Create Facebook Page (Business Account)

1. **Go to Facebook Business**: https://business.facebook.com/
2. **Create Page**: 
   - Page type: "Business"
   - Category: "Financial Service" 
   - Page name: "Trading Alerts Bot" (or any name)
3. **Complete basic setup** (description, profile picture)

### Step 2: Create Facebook App

1. **Facebook Developers**: https://developers.facebook.com/
2. **Create App**:
   - App type: "Business"
   - App name: "TFT Trading System"
   - Contact email: your email
3. **Add Messenger Product**:
   - Go to "Add Products" → Select "Messenger"

### Step 3: Generate Page Access Token

1. **In Messenger Settings**:
   - Select your Facebook page
   - Click "Generate Token"
   - **Save this token** → This is your `FACEBOOK_PAGE_TOKEN`

### Step 4: Get Your Recipient ID

**Method 1: Using Graph API Explorer**

1. Go to: https://developers.facebook.com/tools/explorer/
2. Select your app and page
3. Make GET request to: `me/conversations`
4. Find conversation with yourself → copy the user ID

**Method 2: Send test message first**

```bash
# Send yourself a message via your page, then use webhook to capture ID
# Or use this simple method:
curl -X POST "https://graph.facebook.com/v18.0/me/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAGE_TOKEN" \
  -d '{
    "recipient": {"id": "YOUR_FACEBOOK_USER_ID"},
    "message": {"text": "Test message"}
  }'
```

### Step 5: Configure Cloudflare Secrets

```bash
# Set Facebook secrets in Cloudflare Worker
wrangler secret put FACEBOOK_PAGE_TOKEN
# Enter your page access token

wrangler secret put FACEBOOK_RECIPIENT_ID  
# Enter your Facebook user ID
```

### Facebook Message Features

✅ **Rich Cards**: Stock logo, price, confidence  
✅ **Action Buttons**: "View Chart", "Get Analysis"  
✅ **Multiple Alerts**: Up to 3 detailed signal cards  
✅ **Quick Updates**: Instant delivery via Facebook infrastructure

---

## LINE (Taiwan) Setup

### Step 1: Create LINE Developers Account

1. **LINE Developers Console**: https://developers.line.biz/
2. **Login with LINE account** (create if needed)
3. **Create Provider**:
   - Provider name: "TFT Trading System"
   - Select "Individual developer"

### Step 2: Create Messaging API Channel

1. **Create Channel**:
   - Product: "Messaging API"
   - Channel name: "Trading Alerts"
   - Channel description: "TFT trading system alerts"
   - Category: "Finance"
   - Subcategory: "Investment/Securities"

2. **Channel Settings**:
   - Use webhooks: **Disabled** (we only send, don't receive)
   - Auto-reply messages: **Disabled**
   - Greeting messages: **Disabled**

### Step 3: Get Channel Access Token

1. **In Channel Settings**:
   - Go to "Basic settings" tab
   - Copy "Channel ID" (for reference)
   - Go to "Messaging API" tab
   - **Issue Channel Access Token**
   - **Save this token** → This is your `LINE_CHANNEL_TOKEN`

### Step 4: Get Your LINE User ID

**Method 1: LINE Official Account Manager**

1. Add your bot as friend using QR code from console
2. Send any message to your bot
3. Check webhook logs for user ID

**Method 2: Use LINE Bot SDK (recommended)**

```javascript
// Simple HTML page to get your User ID
<script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
<script>
async function getUserId() {
  await liff.init({ liffId: 'YOUR_LIFF_ID' });
  const profile = await liff.getProfile();
  console.log('User ID:', profile.userId);
}
getUserId();
</script>
```

**Method 3: Manual QR Code**

1. **Add bot as friend** via QR code in console
2. **Send test message** from your personal LINE to the bot
3. **Check logs** in LINE console for user ID

### Step 5: Configure Cloudflare Secrets

```bash
# Set LINE secrets in Cloudflare Worker  
wrangler secret put LINE_CHANNEL_TOKEN
# Enter your channel access token

wrangler secret put LINE_USER_ID
# Enter your LINE user ID
```

### LINE Message Features

✅ **Flex Messages**: Rich carousel with Taiwan localization  
✅ **Company Logos**: Stock symbols with company branding  
✅ **Traditional Chinese**: 繁體中文 support for Taiwan users  
✅ **Stickers**: Celebratory stickers for strong signals  
✅ **Chart Integration**: Direct links to Yahoo Finance Taiwan

---

## Testing Setup

### Test Facebook Messenger

```bash
# Manual test via curl
curl -X POST "https://graph.facebook.com/v18.0/me/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PAGE_TOKEN" \
  -d '{
    "recipient": {"id": "YOUR_USER_ID"},
    "message": {"text": "🎯 Test: AAPL BUY signal at $229.72 (87% confidence)"}
  }'
```

### Test LINE

```bash
# Manual test via curl
curl -X POST "https://api.line.me/v2/bot/message/push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CHANNEL_TOKEN" \
  -d '{
    "to": "YOUR_USER_ID",
    "messages": [
      {
        "type": "text", 
        "text": "🎯 測試：AAPL 買入信號 $229.72 (87% 信心度)"
      }
    ]
  }'
```

### Test via Cloudflare Worker

```bash
# Trigger manual analysis to test alerts
curl -X POST https://your-worker-url.workers.dev/analyze
```

---

## Message Examples

### Facebook Messenger Alert

```
🎯 Trading Alert - 2 High Confidence Signals

📈 AAPL: BUY STRONG
   💰 Price: $229.72
   🎯 Confidence: 87.0%
   💡 UP price prediction (TFT-Primary) + BULLISH sentiment

📈 TSLA: SELL WEAK
   💰 Price: $329.36
   🎯 Confidence: 72.0%
   💡 DOWN price prediction (N-HITS-Backup) + BEARISH sentiment

📊 Performance:
✅ Success Rate: 100.0%
📈 Avg Confidence: 82.0%
📋 Signals: {"BUY": 3, "SELL": 1, "HOLD": 1}
```

### LINE Alert (Traditional Chinese)

Rich Flex Message carousel with:
- **Summary bubble**: 交易分析摘要 with performance metrics
- **Signal bubbles**: Individual stock cards with:
  - Company logo
  - Stock symbol (AAPL, TSLA, etc.)
  - Action in Chinese (買入強勢, 賣出弱勢, 持有中性)
  - Price and confidence
  - "查看圖表" button linking to Yahoo Finance Taiwan

---

## Security & Privacy

### Facebook Messenger
- **Page tokens** are scoped to your business page only
- **User ID** is page-scoped (different per page)
- **Messages encrypted** in transit via HTTPS
- **No personal data** stored beyond trading signals

### LINE
- **Channel tokens** are scoped to your bot channel only  
- **User ID** is bot-specific (unique per channel)
- **Messages encrypted** in transit via HTTPS
- **Taiwan servers** for LINE Taiwan users

### Data Handling
- **No sensitive data** stored in messages
- **Only trading signals** sent (symbol, action, confidence)
- **No financial account** information transmitted
- **Messages auto-expire** after 30 days on platforms

---

## Troubleshooting

### Facebook Issues

#### "Invalid Page Access Token"
```bash
# Regenerate token in Facebook Developers Console
# Update Cloudflare secret
wrangler secret put FACEBOOK_PAGE_TOKEN
```

#### "User ID not found"
```bash
# Verify you've messaged the page from your personal account first
# Check Facebook Graph API Explorer with correct permissions
```

#### "App not approved for sending messages"
```bash
# For personal use, no approval needed
# Ensure you're messaging from the same account that owns the page
```

### LINE Issues

#### "Invalid Channel Access Token" 
```bash
# Regenerate token in LINE Developers Console
# Update Cloudflare secret
wrangler secret put LINE_CHANNEL_TOKEN
```

#### "User ID not found"
```bash
# Add your bot as friend first via QR code
# Send a message to bot to establish conversation
# Check webhook logs for actual user ID
```

#### "Message not delivered"
```bash
# Check if bot is still friend (not blocked)
# Verify user ID is correct
# Check LINE console for error logs
```

### General Debug Steps

```bash
# Check Cloudflare Worker logs
wrangler tail

# Test health endpoint
curl https://your-worker-url.workers.dev/health

# Verify secrets are set
wrangler secret list

# Test manual analysis
curl -X POST https://your-worker-url.workers.dev/analyze
```

---

## Cost Analysis

### Facebook Messenger
- **API calls**: Free up to rate limits
- **Message delivery**: Free for bot-to-user messages
- **Expected monthly cost**: $0

### LINE
- **API calls**: Free tier (1,000 messages/month)
- **Additional messages**: ~$0.003 per message
- **Expected monthly cost**: $0-5 (well within free tier)

### Total Messenger Cost
- **Combined platforms**: $0-5/month
- **Free tier sufficient** for personal trading alerts
- **High reliability** with dual-platform redundancy

---

## Advanced Features

### Rich Message Types

**Facebook Messenger**:
- Generic templates with images and buttons
- Quick reply buttons for interaction
- Persistent menu for common actions
- Typing indicators and read receipts

**LINE**:
- Flex Messages with custom layouts
- Rich menus with Taiwan financial services integration
- Location sharing for Taiwan stock market hours
- Stickers and emojis for engagement

### Multi-Language Support

The system supports:
- **English**: Facebook Messenger (international)
- **繁體中文**: LINE Taiwan (Traditional Chinese)
- **Mixed**: Technical terms in English, interface in local language

---

## Production Deployment

### Final Configuration

```bash
# Deploy updated worker with messenger support
wrangler deploy --env production

# Verify all secrets are set
wrangler secret list

# Test both platforms
curl -X POST https://your-worker-url.workers.dev/analyze
```

### Monitoring

```bash
# Monitor message delivery
wrangler tail --format=pretty

# Check alert frequency
# Facebook: Business Manager → Insights
# LINE: Official Account Manager → Analytics
```

---

**Your trading alerts are now delivered instantly via Facebook Messenger and LINE!** 📱🎯

You'll receive rich, formatted notifications with:
- 🏢 Company logos and branding
- 💰 Current prices and confidence levels  
- 📈 Action buttons to view charts
- 🎯 Taiwan-localized experience on LINE
- 🚀 Instant delivery during pre-market analysis

Perfect for staying connected to your automated trading system from anywhere! 📊✨