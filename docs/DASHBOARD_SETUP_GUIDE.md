# Business Intelligence Dashboard Setup Guide

## Overview

This guide provides step-by-step instructions for deploying and configuring the Business Intelligence (BI) Dashboard for the CCT Trading System. The dashboard provides real-time operational health monitoring and cost-to-serve intelligence.

**Prerequisites:**
- Node.js 18+ and npm
- Cloudflare Workers account
- GitHub account for CI/CD
- Basic understanding of APIs and web technologies

## Phase 3 Deployment Setup

### 1. Backend Deployment

#### 1.1 Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install development dependencies
npm install --save-dev @types/node typescript wrangler
```

#### 1.2 Configure Cloudflare Workers

```bash
# Login to Cloudflare
npx wrangler login

# Verify authentication
npx wrangler whoami
```

#### 1.3 Set Environment Variables

```bash
# Set API key (required for dashboard endpoints)
wrangler secret put X_API_KEY
# Enter your secure API key when prompted

# Enable dashboard features
wrangler secret put FEATURE_FLAG_DASHBOARD
# Enter: true

# Set cache configuration
wrangler secret put CACHE_TTL_SECONDS
# Enter: 300

# Set cost tracking settings
wrangler secret put COST_TRACKING_ENABLED
# Enter: true
```

#### 1.4 Deploy Backend Services

```bash
# Deploy main application
wrangler deploy

# Verify deployment
curl -H "X-API-Key: your-api-key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health
```

### 2. Frontend Deployment

#### 2.1 Build Frontend Assets

```bash
# Build dashboard frontend
npm run build:dashboard

# Build all frontend assets
npm run build:all
```

#### 2.2 Deploy to Cloudflare Pages

```bash
# Install Wrangler for Pages deployment
npm install -g wrangler

# Create Pages project
npx wrangler pages project create bi-dashboard --production-branch main

# Deploy frontend
npx wrangler pages deploy public --project-name bi-dashboard
```

#### 2.3 Configure Custom Domain (Optional)

```bash
# Add custom domain
npx wrangler pages project domain bi-dashboard.cct-trading.com

# Update DNS records as instructed by Cloudflare
```

### 3. Configuration Setup

#### 3.1 API Configuration

Create `public/config/dashboard-config.json`:

```json
{
  "api": {
    "base_url": "https://tft-trading-system.yanggf.workers.dev/api/v1",
    "timeout": 30000,
    "retry_attempts": 3
  },
  "dashboard": {
    "refresh_interval": 300000,
    "auto_refresh": true,
    "theme": "light",
    "enable_animations": true
  },
  "features": {
    "real_time_updates": false,
    "export_data": false,
    "custom_alerts": false
  }
}
```

#### 3.2 Cache Configuration

Update `src/modules/config.ts` if needed:

```typescript
export const dashboardConfig = {
  cache: {
    default_ttl: 300, // 5 minutes
    economics_ttl: 3600, // 1 hour
    guards_ttl: 300,
    health_ttl: 60
  },
  rate_limiting: {
    requests_per_minute: 60,
    burst_limit: 10
  }
};
```

### 4. Testing and Validation

#### 4.1 Run Automated Tests

```bash
# Test cache economics
./scripts/test-cache-economics.sh

# Test D1 rollups
./scripts/test-d1-rollups.sh

# Run all dashboard tests
npm run test:dashboard
```

#### 4.2 Manual Testing

```bash
# Test dashboard health
curl -H "X-API-Key: test" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health

# Test metrics endpoint
curl -H "X-API-Key: test" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/metrics

# Test economics endpoint
curl -H "X-API-Key: test" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/economics
```

#### 4.3 Frontend Testing

1. Open `https://your-domain.com/bi-dashboard.html`
2. Verify dashboard loads correctly
3. Check data refresh functionality
4. Test responsive design on mobile devices

### 5. Monitoring and Alerts Setup

#### 5.1 Set Up Monitoring

```bash
# Create monitoring configuration
cat > wrangler.toml << EOF
[env.production]
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[env.production.kv_namespaces]]
binding = "DASHBOARD_KV"
id = "your-kv-namespace-id"

[env.production.durable_objects.bindings]
name = "DASHBOARD_CACHE"
class_name = "DashboardCache"
EOF
```

#### 5.2 Configure Logging

```typescript
// src/modules/logging.ts - Update as needed
export const dashboardLogger = createLogger('dashboard', {
  level: 'info',
  enable_metrics: true,
  export_to_cloudwatch: true
});
```

#### 5.3 Set Up Alerts

Create alert configuration in `config/alerts.json`:

```json
{
  "alerts": {
    "high_response_time": {
      "threshold": 500,
      "window": "5m",
      "severity": "warning"
    },
    "low_cache_hit_rate": {
      "threshold": 80,
      "window": "15m",
      "severity": "warning"
    },
    "guard_violations": {
      "threshold": 10,
      "window": "1h",
      "severity": "critical"
    }
  }
}
```

## Environment-Specific Setup

### Development Environment

#### 1. Local Development Setup

```bash
# Clone repository
git clone https://github.com/yanggf8/cct.git
cd cct

# Install dependencies
npm install

# Start development server
npm run dev:dashboard

# Or use Wrangler dev
npm run dev:wrangler
```

#### 2. Development Configuration

Create `.dev.vars` file:

```env
X_API_KEY=dev-api-key
FEATURE_FLAG_DASHBOARD=true
CACHE_TTL_SECONDS=60
COST_TRACKING_ENABLED=true
D1_DATABASE_NAME=cct_dev
```

#### 3. Testing in Development

```bash
# Run development tests
npm run test:dev

# Run integration tests
npm run test:integration

# Test dashboard locally
curl -H "X-API-Key: dev-api-key" \
  http://localhost:8787/api/v1/dashboard/health
```

### Staging Environment

#### 1. Staging Deployment

```bash
# Deploy to staging
wrangler deploy --env staging

# Set staging secrets
wrangler secret put X_API_KEY --env staging
wrangler secret put FEATURE_FLAG_DASHBOARD --env staging
```

#### 2. Staging Configuration

```bash
# Create staging configuration
cp wrangler.toml wrangler.staging.toml

# Update staging-specific settings
# (adjust database names, cache settings, etc.)
```

#### 3. Staging Testing

```bash
# Run staging tests
API_BASE=https://cct-staging.workers.dev \
  ./scripts/test-cache-economics.sh

# Manual testing
curl -H "X-API-Key: staging-key" \
  https://cct-staging.workers.dev/api/v1/dashboard/metrics
```

### Production Environment

#### 1. Production Deployment

```bash
# Deploy to production (uses env -u CLOUDFLARE_API_TOKEN)
env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

# Verify deployment
curl -H "X-API-Key: $PROD_API_KEY" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health
```

#### 2. Production Monitoring

```bash
# Set up production monitoring
npm run monitor:production

# Check system health
npm run health:check

# Monitor performance
npm run performance:monitor
```

## CI/CD Integration

### GitHub Actions Setup

Create `.github/workflows/dashboard-deploy.yml`:

```yaml
name: Dashboard Deployment

on:
  push:
    branches: [main]
    paths: ['dashboard/**', 'src/routes/dashboard/**', 'public/js/dashboard/**']
  pull_request:
    branches: [main]
    paths: ['dashboard/**', 'src/routes/dashboard/**', 'public/js/dashboard/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run dashboard tests
        run: |
          ./scripts/test-cache-economics.sh
          ./scripts/test-d1-rollups.sh

      - name: Build dashboard
        run: npm run build:dashboard

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Cloudflare Workers
        run: |
          env -u CLOUDFLARE_API_TOKEN npx wrangler deploy

      - name: Run smoke tests
        run: |
          curl -f -H "X-API-Key: ${{ secrets.DASHBOARD_API_KEY }}" \
            https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health
```

### Environment Variables

Set up secrets in GitHub repository settings:

- `DASHBOARD_API_KEY`: Production API key
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token (optional, use browser auth instead)
- `STAGING_API_KEY`: Staging environment API key

## Security Configuration

### API Security

#### 1. Rate Limiting

```typescript
// Configure rate limiting in src/modules/api-security.ts
export const dashboardRateLimits = {
  metrics: { requests_per_minute: 60, burst: 10 },
  economics: { requests_per_minute: 30, burst: 5 },
  guards: { requests_per_minute: 45, burst: 8 },
  health: { requests_per_minute: 120, burst: 20 },
  refresh: { requests_per_minute: 10, burst: 2 }
};
```

#### 2. CORS Configuration

```typescript
// Add to dashboard routes
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-dashboard-domain.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400'
};
```

#### 3. Input Validation

```typescript
// Add validation for dashboard endpoints
export function validateDashboardInput(input: any): boolean {
  // Validate query parameters
  if (input.limit && (input.limit < 1 || input.limit > 1000)) {
    return false;
  }

  // Validate severity filter
  if (input.severity && !['low', 'medium', 'high', 'critical'].includes(input.severity)) {
    return false;
  }

  return true;
}
```

### Data Protection

#### 1. Sensitive Data Masking

```typescript
// Mask sensitive data in responses
export function maskSensitiveData(data: any): any {
  // Remove API keys from logs
  if (data.api_key) {
    data.api_key = '***';
  }

  // Limit precision of cost data
  if (data.cost_per_request) {
    data.cost_per_request = Number(data.cost_per_request.toFixed(6));
  }

  return data;
}
```

#### 2. Access Control

```typescript
// Implement role-based access
export function checkDashboardAccess(apiKey: string, endpoint: string): boolean {
  const permissions = getApiKeyPermissions(apiKey);

  switch (endpoint) {
    case '/api/v1/dashboard/refresh':
      return permissions.includes('admin');
    case '/api/v1/dashboard/economics':
      return permissions.includes('viewer') || permissions.includes('admin');
    default:
      return permissions.includes('viewer');
  }
}
```

## Performance Optimization

### Caching Strategy

#### 1. Edge Caching

```typescript
// Configure Cloudflare Workers KV for edge caching
export const edgeCacheConfig = {
  metrics: { ttl: 300, edge_ttl: 60 }, // 5 min server, 1 min edge
  economics: { ttl: 3600, edge_ttl: 300 }, // 1 hour server, 5 min edge
  guards: { ttl: 300, edge_ttl: 60 },
  health: { ttl: 60, edge_ttl: 30 }
};
```

#### 2. Database Optimization

```typescript
// Optimize D1 queries for rollups
export const rollupQueries = {
  daily: `
    SELECT
      DATE(created_at) as date,
      COUNT(*) as request_count,
      AVG(response_time) as avg_response_time,
      SUM(cost_amount) as total_cost
    FROM api_requests
    WHERE created_at >= DATE('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `
};
```

### Frontend Optimization

#### 1. Asset Optimization

```javascript
// vite.config.js or webpack configuration
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          dashboard: ['public/js/dashboard/index.js'],
          charts: ['chart.js', 'chartjs-adapter-luxon']
        }
      }
    }
  }
};
```

#### 2. Lazy Loading

```javascript
// Implement lazy loading for dashboard components
const DashboardController = lazy(() => import('./dashboard-controller.js'));

function App() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardController />
    </Suspense>
  );
}
```

## Troubleshooting

### Common Issues

#### 1. API Authentication Failed

**Symptoms:** 401 Unauthorized responses
**Solutions:**
```bash
# Verify API key is set
wrangler secret list

# Update API key
wrangler secret put X_API_KEY

# Test API key
curl -H "X-API-Key: your-key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health
```

#### 2. High Response Times

**Symptoms:** Dashboard loading slowly, API timeouts
**Solutions:**
```bash
# Check cache hit rates
curl -H "X-API-Key: your-key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/cache/metrics

# Clear cache if needed
curl -X POST -H "X-API-Key: your-key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/refresh

# Monitor performance
npm run performance:monitor
```

#### 3. Data Not Updating

**Symptoms:** Stale data showing in dashboard
**Solutions:**
```bash
# Force refresh
curl -X POST -H "X-API-Key: your-key" \
  -d '{"targets": ["all"]}' \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/refresh

# Check cache timestamps
curl -H "X-API-Key: your-key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/cache/timestamps
```

#### 4. Frontend Not Loading

**Symptoms:** Dashboard page shows blank or errors
**Solutions:**
```bash
# Check browser console for JavaScript errors

# Verify frontend deployment
curl -I https://your-dashboard-domain.com/bi-dashboard.html

# Rebuild frontend
npm run build:dashboard
npm run deploy:frontend
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
wrangler secret put DEBUG_MODE
# Enter: true

# Check logs
wrangler tail --format pretty
```

### Health Check Endpoint

Use health endpoint for troubleshooting:

```bash
curl -H "X-API-Key: your-key" \
  https://tft-trading-system.yanggf.workers.dev/api/v1/dashboard/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "components": {
      "api": { "status": "healthy", "response_time": 45 },
      "cache": { "status": "healthy", "hit_rate": 94.2 },
      "database": { "status": "healthy", "connection_time": 12 }
    }
  }
}
```

## Maintenance

### Regular Tasks

#### 1. Weekly Maintenance

```bash
# Run full test suite
npm run test:all

# Check performance metrics
npm run performance:check

# Update dependencies
npm update

# Review error logs
wrangler tail --since 7d
```

#### 2. Monthly Maintenance

```bash
# Archive old data
npm run archive:monthly

# Update SSL certificates (if using custom domain)
npm run ssl:renew

# Review and update documentation
npm run docs:update

# Performance audit
npm run audit:performance
```

#### 3. Quarterly Tasks

```bash
# Security audit
npm run audit:security

# Cost optimization review
npm run cost:review

# Capacity planning
npm run capacity:plan

# Backup configuration and data
npm run backup:full
```

### Monitoring Dashboards

Set up external monitoring:

1. **Uptime Monitoring**: Use services like UptimeRobot or Pingdom
2. **Performance Monitoring**: Set up New Relic or DataDog
3. **Error Tracking**: Configure Sentry for error monitoring
4. **Log Analysis**: Use Cloudflare Analytics or ELK stack

---

**Support**: For additional help, refer to the [API Documentation](./DASHBOARD_API_DOCUMENTATION.md) or open an issue on GitHub.

**Last Updated**: 2025-01-27
**Version**: 3.0.0 (Phase 3)