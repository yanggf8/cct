# Production Guards Handbook

**Version**: Sprint 1-C
**Last Updated**: 2025-01-XX
**Purpose**: Comprehensive guide to production guards, build-time mock prevention, and deployment safety

---

## 🎯 **Overview**

This handbook covers the complete production guardrails system implemented for the TFT Trading System, ensuring that mock data, placeholders, and development artifacts never reach production deployments.

### **Core Principles**

1. **Fail-Fast**: Mock data detection fails builds immediately
2. **Zero Tolerance**: No placeholders or "coming soon" content in production
3. **Comprehensive Coverage**: Multiple layers of protection (CI, build-time, runtime)
4. **Developer-Friendly**: Clear exemptions process with ticket references
5. **Automated Enforcement**: CI/CD gates prevent human error

---

## 🛡️ **Production Guardrails Architecture**

### **Layer 1: Build-Time Mock Prevention**

#### **CI Grep Gates**
- **Location**: `.github/workflows/build-time-mock-prevention.yml`
- **Purpose**: Scan source and build files for banned patterns
- **Trigger**: Every push/PR to main branch

**Banned Patterns (Critical)**:
```
coming soon, COMING SOON
mock data, MOCK DATA
test data, TEST DATA
lorem ipsum, Lorem ipsum
not implemented, NOT IMPLEMENTED
placeholder, PLACEHOLDER
```

**Warning Patterns**:
```
console.log, console.warn, console.error
debugger statements
example.com references
fake timestamps
```

#### **Exemption Process**
For legitimate temporary content, use:
```typescript
// MOCK-EXEMPTION: JIRA-123 - Temporary placeholder for new feature
const temporaryData = "coming soon";
```

#### **Local Development**
```bash
# Quick scan
./test-mock-prevention-scan.sh quick

# Full scan
./test-mock-prevention-scan.sh full

# Strict scan (no tolerance)
./test-mock-prevention-scan.sh strict
```

### **Layer 2: Type-Level Production Guards**

#### **Build Flags**
- **Development**: `tsconfig.dev.json` - Allows mock imports
- **Production**: `tsconfig.prod.json` - Blocks mock imports with path aliases

#### **Path Aliases**
```typescript
// Development (allowed)
import { createMockData } from '@/mocks/test-utils';

// Production (blocked - throws error)
import { createMockData } from '@/mocks/test-utils';
// ❌ Error: 🚫 PRODUCTION GUARD: createMockData() is not allowed in production builds
```

#### **Guard Stubs**
- **Location**: `src/guards/no-mock-stub.ts`, `src/guards/no-test-stub.ts`
- **Purpose**: Intentionally throw errors when mock/test imports are attempted in production

### **Layer 3: ESLint Production Rules**

#### **Mock Prevention Configuration**
```javascript
// .eslintrc.mock-prevention.js
module.exports = {
  extends: ['./.eslintrc.js'],
  rules: {
    'no-debugger': 'error',
    'no-console': 'warn',
    'no-alert': 'error',
    'no-eval': 'error'
  }
};
```

#### **Required Ticket References**
```typescript
// ❌ Bad - No ticket reference
// TODO: Add real market data here

// ✅ Good - With ticket reference
// TODO: JIRA-456 - Replace with real FRED API integration
const marketData = "placeholder";
```

### **Layer 4: Bundler Verification**

#### **Post-Build Scanning**
- Scans built artifacts for debug code
- Verifies no mock utilities in production bundle
- Checks bundle size and composition
- Validates deterministic builds

#### **Build Hash Verification**
```bash
# Builds must be deterministic across environments
npm run build  # Hash: abc123
npm run build  # Hash: abc123 (must match)
```

---

## 🔍 **Validation Commands**

### **Comprehensive Verification**
```bash
# Full production verification
npm run verify

# Staging environment verification
npm run verify:staging

# Production-ready verification
npm run verify:prod
```

### **Individual Tests**
```bash
# HTML structure validation
npm run test:html-structure

# Environment binding validation
npm run test:validate-environment

# Production guards smoke test
npm run test:guards-smoke

# Synthetic monitoring
npm run test:synthetic-monitoring

# Mock prevention scan
npm run test:mock-prevention
```

### **CI/CD Pipeline Integration**
All validation runs automatically in:
- **Pull Requests**: Full verification before merge
- **Push to Main**: Production deployment validation
- **Scheduled**: Daily health checks

---

## 🚀 **Deployment Safety**

### **Canary Rollout System**

#### **Feature Flags**
```typescript
// Enable canary for 10% of traffic
await canaryManager.enableCanary('/pre-market-briefing', 10);

// Whitelist specific users
await canaryManager.enableCanary('/weekly-review', 100, {
  whitelist: ['user-123', 'ip-192.168.1.1']
});

// Blacklist problematic users
await canaryManager.enableCanary('/intraday-check', 50, {
  blacklist: ['user-456']
});
```

#### **Canary Management API**
```bash
# Check canary status
curl -H "X-API-Key: $KEY" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/canary/status"

# Enable canary
curl -X POST -H "X-API-Key: $KEY" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/canary/enable?route=/pre-market-briefing&percentage=25"

# Simulate traffic
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"route": "/pre-market-briefing", "user_count": 1000}' \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/canary/simulate"
```

### **SLO Monitoring**

#### **Thresholds by Endpoint**
| Endpoint | p95 Target | Availability | Error Rate |
|----------|------------|--------------|------------|
| `/pre-market-briefing` | 1.5s | 99.9% | 0.1% |
| `/intraday-check` | 1.2s | 99.5% | 0.2% |
| `/end-of-day-summary` | 2.0s | 99.0% | 0.5% |
| `/weekly-review` | 3.0s | 98.0% | 1.0% |

#### **Alert Policies**
- **Response Time**: Alert if p95 > 150% of target
- **Error Rate**: Alert if > 2x threshold for 5 minutes
- **Availability**: Alert if < 95% for 10 minutes

### **Rollback Procedures**

#### **Emergency Rollback**
```bash
# Quick rollback to previous version
./rollback-production.sh emergency

# Dry run to test rollback process
DRY_RUN=true ./rollback-production.sh emergency

# Rollback without cache invalidation
SKIP_CACHE_INVALIDATION=true ./rollback-production.sh reason
```

#### **Rollback Checklist**
- [ ] Identify problematic deployment
- [ ] Execute rollback script
- [ ] Verify HTML endpoints responding
- [ ] Check SLO metrics recovery
- [ ] Invalidate CDN cache
- [ ] Monitor system stability
- [ ] Investigate root cause
- [ ] Document incident

---

## 🛠️ **Development Guidelines**

### **What Causes Build Failures**

#### **Critical Violations (Block Deployment)**
```typescript
// ❌ These will cause build failures

// Placeholder text
const message = "coming soon";

// Mock data references
const mockResponse = { data: "test data" };

// Unimplemented features
if (!feature) {
  throw new Error("not implemented");
}

// Latin placeholders
const content = "Lorem ipsum dolor sit amet";
```

#### **Warning Violations (May Block)**
```typescript
// ⚠️ These generate warnings

// Debug code
console.log("Debug info");
debugger;

// Example domains
const url = "https://example.com/api";

// Fake timestamps
const timestamp = "2023-01-01T00:00:00Z";
```

### **How to Remediate Violations**

#### **Replace Placeholders**
```typescript
// ❌ Before
const marketStatus = "coming soon";

// ✅ After
const marketStatus = await getMarketStatus(); // Real implementation
```

#### **Implement Real Features**
```typescript
// ❌ Before
if (!data) {
  return { status: "not implemented" };
}

// ✅ After
if (!data) {
  throw new Error("Market data unavailable - check FRED API connection");
}
```

#### **Add Proper Exemptions**
```typescript
// ❌ Before
// TODO: Replace with real data
const tempData = "placeholder";

// ✅ After
// TODO: JIRA-789 - Replace with real Alpha Vantage data when API key is provisioned
const tempData = "placeholder";
```

### **Environment Validation**

#### **Required Bindings**
```bash
# Verify all required environment variables
wrangler secret list

# Test environment readiness
npm run test:validate-environment

# Check production guards status
curl -H "X-API-Key: $KEY" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/guards/status"
```

#### **Local Development Setup**
```bash
# Set development environment
export NODE_ENV=development

# Use dev tsconfig
npm run build:dev

# Run with mock prevention warnings (not failures)
./test-mock-prevention-scan.sh quick
```

---

## 📊 **Monitoring and Observability**

### **Synthetic Monitoring**
```bash
# Run full synthetic monitoring
./test-synthetic-monitoring-html.sh

# Monitor specific endpoints
BASE_URL="https://staging.tft-trading-system.workers.dev" \
  ./test-synthetic-monitoring-html.sh
```

**Monitoring Checks:**
- ✅ HTML structure and DOCTYPE
- ✅ Content-Type headers (text/html)
- ✅ Response time thresholds (<2s)
- ✅ Content size validation
- ✅ No error indicators in content

### **SLO Dashboard Access**
```bash
# Get current SLO status for all endpoints
curl -H "X-API-Key: $KEY" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/slo/status"

# Get recent alerts
curl -H "X-API-Key: $KEY" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/slo/alerts"
```

### **Health Check Endpoints**
```bash
# System health
curl "https://tft-trading-system.yanggf.workers.dev/api/v1/data/health"

# Cache health
curl "https://tft-trading-system.yanggf.workers.dev/api/v1/cache/health"

# Production guards status
curl -H "X-API-Key: $KEY" \
  "https://tft-trading-system.yanggf.workers.dev/api/v1/guards/status"
```

---

## 🚨 **Incident Response**

### **Production Issues**
1. **Immediate Actions**:
   - Check SLO dashboard for alerts
   - Run synthetic monitoring
   - Verify HTML endpoints accessibility

2. **Rollback Decision**:
   - If multiple endpoints failing → rollback immediately
   - If single endpoint failing → consider canary disable

3. **Communication**:
   - Alert stakeholders immediately
   - Provide ETA for resolution
   - Document root cause post-incident

### **Build Failures**
1. **Mock Detection Failures**:
   ```bash
   # Identify specific violations
   ./test-mock-prevention-scan.sh full

   # Fix with exemptions or real implementation
   # Re-run validation
   npm run verify
   ```

2. **TypeScript Compilation**:
   ```bash
   # Check production build
   npm run build:prod

   # Fix path alias issues
   # Update imports to use production-safe paths
   ```

### **Escalation Procedures**
- **Level 1**: Development team (15 min response)
- **Level 2**: Engineering lead (5 min response)
- **Level 3**: DevOps on-call (2 min response)

---

## 📚 **References**

### **Key Files**
- `test-mock-prevention-scan.sh` - Local mock prevention
- `rollback-production.sh` - Emergency rollback
- `PRODUCTION_GUARDS_HANDBOOK.md` - This document
- `.github/workflows/build-time-mock-prevention.yml` - CI gates

### **Configuration Files**
- `tsconfig.prod.json` - Production TypeScript config
- `tsconfig.dev.json` - Development TypeScript config
- `src/guards/no-mock-stub.ts` - Production guard stubs
- `src/modules/canary-toggle.ts` - Canary management

### **API Endpoints**
- `GET /api/v1/canary/status` - Canary status
- `POST /api/v1/canary/enable` - Enable canary
- `POST /api/v1/canary/disable` - Disable canary
- `GET /api/v1/guards/status` - Guards status
- `GET /api/v1/slo/status` - SLO metrics

---

## 🔄 **Change Management**

### **Updating This Handbook**
1. All changes must be reviewed by engineering lead
2. Update version number and date
3. Test all commands and procedures
4. Update CI/CD if new validation added

### **Guard Policy Updates**
1. Review banned patterns quarterly
2. Update thresholds based on production metrics
3. Add new endpoints to monitoring
4. Test new policies in staging first

---

**End of Handbook** 📖

For urgent issues, contact the on-call engineering team immediately.