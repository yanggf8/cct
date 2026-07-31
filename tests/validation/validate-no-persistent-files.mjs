#!/usr/bin/env node
/**
 * Guard: a new test script must not write into the checkout.
 *
 * Replaces the inline grep in .github/workflows/validate-no-artifacts.yml,
 * which was wrong in both directions.
 *
 *   FALSE POSITIVES — it matched `cat > name.json` line by line and excused
 *   only lines that themselves mention TMPDIR. A script that sets up a
 *   run-scoped temp directory, traps cleanup and cds into it was still flagged,
 *   because what makes those writes safe is the working directory, not the text
 *   of the line. tests/e2e/test-release-workflow-dryrun.sh failed on exactly
 *   that.
 *
 *   FALSE NEGATIVES — worse. The pattern needs a literal `.json`, `.log` or
 *   `.tmp` on the line, so `cat > "$REPORT_FILE"` matched nothing. Three
 *   scripts write reports straight into the checkout that way and were never
 *   flagged, into directories that are not even gitignored.
 *
 * WHY THIS DOES NOT DETECT WRITES AT ALL
 *
 * Two attempts were measured before settling here. A broad redirect pattern
 * flagged 36 of 51 scripts; a narrowed one still flagged 18. Nearly all of the
 * remainder were `>` inside quoted strings — `echo "TTL > 0"`,
 * `echo "✅ <html> tag present"`, `$(( x > 0 ))`, `echo "$x > 70" | bc`.
 * Separating a redirection from a greater-than sign needs a shell parser, not a
 * regular expression, and that was the original check's mistake too.
 *
 * So this checks the CONTRACT the policy actually states: a test script gets a
 * run-scoped temp directory and removes it on EXIT. That is a property of the
 * whole script and needs no parsing.
 *
 * WHY A BASELINE
 *
 * Only 5 of 51 scripts follow the contract today, and only 1 of the 10 that CI
 * executes. Enforcing it outright would fail permanently; exempting the rest
 * one by one would be an allowlist of everything, which is not a gate. The
 * baseline records the existing debt so the check is green now and fails on
 * anything NEW. Paying a script off means deleting its line from the baseline.
 *
 * Run: node tests/validation/validate-no-persistent-files.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASELINE = 'tests/validation/no-persistent-files-baseline.txt';

const DECLARES_TMPDIR = /^\s*(RUN_TMPDIR|TMPDIR)=|export\s+TMPDIR=/m;
const TRAPS_CLEANUP = /^\s*trap\s+.*\b(cleanup|EXIT)\b/m;

const scripts = execFileSync('git', ['ls-files', '*test-*.sh'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .sort();

const baseline = new Set(
  existsSync(BASELINE)
    ? readFileSync(BASELINE, 'utf8')
        .split('\n')
        .map((l) => l.replace(/#.*$/, '').trim())
        .filter(Boolean)
    : [],
);

const compliant = [];
const knownDebt = [];
const newDebt = [];
const paidOff = [];

for (const path of scripts) {
  const src = readFileSync(path, 'utf8');
  const ok = DECLARES_TMPDIR.test(src) && TRAPS_CLEANUP.test(src);

  if (ok && baseline.has(path)) paidOff.push(path);
  else if (ok) compliant.push(path);
  else if (baseline.has(path)) knownDebt.push(path);
  else newDebt.push(path);
}

console.log(`🔍 No-persistent-files contract: ${scripts.length} test script(s)`);
console.log(
  `   compliant: ${compliant.length}   known debt: ${knownDebt.length}` +
    `   new: ${newDebt.length}   paid off: ${paidOff.length}`,
);

if (paidOff.length) {
  console.log('\n🎉 These now follow the contract — delete them from the baseline:');
  for (const p of paidOff) console.log(`   ${p}`);
}

if (newDebt.length === 0 && paidOff.length === 0) {
  console.log('\n✅ No new script writes into the checkout');
  process.exit(0);
}

if (newDebt.length) {
  console.error(`\n❌ ${newDebt.length} script(s) added without the temp-directory contract:`);
  for (const p of newDebt) console.error(`   ${p}`);
  console.error('\nAdd near the top of the script:');
  console.error('    RUN_TMPDIR=".ci-tmp/${GITHUB_RUN_ID:-local}-<name>-$$"');
  console.error('    mkdir -p "$RUN_TMPDIR"; export TMPDIR="$RUN_TMPDIR"');
  console.error('    cleanup() { rm -rf "$RUN_TMPDIR" || true; }; trap cleanup EXIT');
  console.error(`\nThe baseline in ${BASELINE} is for scripts that predate this check.`);
  console.error('It is debt to pay down, not a place to add to.');
}

// Paid-off entries fail too: a stale baseline quietly stops being a ratchet.
process.exit(1);
