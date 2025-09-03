# Cloudflare Worker Deployment Guide - TFT Trading System

## Overview

Complete deployment guide for running automated TFT+N-HITS trading analysis on Cloudflare Workers. This solves the local machine dependency issue by running analysis in the cloud with scheduled triggers.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Cloudflare      │    │ ModelScope API   │    │ Yahoo Finance   │
│ Worker          │───▶│ (TFT+N-HITS)     │    │ (Market Data)   │
│ (Scheduler)     │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Cloudflare KV   │    │ Email/Slack      │    │ Local Client    │
│ (Results Store) │    │ (Alerts)         │    │ (Sync Results)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Deployment Steps

### 1. Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

### 2. Create KV Namespace

```bash
# Create KV namespace for storing analysis results
wrangler kv:namespace create "TRADING_RESULTS"

# Create preview namespace for development
wrangler kv:namespace create "TRADING_RESULTS" --preview

# Note the namespace IDs returned - update wrangler.toml
```

### 3. Configure Environment Variables

Set required secrets in Cloudflare:

```bash
# Required secrets
wrangler secret put MODELSCOPE_API_TOKEN
# Enter your ModelScope API token

wrangler secret put CLOUDFLARE_ACCOUNT_ID
# Enter your Cloudflare account ID

wrangler secret put CLOUDFLARE_API_TOKEN  
# Enter your Cloudflare API token

# Optional alert secrets
wrangler secret put SLACK_WEBHOOK_URL
# Enter Slack webhook URL for alerts

wrangler secret put ALERT_EMAIL
# Enter email for trading alerts
```

### 4. Update Configuration

Edit `wrangler.toml`:

```toml
# Update KV namespace IDs from step 2
[[kv_namespaces]]
binding = "TRADING_RESULTS"
id = "your-actual-kv-namespace-id"           # Replace this
preview_id = "your-actual-preview-namespace-id"  # Replace this

# Optional: Add custom domain
[routes]
pattern = "trading-api.yourdomain.com/*"     # Replace with your domain
zone_name = "yourdomain.com"                 # Replace with your domain
```

### 5. Deploy Worker

```bash
# Deploy to development environment
wrangler deploy --env development

# Test deployment
curl https://tft-trading-system-dev.your-subdomain.workers.dev/health

# Deploy to production
wrangler deploy --env production
```

### 6. Verify Scheduled Triggers

```bash
# Check cron triggers are active
wrangler cron trigger

# View deployment logs
wrangler tail

# Test manual analysis
curl -X POST https://your-worker-url.workers.dev/analyze
```

## Usage

### Scheduled Analysis (Automatic)

The worker automatically runs analysis at:
- 6:30 AM EST (11:30 UTC)
- 7:00 AM EST (12:00 UTC) 
- 7:30 AM EST (12:30 UTC)
- 8:00 AM EST (13:00 UTC)
- 8:30 AM EST (13:30 UTC)
- 9:00 AM EST (14:00 UTC)

**Monday through Friday only** during pre-market hours.

### API Endpoints

#### 1. Health Check
```bash
curl https://your-worker-url.workers.dev/health
```

#### 2. Manual Analysis
```bash
curl -X POST https://your-worker-url.workers.dev/analyze
```

#### 3. Get Results
```bash
# Get today's results
curl https://your-worker-url.workers.dev/results

# Get specific date results  
curl "https://your-worker-url.workers.dev/results?date=2025-01-15"
```

### Local Client Integration

Use the Python client when your machine comes online:

```python
from cloudflare_worker_local_client import CloudflareWorkerClient

# Initialize client
client = CloudflareWorkerClient("https://your-worker-url.workers.dev")

# Get latest results
results = client.get_latest_analysis()

# Monitor for new results
client.monitor_daily_results()

# Sync with paper trading
client.sync_with_paper_trading(paper_tracker)
```

## Result Format

Analysis results stored in Cloudflare KV:

```json
{
  "run_id": "worker_2025_01_15T12_00_00_000Z",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "symbols_analyzed": ["AAPL", "TSLA", "MSFT", "GOOGL", "NVDA"],
  "trading_signals": {
    "AAPL": {
      "success": true,
      "action": "BUY STRONG",
      "confidence": 0.87,
      "signal_score": 0.64,
      "current_price": 229.72,
      "reasoning": "UP price prediction (TFT-Primary) + BULLISH sentiment",
      "components": {
        "price_prediction": {
          "model_used": "TFT-Primary",
          "predicted_price": 232.15,
          "direction": "UP",
          "confidence": 0.85,
          "latency_ms": 45
        },
        "sentiment_analysis": {
          "sentiment": "BULLISH",
          "confidence": 0.90,
          "recommendation": "BUY"
        }
      }
    }
  },
  "alerts": [
    {
      "level": "HIGH_CONFIDENCE",
      "symbol": "AAPL",
      "message": "🎯 High confidence signal: AAPL - BUY STRONG (87.0%)",
      "timestamp": "2025-01-15T12:00:00.000Z"
    }
  ],
  "performance_metrics": {
    "success_rate": 100.0,
    "avg_confidence": 0.82,
    "signal_distribution": {"BUY": 3, "SELL": 1, "HOLD": 1}
  }
}
```

## Monitoring and Alerts

### Alert Configuration

Alerts are sent when:
1. **High Confidence Signals**: Confidence > 85% with BUY/SELL action
2. **System Failures**: Worker execution errors
3. **API Failures**: ModelScope or data source failures

### Alert Channels

#### Email Alerts (via MailChannels)
- Automatic sending via Cloudflare Worker
- No SMTP configuration required
- Set `ALERT_EMAIL` secret for recipient

#### Slack Alerts
- Configure `SLACK_WEBHOOK_URL` secret
- Rich formatting with signal details
- Color-coded by alert level

### Monitoring Dashboard

Check worker performance:

```bash
# View recent logs
wrangler tail

# Check KV storage usage
wrangler kv:key list --namespace-id=your-namespace-id

# View cron trigger history
wrangler cron trigger --show-history
```

## Troubleshooting

### Common Issues

#### 1. "KV namespace not found"
```bash
# Verify namespace binding in wrangler.toml
wrangler kv:namespace list

# Update namespace IDs in wrangler.toml
```

#### 2. "ModelScope API token invalid"
```bash
# Update secret
wrangler secret put MODELSCOPE_API_TOKEN

# Test with manual analysis
curl -X POST https://your-worker-url.workers.dev/analyze
```

#### 3. "Cron triggers not firing"
```bash
# Check trigger configuration
wrangler cron trigger

# Verify timezone settings (EST = UTC-5)
# 6:30 AM EST = 11:30 UTC
```

#### 4. "Worker execution timeout"
```bash
# Check CPU limits in wrangler.toml
[limits]
cpu_ms = 30000  # Increase if needed

# Optimize analysis logic
# Consider breaking into smaller chunks
```

### Debug Commands

```bash
# View worker logs in real-time
wrangler tail --format=pretty

# Test specific functions
wrangler dev  # Local development mode

# Check KV data
wrangler kv:key list --namespace-id=your-namespace-id
wrangler kv:key get "analysis_2025-01-15" --namespace-id=your-namespace-id
```

## Cost Estimation

### Cloudflare Worker Costs

**Free Tier Limits:**
- 100,000 requests/day
- 1,000 cron triggers/month  
- 10ms CPU time per execution

**Paid Tier ($5/month):**
- 10 million requests/month
- Unlimited cron triggers
- 50ms CPU time per execution

### Expected Usage

**Daily Usage:**
- 6 cron triggers/day (every 30min pre-market)
- 5 symbols × 6 runs = 30 analyses/day
- ~10ms CPU per analysis = 300ms total daily

**Monthly Usage:**
- ~120 cron triggers (20 trading days × 6)
- ~600 analyses (20 trading days × 30)
- Well within free tier limits

**Projected Cost: $0/month** (free tier sufficient)

## Production Checklist

### Pre-Deployment
- [ ] Update KV namespace IDs in `wrangler.toml`
- [ ] Set all required secrets
- [ ] Configure custom domain (optional)
- [ ] Test manual analysis endpoint
- [ ] Verify cron trigger schedule

### Post-Deployment
- [ ] Monitor first scheduled run
- [ ] Verify KV storage working
- [ ] Test alert systems (email/Slack)
- [ ] Configure local client
- [ ] Set up paper trading sync

### Ongoing Monitoring
- [ ] Daily result verification
- [ ] Weekly performance review
- [ ] Monthly cost analysis
- [ ] Alert system testing

## Security Considerations

### API Security
- ModelScope API token stored as Worker secret
- No sensitive data in Worker source code
- KV data automatically encrypted at rest

### Access Control
- Optional custom domain for API access
- Rate limiting via Cloudflare's built-in protection
- HTTPS-only communication

### Data Privacy
- Analysis results stored in Cloudflare KV (your account)
- No personal/financial data transmitted
- 24-hour TTL on stored results

## Support and Maintenance

### Regular Updates
```bash
# Update Worker code
git pull origin main
wrangler deploy --env production

# Rotate API tokens
wrangler secret put MODELSCOPE_API_TOKEN

# Clear old KV data
wrangler kv:key delete "analysis_old_date" --namespace-id=your-namespace-id
```

### Performance Optimization
- Monitor CPU usage via `wrangler tail`
- Optimize analysis logic if approaching limits
- Consider caching frequent API calls

---

**Your TFT trading system is now fully automated and cloud-native!** 🚀

The system will run analysis every 30 minutes during pre-market hours without any local machine dependency. Results are stored in Cloudflare KV and can be retrieved by your local client when you come online.