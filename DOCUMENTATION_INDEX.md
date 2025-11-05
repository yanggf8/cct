# 📚 Documentation Index

**Last Updated**: 2025-01-XX  
**Status**: Current and maintained

---

## 🎯 Quick Start

**New to the project?** Start here:
1. [README.md](README.md) - Project overview and features
2. [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - How to deploy
3. [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md) - How caching works
4. [docs/SYSTEM_FEATURES.md](docs/SYSTEM_FEATURES.md) - What the system does

---

## 📖 Core Documentation

### **System Overview**
- [README.md](README.md) - Main project documentation
- [docs/PROJECT_STATUS_OVERVIEW.md](docs/PROJECT_STATUS_OVERVIEW.md) - Current status and roadmap
- [docs/SYSTEM_FEATURES.md](docs/SYSTEM_FEATURES.md) - Complete feature list

### **Deployment & Setup**
- [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Production deployment guide
- [docs/DEPLOYMENT_AND_SETUP_GUIDE.md](docs/DEPLOYMENT_AND_SETUP_GUIDE.md) - Detailed setup instructions
- [docs/MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md) - Ongoing maintenance procedures

### **Architecture & Implementation**
- [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md) - Cache system architecture
- [docs/SECTOR_CACHE_IMPLEMENTATION.md](docs/SECTOR_CACHE_IMPLEMENTATION.md) - Sector-specific caching
- [docs/SECTOR_ROTATION_DATA_PIPELINE.md](docs/SECTOR_ROTATION_DATA_PIPELINE.md) - Sector rotation pipeline
- [docs/SENTIMENT_ANALYSIS_DETAILS.md](docs/SENTIMENT_ANALYSIS_DETAILS.md) - AI sentiment analysis
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API endpoint reference

### **User Guides**
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) - End-user documentation
- [docs/DASHBOARD_IMPLEMENTATION_GUIDE.md](docs/DASHBOARD_IMPLEMENTATION_GUIDE.md) - Dashboard usage

---

## 🔧 Technical Documentation

### **Recent Improvements (2025-01)**
- [CACHE_SIMPLIFICATION_SUMMARY.md](CACHE_SIMPLIFICATION_SUMMARY.md) - Complete cache simplification journey
- [CACHE_SIMPLIFICATION_COMPLETE.md](CACHE_SIMPLIFICATION_COMPLETE.md) - Feature flag removal details
- [CACHE_FUNCTION_SIMPLIFICATION_COMPLETE.md](CACHE_FUNCTION_SIMPLIFICATION_COMPLETE.md) - Helper function removal
- [MCODE_AUDIT_VALIDATION_REPORT.md](MCODE_AUDIT_VALIDATION_REPORT.md) - Architecture audit validation

### **TypeScript Migration (2024)**
- [TYPESCRIPT_MIGRATION_COMPLETE.md](TYPESCRIPT_MIGRATION_COMPLETE.md) - Migration summary
- [TYPESCRIPT_FIX_REVIEW.md](TYPESCRIPT_FIX_REVIEW.md) - Fix review
- [TYPESCRIPT_ERROR_FIX_ACCURATE_REVIEW.md](TYPESCRIPT_ERROR_FIX_ACCURATE_REVIEW.md) - Detailed review
- [TYPESCRIPT_FIXING_PROGRESS.md](TYPESCRIPT_FIXING_PROGRESS.md) - Progress tracking

### **Testing**
- [docs/TEST_COVERAGE_ANALYSIS_2025.md](docs/TEST_COVERAGE_ANALYSIS_2025.md) - Test coverage report
- [playwright.config.js](playwright.config.js) - Playwright configuration

### **External Integrations**
- [README-DO-INTEGRATION.md](README-DO-INTEGRATION.md) - Durable Objects integration
- [SECTOR_API_USAGE.md](SECTOR_API_USAGE.md) - Sector API documentation

---

## 📦 Archive

### **Historical Documentation**
Located in `archive/historical-documentation/`:
- Cache metrics enhancements (2024)
- Console error fixes (2024)

### **Obsolete Documentation**
Located in `archive/obsolete-docs/`:
- Legacy cache implementations
- Old KV cache validation reports
- Superseded architecture docs
- Migration reports (completed)

### **Legacy Code**
Located in `archive/legacy-js-modules/`:
- Pre-TypeScript JavaScript implementations
- Backup files from migration

---

## 🎯 Documentation by Role

### **For Developers**

**Getting Started:**
1. [README.md](README.md) - Understand the project
2. [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Set up development environment
3. [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md) - Learn the cache system

**Working on Features:**
1. [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API endpoints
2. [docs/SYSTEM_FEATURES.md](docs/SYSTEM_FEATURES.md) - Existing features
3. [docs/SENTIMENT_ANALYSIS_DETAILS.md](docs/SENTIMENT_ANALYSIS_DETAILS.md) - AI implementation

**Debugging:**
1. [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md) - Cache debugging
2. [docs/MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md) - Troubleshooting

---

### **For DevOps/SREs**

**Deployment:**
1. [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) - Production deployment
2. [docs/DEPLOYMENT_AND_SETUP_GUIDE.md](docs/DEPLOYMENT_AND_SETUP_GUIDE.md) - Detailed setup

**Monitoring:**
1. [docs/MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md) - Monitoring procedures
2. [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Health check endpoints

**Architecture:**
1. [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md) - Cache architecture
2. [CACHE_SIMPLIFICATION_SUMMARY.md](CACHE_SIMPLIFICATION_SUMMARY.md) - Recent changes

---

### **For Product Managers**

**Project Status:**
1. [README.md](README.md) - Feature overview
2. [docs/PROJECT_STATUS_OVERVIEW.md](docs/PROJECT_STATUS_OVERVIEW.md) - Current status
3. [docs/SYSTEM_FEATURES.md](docs/SYSTEM_FEATURES.md) - Complete feature list

**User Experience:**
1. [docs/USER_GUIDE.md](docs/USER_GUIDE.md) - End-user documentation
2. [docs/DASHBOARD_IMPLEMENTATION_GUIDE.md](docs/DASHBOARD_IMPLEMENTATION_GUIDE.md) - Dashboard features

---

### **For End Users**

**Using the System:**
1. [docs/USER_GUIDE.md](docs/USER_GUIDE.md) - Complete user guide
2. [docs/DASHBOARD_IMPLEMENTATION_GUIDE.md](docs/DASHBOARD_IMPLEMENTATION_GUIDE.md) - Dashboard usage
3. [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference (for advanced users)

---

## 🔄 Documentation Maintenance

### **Updating Documentation**

1. **When making code changes:**
   - Update relevant documentation
   - Add entries to this index if creating new docs
   - Move superseded docs to archive

2. **When archiving documentation:**
   - Move to appropriate archive folder
   - Update this index
   - Keep a note in the archive README

3. **Documentation standards:**
   - Use Markdown format
   - Include "Last Updated" date
   - Add clear section headings
   - Include code examples where relevant
   - Cross-reference related docs

### **Archive Structure**

```
archive/
├── historical-documentation/   # Completed features, kept for reference
│   ├── CACHE_METRICS_ENHANCEMENT.md
│   └── README.md
├── obsolete-docs/             # Superseded documentation
│   ├── CACHE_AUDIT_REPORT.md
│   ├── KV_CACHE_*.md
│   └── README.md
├── legacy-js-modules/         # Pre-TypeScript code
│   ├── analysis.js
│   └── README.md
└── obsolete-scripts/          # Old test/utility scripts
    └── cache-tests/
        └── README.md
```

---

## 📊 Documentation Status

### **Current & Maintained** ✅

| Document | Status | Last Updated | Maintainer |
|----------|--------|--------------|------------|
| README.md | ✅ Current | 2025-01-XX | Core Team |
| CACHEMANAGER_EXPLAINED.md | ✅ Current | 2025-01-XX | Core Team |
| docs/DEPLOYMENT_GUIDE.md | ✅ Current | 2025-01-XX | DevOps |
| docs/SYSTEM_FEATURES.md | ✅ Current | 2024 | Core Team |
| API_DOCUMENTATION.md | ✅ Current | 2024 | Core Team |

### **Archived (Reference Only)** 📦

| Document | Reason | Archived Date |
|----------|--------|---------------|
| ENHANCED_CACHE_IMPLEMENTATION.md | Superseded by DO cache | 2025-01-XX |
| DO_CACHE_MIGRATION_SUMMARY.md | Migration complete | 2025-01-XX |
| KV_OPTIMIZATION_SUMMARY.md | KV cache removed | 2025-01-XX |
| Legacy cache-manager.ts | Replaced by DO cache | 2025-01-XX |

### **Deprecated (Do Not Use)** ⚠️

These documents are in the archive and should NOT be used:
- Any documentation referencing `FEATURE_FLAG_DO_CACHE`
- Any documentation referencing dual-cache (L1/L2 KV system)
- Any documentation referencing `CacheManager` class
- Any documentation referencing `isDOCacheEnabled()` function

---

## 🔍 Quick Reference

### **Common Tasks**

| Task | Documentation |
|------|---------------|
| Deploy to production | [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) |
| Understand caching | [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md) |
| Add new API endpoint | [API_DOCUMENTATION.md](API_DOCUMENTATION.md) |
| Debug cache issues | [CACHEMANAGER_EXPLAINED.md](CACHEMANAGER_EXPLAINED.md#debugging) |
| Run tests | [docs/TEST_COVERAGE_ANALYSIS_2025.md](docs/TEST_COVERAGE_ANALYSIS_2025.md) |
| Check system status | [docs/PROJECT_STATUS_OVERVIEW.md](docs/PROJECT_STATUS_OVERVIEW.md) |

### **Configuration Files**

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Workers configuration |
| `tsconfig.json` | TypeScript compiler configuration |
| `package.json` | Node.js dependencies |
| `playwright.config.js` | E2E test configuration |

---

## 📞 Getting Help

### **Documentation Issues**

- **Unclear documentation?** Open an issue with the "documentation" label
- **Missing documentation?** Check the archive first, then request new docs
- **Outdated documentation?** Submit a PR with updates

### **Technical Support**

1. Check relevant documentation first
2. Search existing issues
3. Check archive for historical context
4. Create new issue with details

---

## ✅ Documentation Health Check

**Last reviewed**: 2025-01-XX

- [x] All current docs listed in index
- [x] Obsolete docs moved to archive
- [x] Archive structure organized
- [x] Cross-references updated
- [x] Quick start guide clear
- [x] Role-based navigation working
- [x] Common tasks documented
- [x] Deprecated docs identified

---

*This index is maintained by the core team and should be updated with any documentation changes.*
