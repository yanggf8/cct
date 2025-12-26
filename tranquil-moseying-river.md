# Navigation Unification Plan (Sidebar)

## Current State
- `public/js/nav.js` injects a left sidebar nav (Reports/Dashboards/System) used by static pages and worker-rendered pages.
- `public/css/nav.css` styles the sidebar with a mobile toggle.
- Top headers were removed from dashboards; sidebar is the single nav.

## Goal
Keep one shared sidebar across all pages (static and worker-rendered) with the same menu:
- Reports: Pre-Market, Intraday, End-of-Day, Weekly
- Dashboards: Overview, Backtesting, Portfolio, Predictive
- System: API Test

## Tasks
1) `public/js/nav.js`: ensure the menu remains the source of truth; keep mobile toggle and strict active-state match.
2) `public/css/nav.css`: maintain sidebar layout, body padding, and mobile open/close states.
3) `src/utils/html-templates.ts`: render the same sidebar (reuse nav.js or shared markup) for worker pages.
4) Cleanup: remove any leftover top-bar nav code/styles/templates to avoid conflicts.

## Verification
- All destinations reachable from the sidebar on: `/dashboard.html`, `/backtesting-dashboard.html`, `/portfolio-optimization-dashboard.html`, `/predictive-analytics.html`, `/test-api.html`, `/pre-market-briefing`, `/intraday-check`, `/end-of-day-summary`, `/weekly-review`.
- Mobile: toggle opens/closes the sidebar; body padding adjusts correctly.

## Rollback
Revert the nav/css/template changes if needed.
