# TFT Trading System - API Documentation

## Overview

Production-Ready Enterprise Trading System with real market data integration, comprehensive rate limiting, intelligent caching, and 4-tier reporting workflow.

**Architecture**: Enterprise-grade modular system with Yahoo Finance integration, rate limiting (20 req/min), market data caching (5-min TTL), and comprehensive validation.

**Base URL**: `https://tft-trading-system.yanggf.workers.dev`

## Core 4-Report Analysis System

### Pre-Market Briefing
**Endpoint**: `GET /pre-market-briefing`

**Description**: Morning high-confidence signals (≥70%) with symbol-specific analysis and market preparation insights.

**Features**:
- High-confidence signal filtering (≥70% threshold)
- Symbol-specific analysis with confidence scoring
- Top 3 actionable ups/downs recommendations
- Interactive confidence visualizations
- Market sentiment distribution

**Response**: HTML page with comprehensive pre-market analysis

**Example**:
```bash
curl https://tft-trading-system.yanggf.workers.dev/pre-market-briefing
```

---

### Intraday Performance Check
**Endpoint**: `GET /intraday-check`

**Description**: Real-time tracking of morning high-confidence predictions with performance monitoring.

**Features**:
- Live monitoring of morning predictions
- Signal divergence identification and analysis
- Model health status with recalibration alerts
- Performance metrics tracking
- Correct/wrong call analysis

**Response**: HTML page with real-time performance dashboard

**Example**:
```bash
curl https://tft-trading-system.yanggf.workers.dev/intraday-check
```

---

### End-of-Day Summary
**Endpoint**: `GET /end-of-day-summary`

**Description**: Market close analysis with high-confidence signal performance review and tomorrow's outlook.

**Features**:
- Comprehensive performance review of high-confidence signals
- Signal accuracy breakdown (predicted vs actual)
- Top performers analysis with confidence correlation
- Tomorrow's market bias and key focus areas
- Market insights and volatility patterns

**Response**: HTML page with end-of-day comprehensive analysis

**Example**:
```bash
curl https://tft-trading-system.yanggf.workers.dev/end-of-day-summary
```

---

### Weekly Review
**Endpoint**: `GET /weekly-review`

**Description**: Comprehensive high-confidence signal accuracy patterns with optimization recommendations.

**Features**:
- Pattern analysis across weekly high-confidence signals
- Model reliability and consistency metrics
- Daily accuracy trends with Chart.js visualizations
- Symbol performance rankings and insights
- Data-driven optimization recommendations

**Response**: HTML page with comprehensive weekly analysis

**Example**:
```bash
curl https://tft-trading-system.yanggf.workers.dev/weekly-review
```

## Analysis & Data APIs

### Manual Analysis
**Endpoint**: `POST /analyze`

**Description**: On-demand comprehensive analysis execution with 3-layer sentiment processing.

**Authentication**: Requires `X-API-KEY` header

**Features**:
- GPT-OSS-120B + DistilBERT sentiment analysis
- High-confidence signal identification
- Real-time news processing (10-20 articles)
- Multi-layer consensus building

**Response**: JSON with comprehensive analysis results

**Example**:
```bash
curl -X POST -H "X-API-KEY: your_key" \
  https://tft-trading-system.yanggf.workers.dev/analyze
```

**Response Structure**:
```json
{
  "success": true,
  "analysis_timestamp": "2025-09-29T12:30:00Z",
  "symbols_analyzed": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "trading_signals": {
    "AAPL": {
      "primary_direction": "BULLISH",
      "overall_confidence": 0.78,
      "sentiment_layers": [...],
      "trading_signals": {...}
    }
  },
  "high_confidence_signals": [...],
  "execution_time": "28.5s"
}
```

---

### Symbol-Specific Analysis
**Endpoint**: `GET /analyze-symbol`

**Parameters**:
- `symbol` (required): Stock symbol to analyze (e.g., AAPL, MSFT)

**Authentication**: Requires `X-API-KEY` header

**Description**: Fine-grained per-symbol analysis with detailed confidence breakdown.

**Example**:
```bash
curl -H "X-API-KEY: your_key" \
  "https://tft-trading-system.yanggf.workers.dev/analyze-symbol?symbol=AAPL"
```

---

### Historical Data API
**Endpoint**: `GET /api/daily-summary`

**Parameters**:
- `date` (optional): Date in YYYY-MM-DD format. Defaults to today.

**Description**: Retrieve historical daily summary data with structured JSON response.

**Example**:
```bash
curl "https://tft-trading-system.yanggf.workers.dev/api/daily-summary?date=2025-09-29"
```

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "date": "2025-09-29",
    "summary": {
      "total_predictions": 5,
      "overall_accuracy": 73,
      "high_confidence_signals": 3
    },
    "symbol_breakdown": [...],
    "generated_at": "2025-09-29T16:05:00Z"
  }
}
```

---

### Weekly Data API
**Endpoint**: `GET /api/weekly-data`

**Parameters**:
- `week` (optional): Week identifier ("current" or date)
- `range` (optional): Number of days to include (default: 7)

**Description**: Weekly analysis data with trend information.

**Example**:
```bash
curl "https://tft-trading-system.yanggf.workers.dev/api/weekly-data?week=current&range=7"
```

## Health & Monitoring

### System Health
**Endpoint**: `GET /health`

**Description**: Basic system health check with component status.

**Response**:
```json
{
  "success": true,
  "status": "operational",
  "timestamp": "2025-09-29T12:00:00Z",
  "components": {
    "ai_models": "operational",
    "kv_storage": "operational",
    "cron_system": "operational"
  }
}
```

---

### Cron Health
**Endpoint**: `GET /cron-health`

**Description**: Detailed cron job execution status and scheduling health.

**Response**:
```json
{
  "success": true,
  "cron_status": "operational",
  "last_executions": {
    "morning": "2025-09-29T12:30:00Z",
    "midday": "2025-09-29T16:00:00Z",
    "daily": "2025-09-29T20:05:00Z"
  },
  "next_scheduled": {
    "morning": "2025-09-30T12:30:00Z"
  }
}
```

---

### Model Health
**Endpoint**: `GET /model-health`

**Description**: AI model accessibility and R2 storage health check.

**Response**:
```json
{
  "success": true,
  "models": {
    "gpt_oss_120b": "accessible",
    "distilbert": "accessible"
  },
  "r2_storage": "operational"
}
```

## Legacy Dashboards

### Daily Summary Dashboard
**Endpoint**: `GET /daily-summary`

**Description**: Interactive dashboard with 30-day historical data and Chart.js visualizations.

**Features**:
- 30-day historical data navigation
- Interactive Chart.js visualizations
- Mobile-responsive design
- Real-time KV integration

---

### Weekly Analysis Dashboard
**Endpoint**: `GET /weekly-analysis`

**Description**: Legacy weekly analysis dashboard with trend visualization.

**Features**:
- Multi-day performance tracking
- Accuracy validation tables
- Chart.js trend visualizations

---

### Fact Table
**Endpoint**: `GET /fact-table`

**Description**: Prediction accuracy validation table with historical performance.

## Testing & Development

### Facebook Integration Test
**Endpoint**: `POST /test-facebook`

**Authentication**: Requires `X-API-KEY` header

**Description**: Test Facebook Messenger integration with all 4 message types.

---

### Performance Testing
**Endpoint**: `GET /test-optimization`

**Description**: Comprehensive system performance validation.

---

### KPI Testing
**Endpoint**: `GET /test-kpi`

**Description**: Business metrics and KPI validation testing.

---

### Enhancement Status
**Endpoint**: `GET /enhancement-status`

**Description**: System capability overview and feature status.

## KV Pipeline Management

### Morning Predictions Generation
**Endpoint**: `POST /generate-morning-predictions`

**Description**: Manually generate morning predictions from existing analysis data.

**Features**:
- Checks for existing analysis data for today
- Generates high-confidence signals (≥70%) from analysis
- Stores predictions with KV verification and success logging
- Updates job status for dependency tracking

**Response**:
```json
{
  "success": true,
  "message": "Morning predictions generated and stored successfully",
  "predictions_stored": true,
  "signal_count": 3,
  "high_confidence_signals": 3,
  "average_confidence": 75.2
}
```

---

### KV Pipeline Status
**Endpoint**: `GET /status-management`

**Description**: Comprehensive status check for all KV pipeline jobs and data dependencies.

**Features**:
- Job status tracking for all pipeline components
- Data existence validation for daily keys
- Dependency validation between jobs
- Real-time pipeline health assessment

**Response**:
```json
{
  "success": true,
  "job_statuses": {
    "analysis": {"status": "done", "timestamp": "2025-09-29T12:30:00Z"},
    "morning_predictions": {"status": "done", "timestamp": "2025-09-29T12:35:00Z"},
    "pre_market_briefing": {"status": "pending"},
    "intraday_check": {"status": "pending"},
    "end_of_day_summary": {"status": "pending"}
  },
  "data_exists": {
    "analysis": true,
    "morning_predictions": true,
    "intraday_tracking": false,
    "eod_summary": false
  },
  "dependency_validation": {
    "pre_market_briefing": {"isValid": true},
    "intraday_check": {"isValid": true},
    "end_of_day_summary": {"isValid": false}
  }
}
```

---

### KV Verification Test
**Endpoint**: `GET /kv-verification-test`

**Description**: Comprehensive KV system verification with success logging and performance metrics.

**Features**:
- PUT operations with verification
- GET operations with retry logic
- Job status system testing
- Dependency validation testing
- Performance metrics and success rate calculation

**Response**:
```json
{
  "success": true,
  "test_operations": {
    "put_with_verification": {"success": true, "duration": 45},
    "get_with_retry": {"success": true, "duration": 12},
    "job_status_system": {"success": true, "duration": 23},
    "dependency_validation": {"success": true, "duration": 15},
    "cleanup": {"success": true}
  },
  "overall_metrics": {
    "total_operations": 5,
    "successful_operations": 5,
    "success_rate": "100%",
    "kv_system_healthy": true
  }
}
```

## Admin & Management

### Backfill Operations
**Endpoint**: `POST /admin/backfill-daily-summaries`

**Parameters**:
- `days` (optional): Number of days to backfill (default: 30, max: 365)
- `skipExisting` (optional): Skip existing records (default: true)

**Authentication**: Requires `X-API-KEY` header

**Description**: Historical data backfill operations.

---

### Verify Backfill
**Endpoint**: `GET /admin/verify-backfill`

**Parameters**:
- `days` (optional): Number of days to verify (default: 10, max: 100)

**Authentication**: Requires `X-API-KEY` header

**Description**: Verification of historical data coverage.

## Authentication

Most analysis endpoints require an API key:

```bash
curl -H "X-API-KEY: your_api_key" [endpoint]
```

Set your API key using Wrangler:
```bash
npx wrangler secret put WORKER_API_KEY
```

## Rate Limits

- **Analysis endpoints**: Rate limited to prevent abuse
- **Public dashboards**: No rate limiting
- **Health endpoints**: No rate limiting

## Error Responses

All endpoints return structured error responses:

```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2025-09-29T12:00:00Z",
  "request_id": "uuid-here"
}
```

## High-Confidence Signal Filtering

All analysis endpoints support high-confidence filtering:

- **Threshold**: ≥70% confidence
- **Purpose**: Focus on actionable signals
- **Application**: All 4 reports prioritize high-confidence signals

## Mobile Optimization

All HTML endpoints are mobile-optimized:

- Responsive design with proper viewport configuration
- Touch-friendly interfaces
- Optimized for both mobile and desktop viewing

## Performance Targets

- **HTML Load**: <200ms for dashboard pages
- **API Response**: <400ms for data endpoints
- **Analysis Time**: <30s for 5-symbol batch processing
- **Success Rate**: 100% completion with graceful fallbacks

---

## Future Roadmap

### 🔧 Database Migration (D1) - Phase 1
**Planned Enhancement**: Migration from KV to D1 database for manifest and status storage.

**Benefits**:
- **Strong Consistency**: Eliminate 60-second eventual consistency delays
- **Complex Queries**: Advanced filtering and aggregation capabilities
- **Structured Data**: Better organization of manifest and status information
- **Reliability**: ACID transactions for critical operations

**Migration Components**:
- **Manifest Storage**: Job manifests and pipeline status in D1 tables
- **Status Tracking**: Real-time status updates without consistency delays
- **Historical Analysis**: Queryable historical data with complex filtering
- **Dependency Management**: Relational integrity for job dependencies

### 🚀 Planned API Enhancements (Phase 2)

#### Sector Analysis Endpoints
- **`GET /api/sector-analysis`** - Real-time sector performance data
- **`GET /api/sector-rotation`** - Sector rotation detection and trends
- **`GET /api/sector-strength`** - Cross-sector correlation and rankings

#### Market Drivers Endpoints
- **`GET /api/market-drivers`** - Key market catalyst identification
- **`GET /api/earnings-impact`** - Earnings announcement impact analysis
- **`GET /api/macro-drivers`** - Fed policy and macroeconomic drivers
- **`GET /api/technical-drivers`** - Technical breakout and support/resistance

#### Enhanced Analysis Integration
- Sector classification in existing `/analyze` endpoint
- Market driver correlation in high-confidence signals
- Cross-sector analysis in `/weekly-review` dashboard
- Driver-based filtering in all report endpoints

## Support

For issues or questions:
- Check system health: `/health`
- Monitor cron status: `/cron-health`
- Review enhancement status: `/enhancement-status`

*This system is for research and educational purposes only. Not financial advice.*