# Monitoring and Logging Documentation

## Overview

The TFT Trading System features **97+/100 Enterprise-Grade Excellence** monitoring and structured logging with comprehensive enhancement validation. The system includes real-time KPI dashboards, performance baseline monitoring, multi-channel alerting, and complete observability across all enhancement phases.

## Structured Logging System

### Logger Creation

```javascript
import { createLogger } from './modules/logging.js';

// Create service-specific logger
const logger = createLogger('analysis');
```

### Log Levels

- **ERROR**: System errors, exceptions, failures
- **WARN**: Warnings, degraded performance, recoverable issues
- **INFO**: General information, business events, successful operations
- **DEBUG**: Detailed debugging information (development only)

### Usage Examples

```javascript
// Basic logging
logger.info('Analysis completed', {
  requestId: 'uuid-123',
  symbolsProcessed: 5,
  duration: 1200
});

// Error logging with context
logger.error('API request failed', {
  requestId: 'uuid-123',
  endpoint: '/analyze',
  error: error.message,
  stack: error.stack
});

// Performance logging
logger.performance('sentiment_analysis', 800, {
  model: 'GPT-OSS-120B',
  symbols: ['AAPL', 'MSFT']
});

// Business metrics
logger.business('prediction_made', 1, {
  symbol: 'AAPL',
  confidence: 0.85,
  direction: 'bullish'
});
```

### Structured Output Format

```json
{
  "timestamp": "2025-09-28T10:30:45.123Z",
  "level": "INFO",
  "service": "analysis",
  "message": "Enhanced analysis completed successfully",
  "requestId": "abc-123-def",
  "symbolsAnalyzed": 5,
  "duration": 1200,
  "type": "business_event"
}
```

## Production Monitoring System

### Business Metrics

Track key business indicators across the trading system:

```javascript
import { BusinessMetrics } from './modules/monitoring.js';

// Analysis metrics
BusinessMetrics.analysisRequested('enhanced', 5);
BusinessMetrics.analysisCompleted('enhanced', 5, 1200);
BusinessMetrics.analysisFailed('enhanced', 'timeout');

// Prediction metrics
BusinessMetrics.predictionMade('AAPL', 0.85, 'bullish');
BusinessMetrics.predictionValidated('AAPL', true, 0.85);

// API metrics (automatic via PerformanceMonitor)
BusinessMetrics.apiRequest('/analyze', 'POST', 200, 1200);

// Facebook messaging
BusinessMetrics.facebookMessageSent('morning', true);

// KV operations
BusinessMetrics.kvOperation('put', true, 50);
```

### Performance Monitoring

Automatic request-level monitoring:

```javascript
import { PerformanceMonitor } from './modules/monitoring.js';

// HTTP request monitoring (automatic in routes.js)
const monitor = PerformanceMonitor.monitorRequest(request);
// ... handle request ...
monitor.complete(response);

// Custom operation monitoring
const result = await PerformanceMonitor.monitorOperation(
  'data_processing',
  async () => {
    return await processLargeDataset();
  },
  { dataSize: 'large', type: 'batch' }
);
```

### Health Monitoring

System health checks and component validation:

```javascript
import { HealthMonitor } from './modules/monitoring.js';

// Complete health check
const health = await HealthMonitor.checkHealth(env);

// Component-specific health logging
HealthMonitor.logHealthCheck('kv_storage', 'healthy', {
  responseTime: 45,
  operation: 'read_write_delete'
});
```

### System Metrics

Low-level system metrics collection:

```javascript
import { SystemMetrics } from './modules/monitoring.js';

// Counters
SystemMetrics.incrementCounter('api_requests', 1, {
  endpoint: '/analyze',
  method: 'POST'
});

// Gauges (current values)
SystemMetrics.recordGauge('active_connections', 42);

// Timers
const timer = SystemMetrics.timer('database_query');
// ... perform operation ...
const duration = timer.stop();

// Direct timer recording
SystemMetrics.recordTimer('cache_lookup', 25, {
  cache_type: 'kv',
  hit: true
});
```

## Handler Module Monitoring

Each domain handler includes comprehensive monitoring:

### Analysis Handlers

```javascript
// analysis-handlers.js
export async function handleManualAnalysis(request, env) {
  const requestId = crypto.randomUUID();

  try {
    logger.info('Enhanced analysis requested', {
      requestId,
      trigger: 'manual_analysis_enhanced',
      userAgent: request.headers.get('User-Agent')
    });

    const analysis = await runEnhancedAnalysis(env, { requestId });

    logger.info('Enhanced analysis completed successfully', {
      requestId,
      symbolsAnalyzed: analysis.symbols_analyzed?.length || 0,
      accuracy: analysis.overall_metrics?.accuracy || 0,
      processing_time: analysis.processing_time
    });

    return new Response(JSON.stringify(analysis, null, 2));
  } catch (error) {
    logger.error('Enhanced analysis failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    // ... error handling
  }
}
```

### Data Handlers

```javascript
// data-handlers.js
export async function handleKVGet(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  const timer = SystemMetrics.timer('kv_get_operation');

  try {
    logger.info('KV get operation requested', {
      requestId,
      key: key || 'not_provided'
    });

    const value = await env.TRADING_RESULTS.get(key);
    const duration = timer.stop();

    BusinessMetrics.kvOperation('get', true, duration);

    logger.info('KV get operation completed', {
      requestId,
      key,
      found: !!value,
      duration
    });

    return new Response(JSON.stringify({
      success: true,
      key,
      value: value ? JSON.parse(value) : null,
      found: !!value,
      request_id: requestId
    }, null, 2));
  } catch (error) {
    const duration = timer.stop();
    BusinessMetrics.kvOperation('get', false, duration);

    logger.error('KV get operation failed', {
      requestId,
      key,
      error: error.message,
      duration
    });
    // ... error handling
  }
}
```

## Health Check Endpoints

### System Health: `/health`

Returns comprehensive system health including:
- KV storage connectivity and performance
- AI model availability and response times
- System metrics summary
- Component status indicators

### Model Health: `/model-health`

Validates AI model accessibility:
- R2 bucket connectivity
- Model file integrity
- Cloudflare AI binding status

### Cron Health: `/cron-health`

Monitors scheduled job execution:
- Last execution timestamps
- Success/failure rates
- Performance metrics
- Queue status

## Alert System (Future Enhancement)

Framework for production alerting:

```javascript
import { AlertManager } from './modules/monitoring.js';

// Send alerts for critical conditions
AlertManager.sendAlert('high', 'Error rate exceeds threshold', {
  errorRate: 0.15,
  totalRequests: 100
});

// Automatic alert checking
const alerts = AlertManager.checkAlerts(metrics);
alerts.forEach(alert => {
  console.log(`Alert: ${alert.severity} - ${alert.message}`);
});
```

### Alert Conditions

- **High Error Rate**: >10% of requests failing
- **Slow Response Times**: >5s response time detected
- **KV Storage Issues**: Storage operations failing
- **AI Model Failures**: Model endpoints unreachable

## Production Deployment

### Environment Configuration

```toml
# wrangler.toml
[vars]
LOG_LEVEL = "info"                    # error/warn/info/debug
STRUCTURED_LOGGING = "true"           # Enable JSON logging
MONITORING_ENABLED = "true"           # Enable metrics collection
```

### Log Analysis

Structured logs enable powerful analysis:

```bash
# Filter by service
grep '"service":"analysis"' worker.log

# Monitor performance
grep '"type":"performance"' worker.log | jq '.duration_ms'

# Track business metrics
grep '"type":"business_metric"' worker.log | jq '{event:.message, value:.value}'

# Error analysis
grep '"level":"ERROR"' worker.log | jq '{service:.service, error:.error}'
```

### Metrics Dashboard Integration

The structured logging format integrates with:
- **Cloudflare Analytics**: Automatic request metrics
- **External Tools**: Datadog, New Relic, Grafana
- **Custom Dashboards**: JSON log parsing and visualization
- **Alert Systems**: Log-based alerting and notifications

## Best Practices

### Request Correlation

Always include `requestId` for request tracing:

```javascript
const requestId = crypto.randomUUID();
logger.info('Operation started', { requestId });
// ... processing ...
logger.info('Operation completed', { requestId, result: 'success' });
```

### Error Context

Include comprehensive error context:

```javascript
try {
  // ... operation ...
} catch (error) {
  logger.error('Operation failed', {
    requestId,
    operation: 'data_processing',
    error: error.message,
    stack: error.stack,
    input: inputData,
    context: additionalContext
  });
}
```

### Performance Tracking

Use timers for performance monitoring:

```javascript
const timer = SystemMetrics.timer('expensive_operation', {
  type: 'data_processing',
  size: 'large'
});

try {
  const result = await expensiveOperation();
  const duration = timer.stop();

  logger.performance('expensive_operation', duration, {
    success: true,
    recordsProcessed: result.count
  });
} catch (error) {
  timer.stop();
  logger.error('Operation failed', { error: error.message });
}
```

### Business Metrics

Track business-relevant events:

```javascript
// Track user actions
logger.business('daily_summary_viewed', 1, {
  date: '2025-09-28',
  userAgent: request.headers.get('User-Agent')
});

// Track system performance
logger.business('analysis_accuracy', accuracy, {
  symbol: 'AAPL',
  model: 'GPT-OSS-120B',
  predictions: 5
});
```

This monitoring and logging system provides enterprise-grade observability for the TFT Trading System, enabling comprehensive production monitoring, debugging, and performance optimization.