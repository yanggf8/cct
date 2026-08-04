// Lets Node load the worker's TypeScript directly.
//
// The source is ESM-with-.js-specifiers: `import … from './logging.js'` where
// the file on disk is `logging.ts`. Node strips types on its own (>= 22.6) but
// resolves the specifier literally and fails. This hook maps a relative `.js`
// specifier to the `.ts` beside it when that is what exists.
//
// Used by the validation tests so they can exercise real worker modules
// instead of a copy that drifts.

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL) {
    const asTs = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(asTs))) {
      return { url: pathToFileURL(fileURLToPath(asTs)).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
