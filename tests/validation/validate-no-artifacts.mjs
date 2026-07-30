#!/usr/bin/env node
/**
 * Guard: no workflow may upload test artifacts.
 *
 * Replaces the grep-based check that used to live inline in
 * .github/workflows/validate-no-artifacts.yml. That version was structurally
 * unable to do its job:
 *
 *   1. It ran ONE `grep -A 5 -B 2 'uses.*upload-artifact'` per FILE and asked
 *      whether the combined output contained `if: ${{ false }}` anywhere. A
 *      workflow with one disabled upload and one active upload passed, because
 *      the disabled one's marker satisfied the whole file.
 *   2. Any line containing that text satisfied it — including a comment. A
 *      workflow could be waved through by prose alone.
 *   3. Its own pattern was written as an escaped expression inside a `run:`
 *      block, so GitHub expanded it before bash ever saw it and the check
 *      actually searched for `if: \false`. It matched nothing, so every file
 *      with an upload was reported as a violation and the workflow failed on
 *      every run since January.
 *   4. Its second job referenced two scripts that no longer exist, and would
 *      have died at the first `((ARTIFACT_FREE++))` under `bash -e` anyway.
 *
 * This parses the YAML and inspects each step individually, so "disabled" means
 * that step's own `if:` is a constant false — not that the words appear nearby.
 *
 * Run: node tests/validation/validate-no-artifacts.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const DIR = '.github/workflows';
const UPLOAD = /^actions\/upload-artifact(@|$)/;

// A step counts as disabled when its own `if:` can only ever be false.
const ALWAYS_FALSE = /^\s*(false|\$\{\{\s*false\s*\}\})\s*$/;

/**
 * Uploads that are allowed to stay active, each with a reason.
 *
 * Keyed by `<workflow file>::<job id>::<step name>`. An entry is deliberately
 * that specific: renaming or moving the step invalidates the exemption and the
 * gate speaks up again, which is the behaviour the grep version could not
 * offer.
 */
const ALLOWLIST = new Map([
  [
    'release-hardened.yml::sbom-and-signing::Upload SBOM and Provenance',
    'Not a test artifact and not optional: the post-deployment-validation job ' +
      'downloads `sbom-and-provenance` to check the deployment against its ' +
      'provenance (release-hardened.yml, "Download SBOM and Provenance"). ' +
      'Disabling this breaks the release pipeline.',
  ],
  [
    'artifact-cleanup.yml::artifact-cleanup::Upload Cleanup Report',
    'Operational output, not test data: the cleanup run\'s own report, kept 14 ' +
      'days. Worth noting separately — its `name:` is ' +
      '`artifact-cleanup-report-$(date …)`, and `$( )` in a `with:` value is ' +
      'not shell-substituted, so every run uploads under that literal name.',
  ],
]);

let yaml;
try {
  yaml = createRequire(import.meta.url)('js-yaml');
} catch {
  // Same rule as the sibling validators: a missing tool aborts loudly rather
  // than passing silently, otherwise the gate quietly stops guarding anything.
  console.error('❌ js-yaml not available — cannot validate workflows.');
  console.error('   Run `npm install` so this gate can actually run.');
  process.exit(2);
}

const active = [];
const disabled = [];
const exempt = [];
let filesChecked = 0;

for (const name of readdirSync(DIR).sort()) {
  if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
  const path = join(DIR, name);
  filesChecked++;

  let doc;
  try {
    doc = yaml.load(readFileSync(path, 'utf8'), { filename: path });
  } catch (e) {
    console.error(`❌ ${name}: cannot parse — ${e.message.split('\n')[0]}`);
    console.error('   Fix the YAML first; validate-workflows.yml covers that.');
    process.exit(1);
  }

  for (const [jobId, job] of Object.entries(doc?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (typeof step?.uses !== 'string' || !UPLOAD.test(step.uses.trim())) continue;

      const stepName = step.name ?? '(unnamed step)';
      const where = { file: name, jobId, stepName };
      const key = `${name}::${jobId}::${stepName}`;

      if (typeof step.if === 'string' && ALWAYS_FALSE.test(step.if)) {
        disabled.push(where);
      } else if (ALLOWLIST.has(key)) {
        exempt.push({ ...where, reason: ALLOWLIST.get(key) });
      } else {
        active.push({ ...where, if: step.if ?? '(no if:)' });
      }
    }
  }
}

const fmt = (x) => `${x.file}  job=${x.jobId}  step="${x.stepName}"`;

console.log(`🔍 No-test-artifacts policy: ${filesChecked} workflow file(s)`);
console.log(`   disabled: ${disabled.length}   exempt: ${exempt.length}   active: ${active.length}`);

if (exempt.length) {
  console.log('');
  for (const x of exempt) console.log(`   ⚪ exempt  ${fmt(x)}\n              ${x.reason}`);
}

if (active.length === 0) {
  console.log('');
  console.log('✅ No active artifact uploads outside the allowlist');
  process.exit(0);
}

console.error('');
console.error(`❌ ${active.length} active artifact upload(s):`);
for (const x of active) console.error(`   ${fmt(x)}\n     if: ${x.if}`);
console.error('');
console.error('Either disable the step with `if: ${{ false }}` on the step itself,');
console.error('or add an ALLOWLIST entry in this file with a reason for keeping it.');
process.exit(1);
