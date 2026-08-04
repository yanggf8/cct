// Installs the .js -> .ts resolver for a test run: node --import ./tests/validation/register-ts.mjs <test>
import { register } from 'node:module';
register('./ts-resolver.mjs', import.meta.url);
