# Repository Guidelines

## Project Structure & Module Organization
Core Worker logic resides in `src/index.ts`, while `src/modules/` contains cache layers, analytics pipelines, and schedulers. Shared contracts live in `src/types/`; reusable helpers live in `src/utils/`. Static dashboards ship from `public/`, generated bundles land in `dist/`, and Playwright specs sit in `tests/`. Root-level shell scripts (for example `test-enhanced-cache-integration.sh`) coordinate multi-step checks—extend them instead of reinventing new entry points.

## Build, Test, and Development Commands
Run `npm install` to sync dependencies. Start a local Worker tunnel with `npm run dev`, and deploy via `npm run deploy` once Cloudflare credentials are configured. Execute the full UI suite through `npm run test:playwright`. Targeted suites include `npm run test:performance`, `npm run test:workflows`, and shell orchestrators like `./run-regression-tests.sh`. Use `npx tsc --noEmit` for strict type validation before submitting a change.

## Coding Style & Naming Conventions
TypeScript is the default; only fall back to `.js` when an external integration demands it. Match the prevailing two-space indentation, trailing commas in multi-line literals, and named exports. Modules use hyphenated lowercase filenames (`enhanced-cache-metrics.ts`); retain existing snake_case only when editing legacy adapters. Route any diagnostics through `createLogger` and avoid stray `console.log` calls.

## Testing Guidelines
Functional coverage runs on Playwright (`@playwright/test`) located in `tests/*.spec.js`. Name new specs after the behavior under test (`kv-rotation.spec.ts`) and include both happy-path and failure expectations. Long-form regression flows already have shell wrappers; append your scenario to the closest script instead of spawning a new one. Document fixtures or seed data in `src/data/` so reviewers can track dependencies, and regenerate `playwright-report/` assets only when attaching evidence to an issue.

## Commit & Pull Request Guidelines
Use conventional commit prefixes (`feat:`, `fix:`, `docs:`) as reflected in the log. Keep commits focused, updating relevant tests or scripts whenever functionality shifts. Pull requests must cite the issue ID, outline risk areas, and list the commands you executed (e.g., `npm run test:performance`). Include Playwright traces or script output when addressing regressions, and call out required updates to Cloudflare secrets or bindings early in the description.

## Environment & Configuration
Deployment targets are defined in `wrangler.toml` (production) and `wrangler-enhanced.toml` (staging). Manage secrets through `wrangler secret put`; never check them into source control. Durable Object behavior is centralized in `src/modules/cache-durable-object.ts`, so coordinate script updates such as `validate-enhanced-cache.sh` when modifying it. When adding KV namespaces or bindings, update the corresponding entry in `docs/` and capture migration steps in your PR notes.
