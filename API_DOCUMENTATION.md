# API Documentation

## Overview

This document provides comprehensive API documentation for the Cloud Trading System, a production-ready enterprise-grade trading analysis platform featuring simplified dual AI comparison system, transparent agreement logic, TypeScript Data Access Layer with full type safety, platform-agnostic message tracking, enterprise-grade KV key management, and comprehensive 4-tier reporting capabilities.

**Deployment Version**: b0b04ca1-4f41-4c1a-9a98-1808e8ac7ff8 ✅ **VERIFIED OPERATIONAL**
**Architecture**: 100% TypeScript Core (13 modules) - Legacy JS Archived

## Authentication

All protected endpoints require API key authentication using the `X-API-KEY` header:

```bash
-H "X-API-KEY: your_api_key_here"
```

## Base URL

```
https://tft-trading-system.yanggf.workers.dev
```

## API Categories

### 1. Core 4-Report Analysis System

The system provides four comprehensive high-confidence analysis reports designed for the complete trading cycle.

#### Pre-Market Briefing
**Endpoint**: `GET /pre-market-briefing`
**Description**: Morning high-confidence signals (≥70% confidence threshold) with AI analysis
**Authentication**: Not required
**Response Format**: HTML dashboard

```bash
curl https://tft-trading-system.yanggf.workers.dev/pre-market-briefing
```

**Key Features**:
- High-confidence signal filtering (≥70% confidence)
- Dual AI agreement display with transparent model comparison
- Symbol-specific analysis with GPT-OSS-120B and DistilBERT-SST-2 insights
- Top 3 actionable recommendations based on model agreement
- Market sentiment distribution with agreement status indicators
- Interactive confidence visualizations with model comparison

#### Intraday Performance Check
**Endpoint**: `GET /intraday-check`
**Description**: Real-time tracking of morning predictions with divergence analysis
**Authentication**: Not required
**Response Format**: HTML dashboard

```bash
curl https://tft-trading-system.yanggf.workers.dev/intraday-check
```

**Key Features**:
- Live monitoring of morning predictions
- Signal divergence identification and analysis
- Model health status monitoring
- Performance metrics and accuracy tracking
- Real-time recalibration alerts

#### End-of-Day Summary
**Endpoint**: `GET /end-of-day-summary`
**Description**: Market close analysis with AI-powered tomorrow outlook
**Authentication**: Not required
**Response Format**: HTML dashboard

```bash
curl https://tft-trading-system.yanggf.workers.dev/end-of-day-summary
```

**Key Features**:
- Comprehensive market close performance review
- High-confidence signal accuracy breakdown
- Top performers and key insights analysis
- AI-powered tomorrow's market outlook
- Next-day focus areas and recommendations

#### Weekly Review
**Endpoint**: `GET /weekly-review`
**Description**: Comprehensive pattern analysis with optimization recommendations
**Authentication**: Not required
**Response Format**: HTML dashboard

```bash
curl https://tft-trading-system.yanggf.workers.dev/weekly-review
```

**Key Features**:
- Weekly high-confidence signal accuracy patterns
- Model reliability trends and consistency metrics
- Data-driven optimization recommendations
- Interactive Chart.js visualizations
- Performance trend analysis

### 2. Manual Analysis Endpoints

These endpoints allow for on-demand trading analysis using the dual AI system.

#### Full Analysis
**Endpoint**: `POST /analyze`
**Description**: Execute complete simplified dual AI analysis for all configured symbols
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/analyze
```

**Request Body**: None required
**Response Structure**:
```json
{
  "timestamp": "2025-09-29T12:00:00.000Z",
  "symbols_analyzed": ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"],
  "execution_time_ms": 28470,
  "models_used": {
    "gpt-oss-120b": "Primary contextual analysis",
    "distilbert-sst-2": "Secondary sentiment classification"
  },
  "results": {
    "AAPL": {
      "signal": "STRONG_BUY",
      "confidence": 0.85,
      "agreement_type": "full_agreement",
      "models": {
        "gpt": {
          "direction": "bullish",
          "confidence": 0.85,
          "reasoning": "Strong earnings report and positive market sentiment"
        },
        "distilbert": {
          "direction": "bullish",
          "confidence": 0.78,
          "sentiment_breakdown": {
            "bullish": 7,
            "bearish": 2,
            "neutral": 1
          }
        }
      }
    }
  }
}
```

#### Symbol-Specific Analysis
**Endpoint**: `GET /analyze-symbol?symbol={SYMBOL}`
**Description**: Perform detailed simplified dual AI analysis for a specific symbol
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" "https://tft-trading-system.yanggf.workers.dev/analyze-symbol?symbol=AAPL"
```

**Query Parameters**:
- `symbol` (required): Stock symbol (e.g., AAPL, MSFT, GOOGL)

**Response Structure**:
```json
{
  "symbol": "AAPL",
  "timestamp": "2025-09-29T12:00:00.000Z",
  "execution_time_ms": 2847,
  "analysis_type": "simplified_dual_ai_comparison",
  "models": {
    "gpt": {
      "model": "gpt-oss-120b",
      "direction": "bullish",
      "confidence": 0.85,
      "reasoning": "Strong earnings report and positive market sentiment",
      "articles_analyzed": 8,
      "analysis_type": "contextual_analysis"
    },
    "distilbert": {
      "model": "distilbert-sst-2-int8",
      "direction": "bullish",
      "confidence": 0.78,
      "articles_analyzed": 10,
      "sentiment_breakdown": {
        "bullish": 7,
        "bearish": 2,
        "neutral": 1
      },
      "analysis_type": "sentiment_classification"
    }
  },
  "comparison": {
    "agree": true,
    "agreement_type": "full_agreement",
    "details": {
      "match_direction": "bullish",
      "confidence_spread": 0.07
    }
  },
  "signal": {
    "type": "AGREEMENT",
    "direction": "bullish",
    "strength": "STRONG",
    "reasoning": "Both AI models agree on bullish sentiment",
    "action": "STRONG_BUY"
  }
}
```

### 3. System Health and Monitoring

#### System Health
**Endpoint**: `GET /health`
**Description**: Basic system health check
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/health
```

**Response Structure**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-29T12:00:00.000Z",
  "uptime_ms": 86400000,
  "version": "2025-09-29",
  "components": {
    "ai_models": "operational",
    "market_data": "operational",
    "kv_storage": "operational",
    "facebook_messaging": "operational"
  }
}
```

#### Enhanced System Health
**Endpoint**: `GET /health-optimized`
**Description**: Comprehensive system health with detailed component status
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/health-optimized
```

#### Cron Health
**Endpoint**: `GET /cron-health`
**Description**: Cron job system health and execution status
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/cron-health
```

**Response Structure**:
```json
{
  "cron_status": "operational",
  "last_execution": "2025-09-29T08:30:00.000Z",
  "next_execution": "2025-09-29T12:00:00.000Z",
  "scheduled_jobs": [
    {
      "name": "morning_analysis",
      "schedule": "0 30 8 * * 1-5",
      "status": "active",
      "last_run": "2025-09-29T08:30:00.000Z"
    },
    {
      "name": "midday_check",
      "schedule": "0 0 12 * * 1-5",
      "status": "active",
      "last_run": "2025-09-29T12:00:00.000Z"
    }
  ]
}
```

#### Model Health
**Endpoint**: `GET /model-health`
**Description**: AI model performance and availability status
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/model-health
```

### 4. Data Access APIs

#### Historical Daily Summary
**Endpoint**: `GET /api/daily-summary?date={YYYY-MM-DD}`
**Description**: Retrieve historical daily summary data
**Authentication**: Not required
**Response Format**: JSON

```bash
curl "https://tft-trading-system.yanggf.workers.dev/api/daily-summary?date=2025-09-29"
```

**Query Parameters**:
- `date` (required): Date in YYYY-MM-DD format

#### Weekly Data
**Endpoint**: `GET /api/weekly-data?week={week_type}&range={days}`
**Description**: Retrieve weekly analysis data
**Authentication**: Not required
**Response Format**: JSON

```bash
curl "https://tft-trading-system.yanggf.workers.dev/api/weekly-data?week=current&range=7"
```

**Query Parameters**:
- `week` (optional): `current` or specific week identifier
- `range` (optional): Number of days to include (default: 7)

### 5. KV Pipeline Testing and Management

#### KV Verification Test
**Endpoint**: `POST /kv-verification-test`
**Description**: Comprehensive KV operation testing with success metrics
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/kv-verification-test
```

**Response Structure**:
```json
{
  "test_results": {
    "put_operations": 10,
    "get_operations": 10,
    "delete_operations": 5,
    "success_rate": 1.0,
    "average_latency_ms": 45.2
  },
  "kv_health": "healthy",
  "performance_metrics": {
    "throughput_ops_sec": 150,
    "error_rate": 0.0
  }
}
```

#### Status Management
**Endpoint**: `GET /status-management`
**Description**: Job status and dependency validation dashboard
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/status-management
```

#### KV Debug
**Endpoint**: `GET /kv-debug`
**Description**: KV operation validation and testing interface
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/kv-debug
```

#### Generate Morning Predictions
**Endpoint**: `POST /generate-morning-predictions`
**Description**: Manual morning predictions generation from analysis data
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/generate-morning-predictions
```

### 6. Legacy Dashboards

#### Daily Summary Dashboard
**Endpoint**: `GET /daily-summary`
**Description**: Interactive daily analysis dashboard with 30-day history
**Authentication**: Not required
**Response Format**: HTML

```bash
curl https://tft-trading-system.yanggf.workers.dev/daily-summary
```

#### Weekly Analysis Dashboard
**Endpoint**: `GET /weekly-analysis`
**Description**: Legacy weekly analysis dashboard
**Authentication**: Not required
**Response Format**: HTML

```bash
curl https://tft-trading-system.yanggf.workers.dev/weekly-analysis
```

#### Fact Table
**Endpoint**: `GET /fact-table`
**Description**: Prediction accuracy validation dashboard
**Authentication**: Not required
**Response Format**: HTML

```bash
curl https://tft-trading-system.yanggf.workers.dev/fact-table
```

### 7. Facebook Integration Testing

#### Test Facebook Messenger
**Endpoint**: `POST /test-facebook`
**Description**: Test Facebook Messenger integration (all 4 message types)
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/test-facebook
```

**Response Structure**:
```json
{
  "test_results": {
    "pre_market_briefing": "sent",
    "intraday_check": "sent",
    "end_of_day_summary": "sent",
    "weekly_review": "sent",
    "message_delivery_success": true
  },
  "facebook_status": "connected",
  "message_types_tested": 4
}
```

#### Send Real Facebook Message
**Endpoint**: `POST /send-real-facebook`
**Description**: Send real Facebook message with actual trading analysis content
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/send-real-facebook
```

**Response Structure**:
```json
{
  "success": true,
  "message": "Real Facebook message sent with trading analysis",
  "message_id": "m_WHbZqJ...",
  "content_preview": "📊 **REAL TRADING ANALYSIS** - 2025-09-29...",
  "request_id": "uuid-here",
  "timestamp": "2025-09-29T17:35:40.727Z"
}
```

**Facebook Status**: ✅ **Error #10 RESOLVED** - All 4 message types now deliver real trading analysis content successfully

### 8. Performance Testing

#### Test Optimization
**Endpoint**: `GET /test-optimization`
**Description**: System optimization and performance testing
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/test-optimization
```

#### Test KPI
**Endpoint**: `GET /test-kpi`
**Description**: Key Performance Indicator testing and validation
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/test-kpi
```

#### Test Performance
**Endpoint**: `GET /test-performance`
**Description**: Comprehensive performance testing and benchmarking
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/test-performance
```

#### Enhancement Status
**Endpoint**: `GET /enhancement-status`
**Description**: System capability overview and enhancement tracking
**Authentication**: Not required
**Response Format**: JSON

```bash
curl https://tft-trading-system.yanggf.workers.dev/enhancement-status
```

### 9. Administrative Operations

#### Backfill Daily Summaries
**Endpoint**: `POST /admin/backfill-daily-summaries`
**Description**: Backfill historical daily summary data
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/admin/backfill-daily-summaries
```

#### Verify Backfill
**Endpoint**: `GET /admin/verify-backfill`
**Description**: Verify backfill operation results
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/admin/verify-backfill
```

#### Test Alert System
**Endpoint**: `POST /test-alert`
**Description**: Multi-channel webhook alerting system test
**Authentication**: Required (`X-API-KEY`)
**Response Format**: JSON

```bash
curl -H "X-API-KEY: your_key" https://tft-trading-system.yanggf.workers.dev/test-alert
```

## Error Handling

### Standard Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": "Additional error details if available"
  },
  "timestamp": "2025-09-29T12:00:00.000Z",
  "request_id": "unique-request-identifier"
}
```

### Common Error Codes

- `UNAUTHORIZED`: Missing or invalid API key
- `INVALID_SYMBOL`: Invalid stock symbol provided
- `RATE_LIMITED`: Too many requests (rate limit exceeded)
- `SERVICE_UNAVAILABLE`: AI models or external services unavailable
- `INVALID_DATE`: Invalid date format provided
- `DATA_NOT_FOUND`: Requested data not found in storage

### Rate Limiting

- **Public Endpoints**: 100 requests per minute
- **Authenticated Endpoints**: 1000 requests per minute
- **Analysis Endpoints**: 10 requests per hour (AI resource protection)
- **Market Data APIs**: 20 requests per minute (Yahoo Finance rate limit)

## Cron Schedule

The system executes automated analysis on the following schedule:

- **Morning Analysis**: 8:30 AM EST/EDT (Monday-Friday)
- **Midday Check**: 12:00 PM EST/EDT (Monday-Friday)
- **Daily Analysis**: 4:05 PM EST/EDT (Monday-Friday)
- **Weekly Review**: 10:00 AM EST/EDT (Sunday)

## Data Models

### Simplified Dual AI Analysis Result

```json
{
  "symbol": "AAPL",
  "timestamp": "2025-09-29T12:00:00.000Z",
  "execution_time_ms": 2847,
  "analysis_type": "simplified_dual_ai_comparison",
  "models": {
    "gpt": {
      "model": "gpt-oss-120b",
      "direction": "bullish|bearish|neutral",
      "confidence": 0.85,
      "reasoning": "Detailed analysis explanation",
      "articles_analyzed": 8,
      "analysis_type": "contextual_analysis"
    },
    "distilbert": {
      "model": "distilbert-sst-2-int8",
      "direction": "bullish|bearish|neutral",
      "confidence": 0.78,
      "articles_analyzed": 10,
      "sentiment_breakdown": {
        "bullish": 7,
        "bearish": 2,
        "neutral": 1
      },
      "analysis_type": "sentiment_classification"
    }
  },
  "comparison": {
    "agree": true,
    "agreement_type": "full_agreement|partial_agreement|disagreement",
    "details": {
      "match_direction": "bullish",
      "confidence_spread": 0.07
    }
  },
  "signal": {
    "type": "AGREEMENT|PARTIAL_AGREEMENT|DISAGREEMENT",
    "direction": "bullish|bearish|neutral",
    "strength": "STRONG|MODERATE|WEAK",
    "reasoning": "Signal explanation",
    "action": "STRONG_BUY|BUY|CONSIDER|HOLD|SELL|STRONG_SELL|AVOID"
  }
}
```

### Trading Signal Actions

- **STRONG_BUY**: Full agreement on bullish direction with high confidence
- **BUY**: Agreement on bullish direction with moderate confidence
- **CONSIDER**: Partial agreement with bullish bias
- **HOLD**: Neutral signals or mixed model agreement
- **SELL**: Agreement on bearish direction with moderate confidence
- **STRONG_SELL**: Full agreement on bearish direction with high confidence
- **AVOID**: Model disagreement or low confidence signals

## Webhook Integration

### Facebook Messenger Webhook

The system sends automated Facebook messages for:

1. **Daily Analysis**: Complete trading signals and insights
2. **Weekly Reports**: Accuracy summaries and performance metrics
3. **High-Confidence Alerts**: Signals exceeding 85% confidence threshold
4. **System Health**: Operational status and error notifications
5. **Cron Execution**: Scheduled job completion notifications

Message format includes:
- High-confidence signal breakdown
- Symbol-specific analysis
- Model agreement status
- Actionable recommendations
- Links to comprehensive web reports

## Configuration

### Environment Variables

Key configuration options available via environment variables:

```bash
# Trading configuration
TRADING_SYMBOLS="AAPL,MSFT,GOOGL,TSLA,NVDA"
CONFIDENCE_THRESHOLD=0.6
SIGNAL_CONFIDENCE_THRESHOLD=0.7

# AI model parameters
GPT_MAX_TOKENS=2000
GPT_TEMPERATURE=0.1

# Rate limiting
YAHOO_FINANCE_RATE_LIMIT=20
RATE_LIMIT_WINDOW=60

# KV storage TTL
KV_ANALYSIS_TTL=604800  # 7 days
KV_GRANULAR_TTL=7776000 # 90 days

# Logging
LOG_LEVEL=info
STRUCTURED_LOGGING=true
```

## Support

For technical support or API-related questions:

1. Check system health: `GET /health`
2. Review error logs: Available via structured logging
3. Test integration: Use test endpoints for validation
4. Monitor performance: `GET /test-performance`

## Version History

- **2025-10-01**: ✅ **TypeScript Core Architecture** - Legacy JS archived, 100% TypeScript core (13 modules), deployment b0b04ca1 verified
- **2025-10-01**: ✅ **TypeScript Migration Complete** - All 4 phases complete with 13 core modules, 100+ type definitions, production verified
- **2025-09-30**: TypeScript Data Access Layer (dal.ts) and platform-agnostic message tracking (msg-tracking.ts) with retry logic and type safety
- **2025-09-29**: Simplified dual AI system implementation with transparent agreement logic and enterprise-grade key management
- **2025-09-29**: ✅ **Facebook Error #10 RESOLVED** - Fixed Facebook API policy restrictions, removed problematic messaging_type and MESSAGE_TAG fields
- **2025-09-26**: Production-ready enterprise architecture with comprehensive optimization
- **2025-09-18**: Sentiment-first architecture transition
- **2025-09-04**: Facebook Messenger integration and neural network validation
- **2025-09-02**: Initial system foundation

---

*This API documentation covers all endpoints for the Cloud Trading System. For implementation details and architecture information, refer to the project documentation.*