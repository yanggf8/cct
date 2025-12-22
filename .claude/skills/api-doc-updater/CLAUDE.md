# API Documentation Updater - Claude Code Integration

## Purpose
This skill automatically maintains API documentation in sync with route implementations. It scans route files, extracts endpoint details, and updates documentation with proper formatting and security annotations.

## When to Use
- After creating/modifying route files in `src/routes/`
- When adding new API endpoints
- When updating endpoint responses or authentication
- When user requests "update API docs" or similar

## Project Context

### Target Documentation Files
- `CLAUDE.md` - Main project documentation with API endpoint catalog
- `docs/DASHBOARD_API_DOCUMENTATION.md` - Detailed API reference
- `docs/API_CHANGELOG.md` - Version history
- `README.md` - High-level overview

### Route File Patterns
```
src/routes/
├── report-routes.ts          # Reports (6 endpoints)
├── sentiment-routes.ts       # Sentiment Analysis (8 endpoints)
├── data-routes.ts            # Data Access (12 endpoints)
├── dashboard/
│   └── dashboard-routes.ts   # Business Intelligence (5 endpoints)
├── enhanced-cache-routes.ts  # Cache management (7 endpoints)
├── security-routes.ts        # Security & monitoring (3 endpoints)
└── admin/
    ├── canary-routes.ts      # Canary rollouts (5 endpoints)
    └── exemptions-routes.ts  # Exception management (6 endpoints)
```

### Endpoint Documentation Format
```markdown
#### Category Name (X endpoints)
```bash
GET /api/v1/category/action        # Description
POST /api/v1/category/create       # Description 🔒 PROTECTED
GET /api/v1/category/:id           # Description with param
# + X additional
```
```

### Security Annotations
- `🔒 PROTECTED` - Requires X-API-KEY authentication
- `⭐ NEW` - Recently added endpoint (temporary marker)
- `⭐ FIXED` - Recently fixed endpoint (temporary marker)
- `⚠️ DEPRECATED` - Being phased out

## API Architecture

### RESTful Design Principles
- **Version prefix**: All endpoints under `/api/v1/`
- **Resource-based paths**: `/api/v1/resource/action`
- **Standard HTTP methods**: GET (read), POST (create/action), PUT (update), DELETE (remove)
- **Consistent responses**: JSON format with error handling

### Authentication Model
```typescript
// Protected endpoints check header
const apiKey = request.headers.get('X-API-KEY');
if (!apiKey || apiKey !== env.X_API_KEY) {
  return new Response('Unauthorized', { status: 401 });
}
```

### Route Handler Patterns
```typescript
// Standard GET endpoint
router.get('/api/v1/resource/:id', async (request, env) => {
  const { id } = request.params;
  const data = await fetchData(id, env);
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Protected POST endpoint
router.post('/api/v1/resource/action', async (request, env) => {
  // Authentication check
  const apiKey = request.headers.get('X-API-KEY');
  if (!apiKey) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const result = await performAction(body, env);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

## Workflow Integration

### Automatic Invocation
Claude Code will automatically use this skill when:
1. Detecting changes in `src/routes/**/*.ts` files
2. User adds new router methods (`.get()`, `.post()`, etc.)
3. User explicitly asks to update API documentation
4. After implementing features with API endpoints

### Manual Invocation
```bash
# User can explicitly request:
"Update the API documentation"
"Document the new endpoint I added"
"Sync API docs with route changes"
```

## Quality Standards

### Documentation Requirements
- ✅ All endpoints have clear descriptions
- ✅ Protected endpoints marked with 🔒
- ✅ Path parameters indicated with `:param`
- ✅ Category endpoint counts accurate
- ✅ Consistent formatting across all docs
- ✅ No duplicate entries
- ✅ Examples for complex endpoints

### Validation Checklist
Before completing documentation updates:
1. All new/modified endpoints documented
2. Security annotations accurate
3. Endpoint counts match implementation
4. Format consistent with existing docs
5. No broken references
6. User can navigate to endpoints easily

## System Integration

### Cache System
- **DO Cache**: Durable Objects for persistent memory (<1ms)
- **Enhanced Cache**: Multi-layer caching strategy
- **Cache Routes**: 7 endpoints for cache management

### Security System
- **Enterprise Auth**: Multi-tier rate limiting
- **Active Protection**: Brute force prevention
- **Security Routes**: 3 protected endpoints

### Business Intelligence
- **Dashboard Routes**: 5 endpoints for BI
- **Cost Intelligence**: Real-time cost analysis
- **Guard Monitoring**: Violation tracking

## Tools & Permissions

### Allowed Tools
- `Read` - Read route files and documentation
- `Grep` - Search for route patterns
- `Edit` - Update documentation files
- `Glob` - Find route files
- `Bash` - Execute search commands

### File Permissions
- **Read**: All files in `src/routes/` and `docs/`
- **Write**: Documentation files only (`CLAUDE.md`, `docs/*.md`)
- **No modification**: Route implementation files (read-only)

## Success Metrics

### Documentation Quality
- 100% endpoint coverage
- <1 minute update time
- Zero documentation drift
- Consistent formatting
- Accurate security annotations

### User Experience
- No manual documentation needed
- Automatic sync after route changes
- Clear, navigable endpoint catalog
- Up-to-date API reference

---

**Skill Type**: Documentation Automation
**Target Platform**: Claude Code
**Compatibility**: Works with any RESTful API project
**Maintenance**: Auto-updates with route file changes
