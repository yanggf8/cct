# Business Intelligence Dashboard API Documentation

## Overview

The Business Intelligence (BI) Dashboard API provides real-time operational health monitoring and cost-to-serve intelligence for the CCT Trading System. This Phase 3 implementation includes scaffolding for comprehensive dashboard functionality with real-time data refresh capabilities.

**Base URL**: `https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard`
**Authentication**: Required (X-API-Key header)
**API Version**: v1
**Phase**: 3 (Scaffolding Implementation)

## Authentication

All dashboard endpoints require API authentication using the `X-API-Key` header:

```http
X-API-Key: your-api-key-here
```

## Endpoints

### 1. Dashboard Metrics

**GET** `/api/v1/dashboard/metrics`

Retrieve overall dashboard metrics including operational health, system performance, and business KPIs.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "operational_health": {
      "overall_score": 92.5,
      "api_response_time": 145,
      "cache_hit_rate": 94.2,
      "error_rate": 0.8,
      "throughput": 1250
    },
    "system_performance": {
      "cpu_utilization": 65.3,
      "memory_usage": 71.8,
      "storage_utilization": 58.9,
      "network_latency": 28
    },
    "business_metrics": {
      "daily_requests": 125000,
      "cost_per_request": 0.0008,
      "data_volume_processed": 2.8,
      "active_users": 342
    },
    "guard_status": {
      "violations_total": 15,
      "active_violations": 2,
      "critical_alerts": 0,
      "last_violation_time": "2025-01-15T14:32:00Z"
    },
    "last_updated": "2025-01-27T15:30:00.000Z"
  },
  "cached": true,
  "ttl": 300
}
```

**Caching**: 5 minutes (TTL: 300 seconds)
**Rate Limiting**: 60 requests per minute per API key

### 2. Cost-to-Serve Economics

**GET** `/api/v1/dashboard/economics`

Retrieve detailed cost analysis and economic metrics for the system.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "storage_costs": {
      "durable_objects": 12.50,
      "kv_storage": 8.75,
      "d1_database": 15.20,
      "total_storage": 36.45
    },
    "compute_costs": {
      "api_requests": 24.80,
      "ai_processing": 67.30,
      "data_processing": 18.90,
      "total_compute": 111.00
    },
    "bandwidth_costs": {
      "data_transfer": 14.60,
      "cdn_usage": 9.25,
      "total_bandwidth": 23.85
    },
    "total_monthly_cost": 171.30,
    "cost_per_request": 0.0008,
    "cost_efficiency_score": 87.5,
    "projected_monthly_cost": 178.90,
    "last_updated": "2025-01-27T15:30:00.000Z"
  },
  "cached": false,
  "ttl": 3600
}
```

**Caching**: 1 hour (TTL: 3600 seconds)
**Rate Limiting**: 30 requests per minute per API key

### 3. Guard Violations Monitoring

**GET** `/api/v1/dashboard/guards`

Retrieve guard violation data with filtering capabilities.

**Query Parameters:**
- `active_only` (boolean): Filter for only active violations
- `severity` (string): Filter by severity level (low, medium, high, critical)
- `limit` (integer): Maximum number of violations to return (default: 50)
- `offset` (integer): Pagination offset (default: 0)

**Examples:**
```http
GET /api/v1/dashboard/guards?active_only=true&severity=high&limit=20
GET /api/v1/dashboard/guards?limit=100&offset=50
```

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "violations": [
      {
        "id": "guard-001",
        "type": "performance",
        "severity": "medium",
        "description": "API response time exceeded 200ms threshold",
        "metric_value": 245,
        "threshold_value": 200,
        "timestamp": "2025-01-27T10:15:00Z",
        "resolved": true,
        "resolution_time": "2025-01-27T10:22:00Z"
      }
    ],
    "summary": {
      "total_violations": 15,
      "active_violations": 2,
      "critical_violations": 0,
      "violation_rate": 0.12,
      "mttr": 18.5
    },
    "pagination": {
      "total_count": 15,
      "limit": 50,
      "offset": 0,
      "has_more": false
    },
    "last_updated": "2025-01-27T15:30:00.000Z"
  },
  "cached": true,
  "ttl": 300
}
```

**Caching**: 5 minutes (TTL: 300 seconds)
**Rate Limiting**: 45 requests per minute per API key

### 4. Dashboard Health Check

**GET** `/api/v1/dashboard/health`

Check the overall health status of dashboard components and systems.

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "3.0.0",
    "uptime": 86400,
    "timestamp": "2025-01-27T15:30:00.000Z",
    "components": {
      "api": {
        "status": "healthy",
        "response_time": 45
      },
      "cache": {
        "status": "healthy",
        "hit_rate": 94.2
      },
      "database": {
        "status": "healthy",
        "connection_time": 12
      },
      "ai_models": {
        "status": "healthy",
        "response_time": 850
      }
    },
    "metrics": {
      "requests_per_minute": 1250,
      "error_rate": 0.8,
      "memory_usage": 71.8,
      "disk_usage": 58.9
    }
  }
}
```

**Caching**: No caching
**Rate Limiting**: 120 requests per minute per API key

### 5. Force Data Refresh

**POST** `/api/v1/dashboard/refresh`

Force refresh of cached dashboard data.

**Request Body:**
```json
{
  "targets": ["all"]
}
```

**Target Options:**
- `all`: Refresh all dashboard data
- `metrics`: Refresh only dashboard metrics
- `economics`: Refresh only economics data
- `guards`: Refresh only guard violation data

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "refreshed_at": "2025-01-27T15:30:00.000Z",
    "targets_requested": ["all"],
    "results": [
      {
        "target": "all",
        "success": true,
        "message": "25 dashboard cache entries cleared"
      }
    ]
  }
}
```

**Caching**: No caching
**Rate Limiting**: 10 requests per minute per API key

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "success": false,
  "error_code": "ERROR_CODE",
  "message": "Human-readable error description",
  "details": {
    "request_id": "req-123456",
    "additional_context": "..."
  }
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `DASHBOARD_METRICS_ERROR` | 500 | Failed to fetch dashboard metrics |
| `ECONOMICS_METRICS_ERROR` | 500 | Failed to fetch economics data |
| `GUARD_VIOLATION_ERROR` | 500 | Failed to fetch guard violations |
| `DASHBOARD_HEALTH_ERROR` | 500 | Failed to check dashboard health |
| `DASHBOARD_REFRESH_ERROR` | 500 | Failed to refresh dashboard data |

## Performance Metrics

### Response Time Targets

| Endpoint | Target P50 | Target P95 | Target P99 |
|----------|------------|------------|------------|
| `/metrics` | <100ms | <200ms | <500ms |
| `/economics` | <150ms | <300ms | <800ms |
| `/guards` | <120ms | <250ms | <600ms |
| `/health` | <50ms | <100ms | <200ms |
| `/refresh` | <200ms | <400ms | <1000ms |

### Cache Hit Rate Targets

- **Dashboard Metrics**: ≥90% hit rate
- **Economics Data**: ≥95% hit rate
- **Guard Violations**: ≥85% hit rate

## Rate Limiting

All dashboard endpoints are subject to rate limiting:

| Endpoint | Limit per Minute | Burst Limit |
|----------|------------------|-------------|
| `/metrics` | 60 | 10 |
| `/economics` | 30 | 5 |
| `/guards` | 45 | 8 |
| `/health` | 120 | 20 |
| `/refresh` | 10 | 2 |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Total requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Data Models

### DashboardMetrics Model

```typescript
interface DashboardMetrics {
  operational_health: {
    overall_score: number;        // 0-100
    api_response_time: number;    // milliseconds
    cache_hit_rate: number;       // percentage
    error_rate: number;           // percentage
    throughput: number;           // requests per minute
  };
  system_performance: {
    cpu_utilization: number;      // percentage
    memory_usage: number;         // percentage
    storage_utilization: number;  // percentage
    network_latency: number;      // milliseconds
  };
  business_metrics: {
    daily_requests: number;       // count
    cost_per_request: number;     // dollars
    data_volume_processed: number; // gigabytes
    active_users: number;         // count
  };
  guard_status: {
    violations_total: number;     // count
    active_violations: number;    // count
    critical_alerts: number;      // count
    last_violation_time: string | null; // ISO 8601
  };
  last_updated: string;           // ISO 8601
}
```

### CostToServeMetrics Model

```typescript
interface CostToServeMetrics {
  storage_costs: {
    durable_objects: number;      // dollars per month
    kv_storage: number;           // dollars per month
    d1_database: number;          // dollars per month
    total_storage: number;        // dollars per month
  };
  compute_costs: {
    api_requests: number;         // dollars per month
    ai_processing: number;        // dollars per month
    data_processing: number;      // dollars per month
    total_compute: number;        // dollars per month
  };
  bandwidth_costs: {
    data_transfer: number;        // dollars per month
    cdn_usage: number;            // dollars per month
    total_bandwidth: number;      // dollars per month
  };
  total_monthly_cost: number;     // dollars
  cost_per_request: number;       // dollars
  cost_efficiency_score: number;  // 0-100
  projected_monthly_cost: number; // dollars
  last_updated: string;           // ISO 8601
}
```

### GuardViolation Model

```typescript
interface GuardViolation {
  id: string;                     // unique identifier
  type: 'storage' | 'rate_limit' | 'performance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;            // human-readable description
  metric_value: number;           // actual metric value
  threshold_value: number;        // threshold that was exceeded
  timestamp: string;              // ISO 8601 when violation occurred
  resolved: boolean;              // whether violation is resolved
  resolution_time?: string;       // ISO 8601 when resolved (if resolved)
}
```

## Webhooks

### Dashboard Event Webhooks (Phase 4)

The dashboard API will support webhook notifications for significant events:

**Webhook Types:**
- `guard.violation`: New guard violation detected
- `performance.degradation`: Performance metrics degraded
- `cost.threshold_exceeded`: Cost threshold exceeded
- `system.health_change`: System health status changed

**Webhook Payload Example:**
```json
{
  "event_type": "guard.violation",
  "timestamp": "2025-01-27T15:30:00.000Z",
  "data": {
    "violation_id": "guard-123",
    "type": "performance",
    "severity": "high",
    "description": "API response time exceeded threshold"
  }
}
```

## SDK and Client Libraries

### JavaScript Client

The dashboard includes a comprehensive JavaScript client:

```javascript
import { BIDashboardClient } from '/js/dashboard/index.js';

const client = new BIDashboardClient({
  apiBase: '/api/v1',
  autoRefresh: true,
  refreshInterval: 300000 // 5 minutes
});

// Fetch metrics
const metrics = await client.fetchDashboardMetrics();

// Listen for updates
client.on('metrics:updated', (data) => {
  console.log('Metrics updated:', data);
});
```

### React Component (Phase 4)

```jsx
import { BIDashboard } from '@cct/dashboard-react';

function App() {
  return (
    <BIDashboard
      apiBase="/api/v1"
      autoRefresh={true}
      theme="light"
      onMetricsUpdate={(metrics) => console.log(metrics)}
    />
  );
}
```

## Testing

### Automated Testing Scripts

The dashboard includes comprehensive testing scripts:

1. **Cache Economics Test**: `./scripts/test-cache-economics.sh`
   - Tests cache hit rates and performance
   - Validates cost-to-serve metrics
   - Ensures cache refresh functionality

2. **D1 Rollups Test**: `./scripts/test-d1-rollups.sh`
   - Tests aggregation queries
   - Validates data quality
   - Performance benchmarking

### Manual Testing

1. **Health Check**: `curl -H "X-API-Key: test" https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health`

2. **Metrics Test**: `curl -H "X-API-Key: test" https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/metrics`

3. **Economics Test**: `curl -H "X-API-Key: test" https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/economics`

## Monitoring and Observability

### Metrics Tracked

- **API Response Times**: P50, P95, P99 percentiles
- **Cache Hit Rates**: By endpoint and data type
- **Error Rates**: By endpoint and error type
- **Request Volume**: Requests per minute/hour
- **Data Freshness**: Age of cached data

### Alerting Thresholds

- **High Response Time**: P95 > 500ms
- **Low Cache Hit Rate**: <80% for metrics, <90% for economics
- **High Error Rate**: >5%
- **Guard Violations**: >10 active violations

## Deployment Instructions

### Prerequisites

1. Cloudflare Workers environment
2. Configured API keys
3. Durable Objects enabled
4. KV storage configured

### Deployment Steps

1. **Deploy Backend**:
   ```bash
   wrangler deploy
   ```

2. **Configure API Keys**:
   ```bash
   wrangler secret put X_API_KEY
   ```

3. **Enable Features**:
   ```bash
   wrangler secret put FEATURE_FLAG_DASHBOARD
   # Enter: true
   ```

4. **Validate Deployment**:
   ```bash
   ./scripts/test-cache-economics.sh
   ./scripts/test-d1-rollups.sh
   ```

### Frontend Deployment

1. **Build Frontend**:
   ```bash
   npm run build:dashboard
   ```

2. **Deploy Static Assets**:
   - Upload to Cloudflare Pages
   - Configure custom domain
   - Enable caching

## Integration Guidelines

### Cross-System Alignment

1. **API Versioning**: All dashboard endpoints use `/api/v1/dashboard/` prefix
2. **Authentication**: Consistent X-API-Key header across all endpoints
3. **Error Handling**: Standardized error response format
4. **Rate Limiting**: Unified rate limiting strategy
5. **Caching**: Consistent TTL patterns and cache invalidation

### External Integrations

1. **Monitoring Systems**: Export metrics to Prometheus/Grafana
2. **Alerting**: Integrate with PagerDuty/Slack
3. **Analytics**: Send usage data to analytics platforms
4. **Logging**: Structured logging for debugging

### Data Pipeline Integration

1. **Real-time Data**: WebSocket connections for live updates
2. **Batch Processing**: Scheduled rollups for historical analysis
3. **Data Lake**: Export raw data for long-term storage
4. **Machine Learning**: Feed data into ML models for predictions

## Roadmap

### Phase 4 (Q1 2025)
- Real-time WebSocket streaming
- Advanced visualizations and charts
- Custom alerting rules
- Historical data analysis
- Export capabilities

### Phase 5 (Q2 2025)
- Predictive analytics
- Anomaly detection
- Automated optimization suggestions
- Cost optimization recommendations
- Multi-tenant dashboards

## Support

- **Documentation**: [GitHub Wiki](https://github.com/yanggf8/cct/wiki)
- **Issues**: [GitHub Issues](https://github.com/yanggf8/cct/issues)
- **API Status**: [Status Page](https://status.cct-trading.com)
- **Support Email**: support@cct-trading.com

---

**Last Updated**: 2025-01-27
**Version**: 3.0.0 (Phase 3 Scaffolding)
**API Version**: v1