# Repository Guidelines

## Project Structure & Module Organization
Core worker logic lives in `src/`: `index.ts` wires fetch/scheduled handlers, `modules/` houses Durable Objects, and `routes/` encapsulates API endpoints. Shared types sit in `types.ts` and `.d.ts` shims; UI artifacts live in `public/`. Supporting references are in `docs/` and `reports/`, automation sits under `scripts/` plus root-level `test-*.sh`, and Playwright specs stay in `tests/`. Treat `dist/` as generated output.

## Build, Test, and Development Commands
Use `npm run dev` to start Wrangler locally (add `-- --remote` for real Durable Objects) and `npm run deploy` to publish with bindings from `wrangler.toml`. Run `npm run test:playwright` for full UI regression or target `npm run test:performance` / `npm run test:workflows` for focused suites. Domain harnesses live in Bash; execute the relevant `./test-*.sh` helper such as `./run-regression-tests.sh` or `./test-backtesting-api.sh` before shipping. Generate Playwright HTML via `npm run test:report`.

## Coding Style & Naming Conventions
Default to TypeScript with two-space indentation and trailing commas in multiline literals. Favor named exports; keep Durable Object classes in `modules/*.js` and shared types in `types.ts` or `global-types.d.ts`. Use `camelCase` for functions, `PascalCase` for classes, and mirror external payload casing only when integrating third-party APIs. When type gaps persist, follow the established `(value as any)` pattern and log TODOs referencing the TypeScript error tracker.

## Testing Guidelines
Extend Playwright coverage inside `tests/*.spec.js`, grouping scenarios by workflow in descriptive `describe()` blocks. Prefer augmenting existing specs before adding files so reporting stays consistent. Before a PR, run at least one Playwright suite plus any impacted domain script, and note the exact commands in your PR. For new Durable Object behavior, validate locally with `npm run dev -- --remote` to exercise real bindings.

## Commit & Pull Request Guidelines
Mirror the current history format: `type: short imperative summary`, emoji optional (e.g., `feat: Improve cache hydration`). Keep commits focused, separate formatting-only edits, and reference related issues in the body. Pull requests should outline scope, list affected subsystems, and enumerate verification commands. Attach UI screenshots or trace snippets when applicable, and call out Wrangler binding or secret changes explicitly.

## Environment & Configuration
Deployment targets are defined in `wrangler.toml` (production) and `wrangler-enhanced.toml` (staging). Manage secrets through `wrangler secret put`; never check them into source control. Durable Object behavior is centralized in `src/modules/cache-durable-object.ts`, so coordinate script updates such as `validate-enhanced-cache.sh` when modifying it. When adding KV namespaces or bindings, update the corresponding entry in `docs/` and capture migration steps in your PR notes.
