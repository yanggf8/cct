# DAC Integration Testing Guide

## 🎯 Overview

This guide provides comprehensive testing procedures for the DAC (Dual AI Capital) Articles Pool integration with the CCT (Climate Crisis Trading) system using Cloudflare Service Bindings.

## 🧪 Test Suites

### 1. Comprehensive Service Binding Tests (`test-dac-service-binding-comprehensive.sh`)

**Purpose**: Full validation of DAC integration through Cloudflare service bindings

**Coverage**:
- System connectivity and health checks
- Durable Objects cache performance
- Service binding configuration verification
- Enhanced sentiment pipeline functionality
- Error handling and validation
- Performance benchmarking
- Data integrity verification

**Usage**:
```bash
# Run full test suite
./test-dac-service-binding-comprehensive.sh run

# Run quick integration checks
./test-dac-service-binding-comprehensive.sh quick

# Create baseline for regression testing
./test-dac-service-binding-comprehensive.sh baseline
```

### 2. Integration Test (`test-dac-integration.sh`)

**Purpose**: Basic DAC integration validation

**Coverage**:
- DAC backend health
- CCT system health
- Article pool access
- Cache performance

**Usage**:
```bash
./test-dac-integration.sh
```

### 3. Regression Test System

**Purpose**: Prevent performance and functionality regressions

**Features**:
- Baseline comparison
- Performance trend tracking
- Automated failure detection
- HTML report generation

## 🔧 Test Configuration

### Environment Variables (Updated 2025-01-XX)

```bash
# Required - Set your API key first
export X_API_KEY=your_api_key_here

# Optional - Override defaults
export CCT_URL="https://tft-trading-system.yanggf.workers.dev"  # Default: same
export DAC_URL="https://dac-backend.yanggf.workers.dev"       # Default: same

# For GitHub Actions
# Secret name: X_API_KEY
# Value: your_production_api_key

# Validation example
curl -H "X-API-Key: $X_API_KEY" "https://tft-trading-system.yanggf.workers.dev/api/v1/health"
```

### Test Dependencies

```bash
# Install required tools
sudo apt-get update
sudo apt-get install -y curl jq bc

# Verify installation
curl --version
jq --version
bc --version
```

## 🚀 Running Tests

### Local Development

```bash
# Quick validation
./test-dac-service-binding-comprehensive.sh quick

# Full test suite
./test-dac-service-binding-comprehensive.sh run

# With custom URL
CCT_URL="http://localhost:8787" ./test-dac-service-binding-comprehensive.sh run
```

### CI/CD Pipeline

The tests automatically run in GitHub Actions for:

1. **Push to main/master**: Full test suite + deployment validation
2. **Pull requests**: Integration tests + security scan
3. **Daily schedule**: Regression checks
4. **Manual trigger**: Custom test selection

### Test Results

Results are stored in:
- **Reports**: `test-reports/dac-service-binding-test-<timestamp>.json`
- **Baselines**: `baselines/dac-service-binding-baseline.json`
- **Logs**: `test-reports/dac-service-binding-test-<timestamp>.json.log`

## 📊 Test Categories

### 1. Connectivity Tests

Validate system availability and basic functionality:

```bash
# CCT system health
curl -s "$CCT_URL/api/v1/data/health" | jq .

# DAC backend health
curl -s "$DAC_URL/api/health" | jq .

# Cache system health
curl -s "$CCT_URL/api/v1/cache/health" | jq .
```

### 2. Service Binding Tests

Verify Cloudflare service binding integration:

```bash
# Enhanced sentiment health (uses service binding - exercises DAC binding)
curl -s "$CCT_URL/api/v1/sentiment/health" | jq .

# Configuration check
curl -s "$CCT_URL/api/v1/sentiment/config" | jq .

# Service binding latency measurement (p50/p95 analysis)
./test-dac-service-binding-comprehensive.sh quick | grep "Service binding latency"
```

### 3. Performance Tests

Measure response times and cache efficiency:

```bash
# Single request performance
time curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $X_API_KEY" \
  -d '{"symbol":"AAPL","use_dac_integration":true}' \
  "$CCT_URL/api/v1/sentiment/enhanced"

# Cache performance test
for i in {1..5}; do
  curl -s "$CCT_URL/api/v1/data/symbols" >/dev/null
done
```

### 4. Error Handling Tests

Validate proper error responses:

```bash
# Invalid API key
curl -s -X POST \
  -H "X-API-Key: invalid_key" \
  -d '{"symbol":"AAPL"}' \
  "$CCT_URL/api/v1/sentiment/enhanced"

# Invalid symbol format
curl -s -X POST \
  -H "X-API-Key: $X_API_KEY" \
  -d '{"symbol":"INVALID123"}' \
  "$CCT_URL/api/v1/sentiment/enhanced"

# Missing required fields
curl -s -X POST \
  -H "X-API-Key: $X_API_KEY" \
  -d '{"use_dac_integration":true}' \
  "$CCT_URL/api/v1/sentiment/enhanced"
```

### 5. Data Integrity Tests

Ensure response format and data quality:

```bash
# Test single symbol analysis
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $X_API_KEY" \
  -d '{"symbol":"AAPL","use_dac_integration":true}' \
  "$CCT_URL/api/v1/sentiment/enhanced")

# Validate JSON structure
echo "$response" | jq .

# Check required fields
echo "$response" | jq -e '.success'
echo "$response" | jq -e '.data'
echo "$response" | jq -e '.metadata'
```

## 🎯 Performance Benchmarks

### Target Metrics (Updated 2025-01-XX)

| Metric | Target | Acceptable |
|--------|--------|------------|
| **Success Rate** | ≥ 95% | ≥ 90% |
| **Single Request** | < 2s | < 5s |
| **Cache Hit Rate** | ≥ 93% | ≥ 90% |
| **Concurrent Requests** | < 2s avg | < 5s avg |
| **Service Binding Latency** | p50 < 100ms | p95 < 200ms |
| **Regression Threshold** | ≤ 5% degradation | ≤ 10% degradation |

### Performance Monitoring

```bash
# Real-time monitoring
wrangler tail --format=pretty --search="DAC_ARTICLES_POOL|service_binding"

# Performance metrics extraction
jq -r '.performance_metrics | map(select(.test | contains("DAC"))) | .duration_ms' test-reports/*.json
```

## 🔍 Regression Detection

### Baseline Creation

```bash
# Create performance baseline
./test-dac-service-binding-comprehensive.sh baseline

# View baselines
ls -la baselines/
```

### Regression Checks (Updated 2025-01-XX)

The system automatically detects and FAILS on regressions:

1. **Success Rate**: Drops > 5% from baseline (FAILS)
2. **Cache Hit Rate**: Below 93% threshold (FAILS)
3. **Service Binding Latency**: p50 ≥ 100ms (FAILS), p95 ≥ 200ms (FAILS)
4. **Functionality**: Previously passing tests start failing

### Manual Regression Testing

```bash
# Create baseline (new workflow)
./test-dac-service-binding-comprehensive.sh baseline

# Compare with named baseline (enforces 5% regression failure)
./run-regression-tests.sh compare baseline_name

# List available baselines (shows active CI baseline)
./run-regression-tests.sh list

# Generate regression report
./run-regression-tests.sh compare v1.0
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Service Binding Not Available

**Symptoms**:
```
WARNING: DAC backend service binding not available
```

**Solutions**:
1. Check `wrangler.toml` configuration
2. Verify DAC backend deployment
3. Validate service binding entrypoint

```bash
# Check service binding configuration
grep -A5 "services\|DAC_BACKEND" wrangler.toml

# Verify DAC backend is deployed
curl -s "$DAC_URL/api/health"
```

#### 2. Test Failures Due to Deployment

**Symptoms**:
```
FAIL: Enhanced sentiment analysis failed for AAPL
```

**Solutions**:
1. Wait for deployment propagation (2-3 minutes)
2. Check deployment logs
3. Verify environment variables

```bash
# Check deployment status
wrangler deployments list

# Wait for propagation
sleep 120
./test-dac-service-binding-comprehensive.sh quick
```

#### 3. Performance Issues

**Symptoms**:
```
WARNING: Average performance > 2000ms target
```

**Solutions**:
1. Check Durable Objects cache health
2. Monitor DAC backend performance
3. Verify service binding efficiency

```bash
# Check cache performance
curl -s "$CCT_URL/api/v1/cache/health" | jq .assessment

# Monitor DAC performance
curl -s "$DAC_URL/api/health" | jq .data.services
```

### Debug Mode

Enable detailed logging:

```bash
# Enable verbose test output
DEBUG=1 ./test-dac-service-binding-comprehensive.sh run

# Monitor real-time logs
wrangler tail --format=pretty

# Check system health
curl -s "$CCT_URL/api/v1/data/health" | jq .
```

## 📈 Continuous Improvement

### Test Coverage Enhancement

To add new tests:

1. **Add test function** to `test-dac-service-binding-comprehensive.sh`
2. **Update performance benchmarks** in documentation
3. **Add regression checks** for new functionality
4. **Update CI/CD pipeline** if needed

### Metrics to Track

1. **Test Success Rate**: Overall test reliability
2. **Performance Trends**: Response time changes over time
3. **Error Rates**: Frequency and types of errors
4. **Coverage Gaps**: Missing functionality tests

### Automated Improvements

```bash
# Set up automatic baseline updates
./test-dac-service-binding-comprehensive.sh baseline

# Schedule regular regression tests
echo "0 6 * * * cd /path/to/cct && ./test-dac-service-binding-comprehensive.sh run" | crontab -
```

## 📞 Support

### Getting Help

1. **Check test logs**: `test-reports/*.log`
2. **Review performance reports**: `test-reports/*.json`
3. **Consult CI/CD logs**: GitHub Actions tab
4. **Monitor system health**: `wrangler tail`

### Contact Information

- **GitHub Issues**: Report test failures
- **Documentation**: This guide and code comments
- **Slack/Discord**: Real-time support channels

---

**Last Updated**: $(date)
**Test Suite Version**: 1.0.0
**Compatibility**: Cloudflare Workers, DAC Backend v3.5+