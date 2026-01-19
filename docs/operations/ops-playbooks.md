# Operations Playbooks

This document contains incident response playbooks for common operational scenarios in the Trading Intelligence System.

## Table of Contents

1. [Schema Validation Failures](#schema-validation-failures)
2. [Auto-Rollback Incidents](#auto-rollback-incidents)
3. [Canary Deployment Issues](#canary-deployment-issues)
4. [Exemption System Failures](#exemption-system-failures)
5. [Rate Limiting Activation](#rate-limiting-activation)
6. [Chaos Test Failures](#chaos-test-failures)

---

## Schema Validation Failures

### Severity Levels
- **P0**: All schema validation failing, blocking deployments
- **P1**: Partial schema validation failures, warnings in CI
- **P2**: Schema drift warnings, non-breaking changes

### Immediate Response (P0/P1)

**1. Identify the Scope**
```bash
# Check recent deployments
gh run list --workflow="deploy.yml" --limit=10

# Check PR comments for schema validation failures
gh pr list --state open --json number,title,comments | jq '.[] | select(.comments[] | contains("schema validation"))'

# View specific PR comments
gh pr view <PR_NUMBER> --comments
```

**2. Access Validation Artifacts**
```bash
# Download failed workflow artifacts
gh run download <RUN_ID> --name schema-validation-report

# Check validation report
cat schema-validation-report.json | jq '.validation_results'

# View schema file
cat test-summary-schema.json
```

**3. Diagnose the Issue**
```bash
# Validate schema locally
jq empty test-summary-schema.json
jq empty test-summary.json

# Check schema structure
jq '.required' test-summary-schema.json
jq 'has("test_metadata") and has("test_results")' test-summary.json

# Run detailed validation
./ci-schema-validation.sh test-summary-schema.json test-summary.json strict
```

**4. Resolution Strategies**

**Option A: Fix Schema (Recommended)**
```bash
# Update schema to accommodate new fields
vi test-summary-schema.json

# Validate updated schema
./ci-schema-validation.sh test-summary-schema.json test-summary.json warn

# Commit schema fix
git add test-summary-schema.json
git commit -m "fix: Update test summary schema for new fields"
git push
```

**Option B: Fix Test Summary (Quick Fix)**
```bash
# Generate compliant test summary
./generate-test-summary.sh "Test Name" "1.0.0" test-summary.json generate

# Validate generated summary
./ci-schema-validation.sh test-summary-schema.json test-summary.json warn
```

**Option C: Temporarily Bypass (Emergency Only)**
```bash
# Run validation in warn mode instead of strict
./ci-schema-validation.sh test-summary-schema.json test-summary.json warn

# Update workflow to use warn mode temporarily
# Edit .github/workflows/test-summary-schema-validation.yml
```

### Follow-up Actions
- [ ] Document root cause in incident ticket
- [ ] Update test scripts to generate compliant summaries
- [ ] Add additional schema tests if needed
- [ ] Review schema versioning strategy
- [ ] Create backward compatibility policy

### Key Artifacts and Links
- **Schema File**: `test-summary-schema.json`
- **Validation Script**: `ci-schema-validation.sh`
- **Generator Script**: `generate-test-summary.sh`
- **CI Workflow**: `.github/workflows/test-summary-schema-validation.yml`
- **Example Valid Summary**: `test-summary.json`

---

## Auto-Rollback Incidents

### Detection Patterns
- Canary traffic suddenly reduced to 0%
- SLO breach alerts triggered
- Rollback notifications in monitoring
- Increased error rates on canary endpoints

### Immediate Response

**1. Confirm Rollback Status**
```bash
# Check canary status
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/status" | jq

# Check recent rollbacks
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/history?limit=5" | jq

# Check SLO status
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/slo/status" | jq
```

**2. Analyze Rollback Triggers**
```bash
# Check SLO breach logs
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/slo/breaches?hours=1" | jq

# View rollback history
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/rollbacks" | jq

# Check system health
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/data/health" | jq
```

**3. Investigate Root Cause**
```bash
# Check deployment logs
gh run view <DEPLOYMENT_RUN_ID> --log

# Check system metrics
# Access Grafana dashboard: https://grafana.example.com/d/canary-overview

# Review recent code changes
git log --oneline -10
git diff HEAD~1 --name-only
```

### Resolution Pathways

**Option A: Fix and Re-deploy**
```bash
# Fix the issue in code
vi <affected_files>

# Test fix locally
npm run test
npm run build

# Re-deploy with canary
npm run deploy:canary

# Monitor canary performance
./test-slo-breach-simulation.sh latency moderate 10
```

**Option B: Adjust Rollback Thresholds**
```bash
# Access canary configuration
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/config" | jq

# Update thresholds (careful!)
curl -X POST -H "X-API-Key: $X_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slo_thresholds": {
      "p95_latency_ms": 5000,
      "error_rate_percent": 5.0,
      "availability_percent": 95.0
    }
  }' \
  "$CCT_URL/api/v1/canary/config"
```

**Option C: Disable Auto-rollback (Temporary)**
```bash
# Disable auto-rollback
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/disable-auto-rollback"

# Manual re-enable when ready
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/enable-auto-rollback"
```

### Prevention Measures
- [ ] Implement gradual canary rollout
- [ ] Add more SLO metrics
- [ ] Improve rollback notification system
- [ ] Add pre-deployment SLO validation
- [ ] Create canary best practices guide

---

## Canary Deployment Issues

### Common Issues
1. **Traffic Splitting Problems**: Canary not receiving expected traffic
2. **Configuration Errors**: Invalid canary parameters
3. **Performance Degradation**: Canary slower than stable
4. **Feature Flag Conflicts**: Canary features interfering with stable

### Diagnostic Steps
```bash
# 1. Check canary status
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/status" | jq

# 2. Verify traffic distribution
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/metrics" | jq

# 3. Check configuration
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/config" | jq

# 4. Test canary endpoint directly
curl -s -H "X-API-Key: $X_API_KEY" \
  -H "X-Canary-Test: true" \
  "$CCT_URL/api/v1/data/symbols" | jq
```

### Common Fixes
```bash
# Reset canary configuration
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/reset"

# Disable canary
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/disable"

# Promote canary to stable
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/canary/promote"
```

---

## Exemption System Failures

### Detection
- Exemption validation failures
- JIRA integration errors
- Expired exemptions not being processed
- Reports showing incorrect exemption counts

### Investigation Commands
```bash
# Check exemption system status
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/exemptions/health" | jq

# Validate exemptions
curl -X POST -s -H "X-API-Key: $X_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"files": ["src/**/*.ts"]}' \
  "$CCT_URL/api/v1/exemptions/validate" | jq

# Get exemption report
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/exemptions/report" | jq

# Check for expired exemptions
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/exemptions/expired" | jq
```

### Resolution Steps
```bash
# 1. Manually expire old exemptions
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/exemptions/cleanup"

# 2. Re-validate all exemptions
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/exemptions/revalidate"

# 3. Reset exemption system
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/exemptions/reset"

# 4. Test exemption processing
./test-exemption-report-manual.sh
```

---

## Rate Limiting Activation

### Detection
- HTTP 429 responses from admin APIs
- Rate limit headers in responses
- Users reporting access denied
- Monitoring alerts for rate limit events

### Investigation
```bash
# Check rate limit status
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/rate-limit/status" | jq

# View rate limit events
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/rate-limit/events?hours=1" | jq

# Test rate limiting behavior
for i in {1..60}; do
  curl -s -w "%{http_code}" -H "X-API-Key: $X_API_KEY" \
    "$CCT_URL/api/v1/canary/status" | tail -1
done | grep -c "429"
```

### Mitigation
```bash
# Increase rate limits (temporary)
curl -X POST -H "X-API-Key: $X_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "canaryManagement",
    "maxRequests": 100,
    "windowMs": 60000
  }' \
  "$CCT_URL/api/v1/rate-limit/config"

# Clear rate limit data
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/rate-limit/clear"

# Reset specific user limits
curl -X POST -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/rate-limit/reset?user=username"
```

---

## Chaos Test Failures

### When Chaos Tests Fail
1. **System Doesn't Recover**: Recovery validation fails
2. **Monitoring Incomplete**: Alerts not triggered as expected
3. **Degradation Too Severe**: System becomes completely unavailable
4. **False Positives**: Tests fail when system is actually healthy

### Immediate Actions
```bash
# 1. Stop chaos tests (pkill or kill processes)
pkill -f "test-chaos-engineering"

# 2. Check system status
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/data/health" | jq

# 3. Verify core functionality
curl -s -H "X-API-Key: $X_API_KEY" \
  "$CCT_URL/api/v1/data/symbols" | jq '.data[:3]'

# 4. Check recent deployments
gh run list --limit=5 --workflow="deploy.yml"
```

### Investigation
```bash
# Review chaos test logs
tail -100 chaos-test-*.log

# Check chaos parameters
grep "Chaos parameters" chaos-test-*.log

# Validate system recovered
./test-slo-breach-simulation.sh latency mild 5
```

### Fixes and Improvements
```bash
# Adjust chaos test severity
./test-chaos-engineering-staging.sh latency mild 3

# Improve error handling in affected endpoints
vi src/routes/<affected-route>.ts

# Add better monitoring and alerting
# Update monitoring configuration

# Retest with adjusted parameters
./test-chaos-engineering-staging.sh latency moderate 5
```

---

## Contact Information

### Escalation Contacts
- **On-Call Engineer**: [Primary contact details]
- **Engineering Lead**: [Secondary contact details]
- **Product Owner**: [Business contact details]

### External Resources
- **Grafana Dashboards**: https://grafana.example.com
- **Documentation**: https://docs.example.com
- **Runbooks Repository**: https://github.com/example/runbooks

### Communication Channels
- **Incident Slack**: #incidents
- **Engineering Chat**: #engineering
- **Status Page**: https://status.example.com

---

## Post-Incident Review Template

After resolving any incident, complete this review:

1. **Incident Summary**: Brief description of what happened
2. **Timeline**: Key events and timestamps
3. **Impact**: User impact, duration, affected systems
4. **Root Cause**: Primary and contributing factors
5. **Detection**: How was the incident identified?
6. **Resolution**: What was done to fix it?
7. **Prevention**: How to prevent recurrence
8. **Lessons Learned**: Key takeaways for the team
9. **Action Items**: Specific follow-up tasks with owners
10. **Follow-up**: Schedule post-incident review meeting

---

*Last Updated: $(date -u +%Y-%m-%d)*
*Version: 1.0*
*Review Schedule: Quarterly*