# Repository Guidelines

## Project Structure & Module Organization
Core worker logic lives in `src/`: `index.ts` wires fetch/scheduled handlers, `modules/` houses Durable Objects, and `routes/` encapsulates API endpoints. Shared types sit in `types.ts` and `.d.ts` shims; UI artifacts live in `public/`. Supporting references are in `docs/` and `reports/`, automation sits under `scripts/` plus root-level `test-*.sh`, and Playwright specs stay in `tests/`. Treat `dist/` as generated output.

## Build, Test, and Development Commands
Use `npm run dev` to start Wrangler locally (add `-- --remote` for real Durable Objects) and `npm run deploy` to publish with bindings from `wrangler.toml`. For frontend-only changes, use `npm run deploy:frontend:only` (skips backend build) or `npm run deploy:frontend` (includes backend). Run `npm run test:playwright` for full UI regression or target `npm run test:performance` / `npm run test:workflows` for focused suites. Domain harnesses live in Bash; execute the relevant `./test-*.sh` helper such as `./run-regression-tests.sh` or `./test-backtesting-api.sh` before shipping. Generate Playwright HTML via `npm run test:report`.

## Coding Style & Naming Conventions
Default to TypeScript with two-space indentation and trailing commas in multiline literals. Favor named exports; keep Durable Object classes in `modules/*.js` and shared types in `types.ts` or `global-types.d.ts`. Use `camelCase` for functions, `PascalCase` for classes, and mirror external payload casing only when integrating third-party APIs. When type gaps persist, follow the established `(value as any)` pattern and log TODOs referencing the TypeScript error tracker.

## Testing Guidelines
Extend Playwright coverage inside `tests/*.spec.js`, grouping scenarios by workflow in descriptive `describe()` blocks. Prefer augmenting existing specs before adding files so reporting stays consistent. Before a PR, run at least one Playwright suite plus any impacted domain script, and note the exact commands in your PR. For new Durable Object behavior, validate locally with `npm run dev -- --remote` to exercise real bindings.

## Commit & Pull Request Guidelines
Mirror the current history format: `type: short imperative summary`, emoji optional (e.g., `feat: Improve cache hydration`). Keep commits focused, separate formatting-only edits, and reference related issues in the body. Pull requests should outline scope, list affected subsystems, and enumerate verification commands. Attach UI screenshots or trace snippets when applicable, and call out Wrangler binding or secret changes explicitly.

## Review Expectations
When asked to perform a review, examine the relevant code changes thoroughly (not just summaries) and highlight concrete risks, regressions, or gaps with file references.

## Deployment Approval
**Always ask for user approval before deploying to production.** Present a summary of changes and wait for explicit confirmation before running `npm run deploy` or any wrangler deploy command.

## AI Model Policy
- **Primary Model**: `@cf/aisingapore/gemma-sea-lion-v4-27b-it` (Gemma Sea Lion 27B)
- **Secondary Model**: `@cf/huggingface/distilbert-sst-2-int8` (DistilBERT SST-2)
- **DEPRECATED - DO NOT USE**: `@cf/openchat/openchat-3.5-0106` (removed as of 2025-10-01)
- **Rate Limiting**: Process symbols sequentially with 2-3s delays to avoid rate limits
- **Failure Handling**: Return `status: 'failed', confidence: null` instead of fake fallback data
- **D1 Storage**: Record `source_models` array in signal data to track which AI models contributed

## Frontend & Auth Defaults
- All dashboards now load `public/js/cct-api.js` (not `api-client.js`) and expect `X-API-Key` when `X_API_KEY` is configured. `cct-api.js` looks for the key in `sessionStorage.cct_api_key`, then `localStorage.cct_api_key`, then `window.CCT_API_KEY`.
- SSE is disabled on the dashboards; data refresh is polling-based.
- If a review is requested, verify code diffs directly (not just reported summaries) and call out any endpoints/pages that may lack auth or load failures.
- Prediction job storage moved to D1 (`PREDICT_JOBS_DB`, table `job_executions`/`symbol_predictions`/`daily_analysis`) with KV fallback. Make sure the D1 schema is applied and staging/prod use distinct DB IDs.

## scheduled_date Tag Contract
- `scheduled_job_results.scheduled_date` is a write-time tag/key (paired with `report_type`); it is not derived at read time.
- Frontend `?date=YYYY-MM-DD` is used verbatim to query `scheduled_date` (no backend reinterpretation/conversion).
- Prefer explicit `YYYY-MM-DD` values in UI/navigation; avoid semantic values like `?date=yesterday` (ambiguous).

## Multi-Run Tracking
- All job types (pre-market, intraday, end-of-day, weekly) use `startJobRun()` / `completeJobRun()` for multi-run support.
- Each run creates a unique `run_id` in `job_run_results` table with stage tracking (init → ai_analysis → storage → finalize).
- Frontend supports `?run_id=` parameter to view specific runs; dashboard shows run history with delete capability.
- Fixed 2026-01-28: Pre-market jobs now use multi-run tracking (was missing, causing single-run behavior).

## Environment & Configuration
Deployment targets are defined in `wrangler.toml` (production) and `wrangler-enhanced.toml` (staging). Manage secrets through `wrangler secret put`; never check them into source control. Durable Object behavior is centralized in `src/modules/cache-durable-object.ts`, so coordinate script updates such as `validate-enhanced-cache.sh` when modifying it. When adding KV namespaces or bindings, update the corresponding entry in `docs/` and capture migration steps in your PR notes.

**Wrangler Authentication**: Always unset `CLOUDFLARE_API_TOKEN` before running wrangler commands to use OAuth login instead:
```bash
unset CLOUDFLARE_API_TOKEN && npx wrangler <command>
```

## Secrets Access Rule
- The API key is available in the environment as `X_API_KEY`. Do not hardcode or commit the value. Reference it via environment when triggering jobs or calling protected endpoints (e.g., pass `-H "X-API-KEY: $X_API_KEY"`).

## Skills
Codex skills live under `/home/yanggf/.codex/skills/`, with each skill in its own folder containing a `SKILL.md` file (for example `/home/yanggf/.codex/skills/notion-knowledge-capture/SKILL.md`).
