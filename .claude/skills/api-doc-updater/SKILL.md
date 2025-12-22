---
name: api-doc-updater
description: Automatically updates API documentation when new endpoints are added or modified in src/routes/. Use this skill after creating/modifying route files to keep CLAUDE.md and API docs in sync.
allowed-tools: Read, Grep, Edit, Glob, Bash
---

# API Documentation Updater

## Purpose
Maintains accurate API documentation in `CLAUDE.md` and related docs by automatically detecting new or modified endpoints and updating documentation with proper formatting, security annotations, and response examples.

## When Claude Should Use This Skill

**Automatically invoke this skill when:**
- User adds new route files or modifies existing routes in `src/routes/`
- User creates new API endpoints with handlers
- User modifies endpoint responses or parameters
- User asks to "update API docs" or "document the new endpoint"
- After implementing features that expose new API functionality

## Supporting Documentation

**IMPORTANT**: Before starting, read these supporting files for complete context:

1. **[CLAUDE.md](CLAUDE.md)** - Project-specific context
   - Route file patterns and locations
   - Documentation file structure
   - API architecture and authentication model
   - Existing endpoint catalog

2. **[AGENT.md](AGENT.md)** - Agent behavior and detailed processes
   - Step-by-step workflow
   - Decision-making guidelines
   - Error handling procedures
   - Quality standards and best practices

These files provide essential context that complements the instructions below.

## Instructions

### 1. Detect Route Changes

First, scan for route definitions across the codebase:

```bash
# Find all route files
find src/routes -name "*-routes.ts" -type f

# Search for route handler patterns
grep -r "router\." src/routes/ --include="*.ts"
grep -r "app\.(get|post|put|delete|patch)" src/routes/ --include="*.ts"
```

### 2. Extract Endpoint Details

For each route file, extract:
- **HTTP Method**: GET, POST, PUT, DELETE, PATCH
- **Path**: Full endpoint path (e.g., `/api/v1/reports/daily/:date`)
- **Parameters**: Path params, query params, body schema
- **Authentication**: Whether X-API-KEY required
- **Response Structure**: Return type and example
- **Description**: Purpose and functionality

**Example patterns to look for:**
```typescript
router.get('/api/v1/category/action', async (request, env) => {
  // Extract: GET /api/v1/category/action
})

// Look for authentication checks
const apiKey = request.headers.get('X-API-KEY')
// Mark as 🔒 PROTECTED
```

### 3. Categorize Endpoints

Organize endpoints by category based on route file:
- `report-routes.ts` → Reports (6 endpoints)
- `sentiment-routes.ts` → Sentiment Analysis (8 endpoints)
- `data-routes.ts` → Data Access (12 endpoints)
- `dashboard-routes.ts` → Business Intelligence Dashboard (5 endpoints)
- `enhanced-cache-routes.ts` → Enhanced Cache (7 endpoints)
- `security-routes.ts` → Security & Monitoring (3 endpoints)
- Other route files → Appropriate categories

### 4. Update CLAUDE.md

Locate the "API v1 - RESTful Architecture" section in `CLAUDE.md` and update:

**Format for each category:**
```markdown
#### Category Name (X endpoints)
```bash
GET /api/v1/category/action        # Description
POST /api/v1/category/create       # Description 🔒 PROTECTED
GET /api/v1/category/:id           # Description with param
# + X additional
```
```

**Security annotations:**
- Add `🔒 PROTECTED` for endpoints requiring authentication
- Add `⭐ NEW` for newly added endpoints (temporary, remove after deployment)
- Add `⭐ FIXED` for recently fixed endpoints (temporary)
- Add `⚠️ DEPRECATED` for endpoints being phased out

### 5. Update Additional Documentation

Check and update these files if they exist:
- `docs/DASHBOARD_API_DOCUMENTATION.md` - Detailed API reference
- `docs/API_CHANGELOG.md` - API version history
- `README.md` - High-level API overview

### 6. Validate Documentation Quality

Before completing, verify:
- ✅ All endpoints have descriptions
- ✅ Protected endpoints marked with 🔒
- ✅ Path parameters clearly indicated (`:param`)
- ✅ Categories have accurate endpoint counts
- ✅ Formatting matches existing style
- ✅ No duplicate entries
- ✅ Examples provided for complex endpoints

### 7. Generate Summary Report

Output a summary of changes:
```markdown
## API Documentation Update Summary

**New Endpoints Added:**
- GET /api/v1/new/endpoint - Description

**Modified Endpoints:**
- POST /api/v1/existing/endpoint - Updated response format

**Documentation Updated:**
- CLAUDE.md - Section "API v1 - RESTful Architecture"
- docs/DASHBOARD_API_DOCUMENTATION.md

**Total Endpoints Documented:** XX
```

## Special Handling

### Dashboard Routes (Phase 3+)
```bash
GET /api/v1/dashboard/metrics         # Operational health & KPIs
GET /api/v1/dashboard/economics       # Cost-to-serve intelligence
GET /api/v1/dashboard/guards          # Guard violation monitoring
```

### Enhanced Cache Routes
```bash
GET /api/v1/cache/health              # Cache health monitoring
GET /api/v1/cache/metrics             # Performance metrics
POST /api/v1/cache/promote            # Manual cache promotion
```

### Security Routes (Admin Only)
```bash
GET /api/v1/security/status           # Security system status 🔒 PROTECTED
POST /api/v1/security/test-auth       # Test authentication 🔒 PROTECTED
```

## Error Handling

If encountering issues:
- **Route file not found**: Verify path and search alternative patterns
- **Ambiguous endpoint**: Ask user for clarification on purpose
- **Documentation section missing**: Create new section with proper formatting
- **Conflicting documentation**: Present both versions and ask user which is correct

## Example Usage Scenarios

### Scenario 1: New Dashboard Endpoint Added
```
User adds: src/routes/dashboard/analytics-routes.ts
Skill detects: GET /api/v1/dashboard/analytics
Skill updates: CLAUDE.md with new endpoint in Dashboard category
Skill outputs: "Added 1 new dashboard endpoint to documentation"
```

### Scenario 2: Security Annotation Missing
```
Skill detects: Endpoint checks X-API-KEY but not marked 🔒
Skill updates: Adds 🔒 PROTECTED annotation
Skill outputs: "Updated security annotations for 3 endpoints"
```

### Scenario 3: Bulk Route Migration
```
User refactors: Moves 10 endpoints from legacy to API v1
Skill updates: Reorganizes documentation, updates counts
Skill outputs: Summary table of migrated endpoints
```

## Success Criteria

Documentation update is complete when:
1. All new/modified endpoints are documented
2. Security annotations are accurate
3. Endpoint counts match actual implementation
4. Format is consistent with existing documentation
5. No broken references or outdated information
6. User can navigate to any endpoint via documentation

## Notes

- Preserve existing formatting and style
- Never remove undocumented endpoints without user confirmation
- Maintain chronological order (newest marked ⭐ NEW)
- Keep "Core Endpoints (65+ Total)" count accurate
- Update "Last Updated" timestamp in CLAUDE.md when making changes
