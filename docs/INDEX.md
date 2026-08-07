# Documentation Index

## Overview
This index points to active documentation in `docs/` and highlights archived material. For system-level policies and assistant guidance, see `AGENTS.md` and `CLAUDE.md` at repo root.

**Last Updated**: 2026-08-07

## Quick Start
| Document | Purpose |
|----------|---------|
| `../README.md` | Project overview and development entry points |
| `../API_DOCUMENTATION.md` | API map and access patterns |
| `../AGENTS.md` | Agent and repo policies |
| `../CLAUDE.md` | Assistant context and conventions |

## Guides (`docs/guides/`)
| Document | Description |
|----------|-------------|
| `guides/USER_GUIDE.md` | End-user dashboard usage |
| `guides/DEPLOYMENT_GUIDE.md` | Deployment procedures |
| `guides/MAINTENANCE_GUIDE.md` | Operations, monitoring, troubleshooting |

## Architecture (`docs/architecture/`)
| Document | Description |
|----------|-------------|
| `architecture/SYSTEM_FEATURES.md` | Feature catalog and capabilities |
| `architecture/AI_SENTIMENT_ACCURACY_PLATFORM_SPEC.md` | Sentiment analysis spec |
| `architecture/SECTOR_ROTATION_DATA_PIPELINE.md` | Sector rotation architecture |
| `architecture/NEWS_PROVIDER_ERROR_HANDLING_SPEC.md` | News provider error handling |
| `architecture/PROVIDER_ERROR_CONTRACT.md` | Provider error contracts |
| `architecture/DATA_ACCESS_IMPROVEMENT_PLAN.md` | Data access modernization |
| `architecture/SENTIMENT_ANALYSIS_DETAILS.md` | Sentiment analysis details |

## Operations (`docs/operations/`)
| Document | Description |
|----------|-------------|
| `operations/ops-playbooks.md` | Operational runbooks |
| `operations/SECURITY_DEPLOYMENT_GUIDE.md` | Security deployment procedures |
| `operations/SECURITY_VALIDATION_CHECKLIST.md` | Security validation checklist |
| `operations/STRICT_MODE_DEPLOYMENT_GUIDE.md` | Strict mode deployment |
| `operations/SECURITY_TEST_COVERAGE_ANALYSIS.md` | Security test coverage |
| `operations/FINAL_SECURITY_IMPLEMENTATION_REPORT.md` | Security implementation report |
| `operations/FRONTEND_SECURITY_ANALYSIS.md` | Frontend security analysis |

## Integrations (`docs/integrations/`)
| Document | Description |
|----------|-------------|
| `integrations/D1_MIGRATION_PLAN.md` | D1 database migration plan |
| `integrations/CORROBORATION_LIVE_DATA_REPLACEMENT.md` | Live data replacement |
| `integrations/FMP_API_KEY_CONFIGURED.md` | FMP API configuration |

## Reference (`docs/reference/`)
| Document | Description |
|----------|-------------|
| `reference/CHANGELOG.md` | Project changelog |
| `reference/PROJECT_STATUS_OVERVIEW.md` | Current project status |
| `reference/DUAL_MODEL_PIPELINE_PLAN.md` | Dual-model pipeline objectives |
| `reference/DUAL_MODEL_PIPELINE_IMPLEMENTATION.md` | Dual-model storage and reporting |
| `reference/KV_BINDING_FIX.md` | KV binding fix reference |
| `reference/NAVIGATION_REDESIGN.md` | Navigation redesign notes |
| `reference/NAVIGATION_UPDATE.md` | Navigation update notes |
| `reference/PRODUCTION_GUARDS_HANDBOOK.md` | Production guards reference |
| `reference/TEST_AND_SCRIPT_INDEX.md` | Test and script index |
| `reference/TEST_ORGANIZATION_PLAN.md` | Test organization plan |
| `reference/GENERATED_DATE_DISPLAY_FIX.md` | Date display fix |

## Specs (`docs/specs/`)
Design records for changes that needed one, newest first:

| Document | Description |
|----------|-------------|
| `specs/2026-08-07-business-date-envelope-design.md` | `metadata.business_date` on every report response, so no reader re-derives the trading day. Implemented on the worker; the consumer skill has not been changed yet |
| `specs/2026-07-28-pre-market-freshness-gate-design.md` | Pre-market skill reports `degraded` on stale D1-fallback snapshots |

## Plans (`docs/superpowers/plans/`)
Task-by-task implementation plans. Each records where execution corrected it,
because a plan that quietly diverges from what shipped is worse than none:

| Document | Description |
|----------|-------------|
| `superpowers/plans/2026-08-07-business-date-envelope.md` | Six tasks putting `metadata.business_date` on every report route. Corrected three times during execution — the intraday content predicate, the weekly clamp, and a timezone-dependent `isTradingDay` |

## Archive (`docs/archive/`)
Archived documents are retained for historical context:
- `archive/changelogs/`
- `archive/analysis/`
- `archive/legacy/`

## Find Docs By Use Case
| I want to... | Start here |
|--------------|------------|
| Use the system | `guides/USER_GUIDE.md` |
| Deploy to production | `guides/DEPLOYMENT_GUIDE.md` |
| Debug or troubleshoot | `guides/MAINTENANCE_GUIDE.md` |
| Understand the API | `../API_DOCUMENTATION.md` |
| Learn the architecture | `architecture/SYSTEM_FEATURES.md` |
| Review security procedures | `operations/SECURITY_DEPLOYMENT_GUIDE.md` |
