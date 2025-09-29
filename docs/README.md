# Documentation Structure

This project uses a simplified dual AI comparison system instead of the previous complex 3-degree analysis approach.

## Current Architecture

### Primary Documentation
- **README.md** - Main project overview and quick start guide
- **CLAUDE.md** - Developer guidance and system architecture details
- **DUAL_AI_COMPARISON_DESIGN.md** - Current dual AI comparison system design

### Legacy Documentation (Obsolete)
- `docs/obsolete/` - Previous 3-degree analysis system documentation
  - `3_DEGREE_ANALYSIS_DESIGN.md` - Original 3-degree design (replaced by dual AI)
  - `3_DEGREE_EVENT_DRIVEN_ANALYSIS.md` - Event-driven workflow analysis
  - `3_DEGREE_4_REPORT_INTEGRATION_DESIGN.md` - 4-report system integration
  - `3_DEGREE_WORKFLOW_IMPACT.md` - Workflow impact assessment

## System Overview

The current **Dual AI Comparison System** provides:

1. **Two Independent AI Models**
   - GPT-OSS-120B for contextual analysis
   - DistilBERT-SST-2-INT8 for sentiment validation

2. **Simple Agreement Logic**
   - Models either agree (same direction) or disagree (different directions)
   - No complex consensus math or weighted averaging

3. **Transparent Results**
   - Clear side-by-side comparison of both model outputs
   - Simple decision rules based on agreement/disagreement

4. **4-Report System** (Unchanged)
   - Pre-Market Briefing (8:30 AM)
   - Intraday Performance Check (12:00 PM)
   - End-of-Day Summary (4:05 PM)
   - Weekly Review (Sunday 10:00 AM)

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