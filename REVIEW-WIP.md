# WIP Review Notes

## Blocking Findings
- `src/modules/enhanced-request-handler.ts:296-299` – Still reading env keys via `(this as any).envAPI_KEYS` / `envX_API_KEY`. Those properties do not exist, so valid API keys are rejected and `/api/v1/results` always returns 401.
- `src/modules/api-health-monitor.ts:118` – Uses `(this as any).optionsenableAutoChecks`; missing dot prevents scheduled health checks from ever starting.
- `src/modules/api-health-monitor.ts:201` – Same missing dot on `options.enableAlerts`; alerts never emit even when alerting is configured.
- `src/modules/api-health-monitor.ts:568-575` – Accesses `healthCheckssize` and `healthChecksforEach`; this throws when `getCurrentHealth()` runs, breaking any consumer that expects a cached status.

## Logging/Telemetry Regression
- `src/modules/api-health-monitor.ts:195-196` – Logging references `systemMetricshealthyAPIs` / `systemMetricstotalAPIs`, so metrics emit as `undefined`. Restore the dotted accessors to keep logs meaningful.
