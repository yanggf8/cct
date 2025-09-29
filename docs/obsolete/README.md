# Legacy 3-Degree Analysis Documentation

**Status: OBSOLETE** - This directory contains documentation for the previous 3-degree analysis system that has been replaced by the simplified **Dual AI Comparison System**.

## Current System: Dual AI Comparison

The current system uses a simplified dual AI approach:
- **GPT-OSS-120B**: Contextual analysis and market sentiment assessment
- **DistilBERT-SST-2-INT8**: Sentiment classification and validation
- **Simple Agreement Logic**: Models either agree (same direction) or disagree (different directions)
- **No Complex Consensus**: Transparent side-by-side comparison without weighted averaging

See **DUAL_AI_COMPARISON_DESIGN.md** for the current architecture.

## Legacy Files in This Directory

- `3_DEGREE_ANALYSIS_DESIGN.md` - Original 3-degree analysis design
- `3_DEGREE_EVENT_DRIVEN_ANALYSIS.md` - Event-driven workflow analysis
- `3_DEGREE_4_REPORT_INTEGRATION_DESIGN.md` - 4-report system integration
- `3_DEGREE_WORKFLOW_IMPACT.md` - Workflow impact assessment

**Why the change?** The user requested simplification:
- No complex consensus math
- Simple agreement/disagreement logic
- Transparent results
- Two independent AI models instead of three analytical degrees

## Migration Notes

The 4-report system remains the same, but now uses the dual AI comparison approach instead of the complex 3-degree consensus system. All reports maintain their actionable insights and high-confidence signal focus (≥70%).