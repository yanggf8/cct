# Documentation Structure

This project uses a simplified dual AI comparison system with enterprise-grade key management instead of the previous complex 3-degree analysis approach.

## Current Architecture

### Primary Documentation
- **README.md** - Main project overview and quick start guide (root directory)
- **CLAUDE.md** - Developer guidance and system architecture details (root directory)
- **API_DOCUMENTATION.md** - Complete API reference documentation (root directory)

### Current System Documentation
- `docs/current/` - Current dual AI system documentation
  - `DUAL_AI_COMPARISON_DESIGN.md` - Dual AI comparison system design overview
  - `DUAL_AI_IMPLEMENTATION.md` - Comprehensive dual AI implementation guide
  - `KV_KEY_FACTORY.md` - Enterprise-grade key management system documentation
  - `CONFIGURATION.md` - Centralized configuration system guide

### Legacy Documentation (Obsolete)
- `docs/obsolete/` - Previous 3-degree analysis system documentation
  - `3_DEGREE_ANALYSIS_DESIGN.md` - Original 3-degree design (replaced by dual AI)
  - `3_DEGREE_EVENT_DRIVEN_ANALYSIS.md` - Event-driven workflow analysis
  - `3_DEGREE_4_REPORT_INTEGRATION_DESIGN.md` - 4-report system integration
  - `3_DEGREE_WORKFLOW_IMPACT.md` - Workflow impact assessment

## System Overview

The current **Dual AI Comparison System** provides:

1. **Two Independent AI Models**
   - GPT-OSS-120B for contextual analysis with natural language reasoning
   - DistilBERT-SST-2-INT8 for sentiment classification with fast processing

2. **Simple Agreement Logic**
   - Models either AGREE (same direction), PARTIALLY AGREE (mixed signals), or DISAGREE (opposite directions)
   - Clear signal generation: AGREEMENT → STRONG_BUY/STRONG_SELL, PARTIAL_AGREEMENT → CONSIDER/HOLD, DISAGREEMENT → AVOID

3. **Enterprise-Grade Key Management**
   - KV Key Factory with 15 standardized key types
   - Automated TTL assignment (5min to 90day ranges)
   - Key validation, sanitization, and parsing capabilities

4. **Transparent Results**
   - Clear side-by-side model comparison with confidence metrics
   - HTML visualization with agreement badges and recommendation panels
   - Facebook messaging with dual AI agreement display

5. **4-Report System** (Enhanced)
   - Pre-Market Briefing (8:30 AM) - High-confidence signals (≥70%)
   - Intraday Performance Check (12:00 PM) - Real-time tracking
   - End-of-Day Summary (4:05 PM) - Market close + tomorrow outlook
   - Weekly Review (Sunday 10:00 AM) - Pattern analysis + recommendations

## Migration from 3-Degree to Dual AI

**Why the change?** The user requested simplification:
- Eliminate complex consensus calculations
- Remove analytical degrees that were essentially keyword counting
- Focus on true AI consensus between two different models
- Provide transparent, explainable results

**What changed?**
- Replaced 3 analytical degrees with 2 AI models
- Removed complex consensus math in favor of simple agreement logic
- Maintained the same 4-report workflow and actionable messaging
- Improved transparency and reduced computational overhead

**What stayed the same?**
- All 4 reports with their timing and structure
- High-confidence signal focus (≥70%)
- Event-driven workflow with Facebook messaging
- Production-ready Cloudflare Workers architecture