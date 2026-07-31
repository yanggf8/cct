//! Guard: a new test script must not write into the checkout.
//!
//! Ported from tests/validation/validate-no-persistent-files.mjs — the repo is
//! moving its tooling off JavaScript. Behaviour is unchanged; the notes below
//! are the reasoning that produced it and are worth keeping.
//!
//! Replaces an inline grep in .github/workflows/validate-no-artifacts.yml that
//! was wrong in both directions.
//!
//! FALSE POSITIVES — it matched `cat > name.json` line by line and excused only
//! lines that themselves mention TMPDIR. A script that sets up a run-scoped temp
//! directory, traps cleanup and cds into it was still flagged, because what
//! makes those writes safe is the working directory, not the text of the line.
//!
//! FALSE NEGATIVES — worse. The pattern needed a literal `.json`/`.log`/`.tmp`
//! on the line, so `cat > "$REPORT_FILE"` matched nothing. Three scripts write
//! reports straight into the checkout that way, into directories that are not
//! even gitignored, and were never reported.
//!
//! WHY THIS DOES NOT DETECT WRITES AT ALL
//!
//! Two attempts were measured before settling here. A broad redirect pattern
//! flagged 36 of 51 scripts; a narrowed one still flagged 18. Nearly all of the
//! remainder were `>` inside quoted strings — `echo "TTL > 0"`,
//! `echo "✅ <html> tag present"`, `$(( x > 0 ))`, `echo "$x > 70" | bc`.
//! Separating a redirection from a greater-than sign needs a shell parser, not
//! a regular expression, and that was the original check's mistake too.
//!
//! So this checks the CONTRACT the policy states: a test script gets a
//! run-scoped temp directory and removes it on EXIT. That is a property of the
//! whole script and needs no parsing.
//!
//! WHY A BASELINE
//!
//! Only 6 of 51 scripts follow the contract today, and 1 of the 10 CI executes.
//! Enforcing it outright fails forever; exempting the rest one by one is an
//! allowlist of everything, which is not a gate. The baseline records existing
//! debt so the check is green now and fails on anything NEW. Paying a script off
//! means deleting its line — and that also fails, so a stale baseline cannot
//! quietly stop being a ratchet.

use regex::Regex;
use std::fs;
use std::process::{Command, ExitCode};

const BASELINE: &str = "tests/validation/no-persistent-files-baseline.txt";

fn tracked_test_scripts() -> Result<Vec<String>, String> {
    // Scope: everything under tests/, plus any test-*.sh elsewhere.
    //
    // `*test-*.sh` alone missed tests/feature/mock-elimination/mock-elimination-audit.sh,
    // which has no "test-" in its name and demonstrably leaves a
    // mock-audit-<timestamp>/ directory in the checkout — it did so during this
    // very port. scripts/deployment/* is deliberately NOT included: those build
    // dist/ for a living, dist/ is gitignored, and the temp-dir contract does
    // not apply to them.
    let out = Command::new("git")
        .args(["ls-files", "tests/**/*.sh", "*test-*.sh"])
        .output()
        .map_err(|e| format!("could not run git: {e}"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    let mut v: Vec<String> = String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(str::to_string)
        .collect();
    v.sort();
    v.dedup();
    Ok(v)
}

fn read_baseline() -> Vec<String> {
    fs::read_to_string(BASELINE)
        .unwrap_or_default()
        .lines()
        .map(|l| l.split('#').next().unwrap_or("").trim().to_string())
        .filter(|l| !l.is_empty())
        .collect()
}

fn main() -> ExitCode {
    let declares = Regex::new(r"(?m)^\s*(RUN_TMPDIR|TMPDIR)=|export\s+TMPDIR=").unwrap();
    let traps = Regex::new(r"(?m)^\s*trap\s+.*\b(cleanup|EXIT)\b").unwrap();

    let scripts = match tracked_test_scripts() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("❌ {e}");
            return ExitCode::from(2);
        }
    };
    let baseline = read_baseline();

    let (mut compliant, mut known_debt, mut new_debt, mut paid_off) = (0usize, 0usize, vec![], vec![]);

    for path in &scripts {
        let src = match fs::read_to_string(path) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("❌ cannot read {path}: {e}");
                return ExitCode::from(2);
            }
        };
        let ok = declares.is_match(&src) && traps.is_match(&src);
        let baselined = baseline.iter().any(|b| b == path);

        match (ok, baselined) {
            (true, true) => paid_off.push(path.clone()),
            (true, false) => compliant += 1,
            (false, true) => known_debt += 1,
            (false, false) => new_debt.push(path.clone()),
        }
    }

    println!("🔍 No-persistent-files contract: {} test script(s)", scripts.len());
    println!(
        "   compliant: {compliant}   known debt: {known_debt}   new: {}   paid off: {}",
        new_debt.len(),
        paid_off.len()
    );

    if !paid_off.is_empty() {
        println!("\n🎉 These now follow the contract — delete them from the baseline:");
        for p in &paid_off {
            println!("   {p}");
        }
    }

    if new_debt.is_empty() && paid_off.is_empty() {
        println!("\n✅ No new script writes into the checkout");
        return ExitCode::SUCCESS;
    }

    if !new_debt.is_empty() {
        eprintln!(
            "\n❌ {} script(s) added without the temp-directory contract:",
            new_debt.len()
        );
        for p in &new_debt {
            eprintln!("   {p}");
        }
        eprintln!("\nAdd near the top of the script:");
        eprintln!(r#"    RUN_TMPDIR=".ci-tmp/${{GITHUB_RUN_ID:-local}}-<name>-$$""#);
        eprintln!(r#"    mkdir -p "$RUN_TMPDIR"; export TMPDIR="$RUN_TMPDIR""#);
        eprintln!(r#"    cleanup() {{ rm -rf "$RUN_TMPDIR" || true; }}; trap cleanup EXIT"#);
        eprintln!("\nThe baseline in {BASELINE} is for scripts that predate this check.");
        eprintln!("It is debt to pay down, not a place to add to.");
    }

    ExitCode::FAILURE
}
