# Navigation Redesign: Left Sidebar Implementation

## Overview
This document outlines the transition from a top-bar navigation to a persistent left-sidebar navigation for the CCT Trading System.

## Requirements
1.  **Remove Top Navigation**: Completely eliminate the horizontal top bar.
2.  **Persistent Left Navigation**: Implement a vertical sidebar on the left side of the screen.
3.  **Persistence**: The menu must maintain its state (active selections, structure) across page loads.
4.  **Hierarchy**: Support main menu items and sub-items.
5.  **Mobile Responsiveness**: Accessible navigation on small screens via a toggle button.

## Implementation Plan

### 1. CSS Architecture (`public/css/nav.css`)
-   **Layout**: `position: fixed; left: 0; top: 0; bottom: 0; width: 260px;`
-   **Styling**: Dark theme to match the application (`#0d1117` background).
-   **Content Adjustment**: `body.has-nav` will include `padding-left: 260px` (instead of `padding-top`).
-   **Responsive Design**:
    -   Sidebar hidden (`transform: translateX(-100%)`) on screens ≤ 768px.
    -   Slide-in animation when active.
    -   Mobile toggle button styled and positioned fixed top-left.

### 2. JavaScript Logic (`public/js/nav.js`)
-   **Structure**: Change the injected HTML to use a vertical `aside` or `nav` structure.
-   **Mobile Integration**: Automatically injects a hamburger menu button (`.mobile-nav-toggle`) for small screens.
-   **State Management**:
    -   **Active Link**: Uses strict equality check (`currentPath === itemPath`) on normalized paths to ensure accurate highlighting.
    -   **Auto-Close**: Sidebar automatically closes on mobile after a link is clicked.
-   **Grouping**: Organize the flat list into logical groups ("Dashboards", "Analytics", "System").

### Current Menu Structure
*   **Dashboard**
    *   📈 Dashboard (`/dashboard.html`)
*   **Reports**
    *   🌅 Pre-Market (`/pre-market-briefing`)
    *   📊 Intraday (`/intraday-check`)
    *   🌆 End-of-Day (`/end-of-day-summary`)
    *   📋 Weekly
        * This Week (`/weekly-review`)
        * Last Week (`/weekly-review?week=last`)
*   **Portfolio**
    *   📊 Breakdown (`/portfolio-breakdown.html`)
    *   💼 Optimization (`/portfolio-optimization-dashboard.html`)
*   **System**
    *   🧪 API Test (`/test-api.html`)

## Usage
The system automatically injects this navigation (including the mobile toggle button) into any page referencing `nav.js`. No manual HTML changes are required for individual pages.

---

## V2 Proposal (Date-Based Report Hierarchy)

For the updated, date-based navigation design (last N trading days with per-report ✅/❌/⏳ status), see:

- `docs/NAVIGATION_REDESIGN_V2.md`

Key concepts introduced in V2:

- A “Reports” tree grouped by **trading day (ET)** with children: **Pre-Market**, **Intraday**, **End-of-Day**.
- Weekly remains a standalone top-level link (`/weekly-review`).
- A materialized D1 summary table (`job_date_results`) intended to power nav status cheaply, even when `scheduled_job_results` snapshots are missing (e.g., job failed before snapshot write).
- A status endpoint (`GET /api/v1/reports/status?days=N`) to fetch the last N trading days’ status map for nav rendering.
