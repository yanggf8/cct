//! Guard: no workflow may upload test artifacts.
//!
//! Ported from tests/validation/validate-no-artifacts.mjs — the repo is moving
//! its tooling off JavaScript. Behaviour is unchanged.
//!
//! Replaces the grep that used to live inline in
//! .github/workflows/validate-no-artifacts.yml, which was structurally unable
//! to do its job:
//!
//!   1. It ran ONE `grep -A 5 -B 2 'uses.*upload-artifact'` per FILE and asked
//!      whether the combined output contained the disable marker anywhere. A
//!      workflow with one disabled upload and one active upload passed, because
//!      the disabled one satisfied the whole file.
//!   2. Any line containing that text satisfied it — including a comment. A
//!      workflow could be waved through by prose alone.
//!   3. Its own pattern was written as an escaped expression inside a `run:`
//!      block, so GitHub expanded it before bash ever saw it and the check
//!      actually searched for `if: \false`. It matched nothing, so every file
//!      with an upload was reported as a violation and the workflow failed on
//!      every run since January.
//!
//! This parses the YAML and inspects each step individually, so "disabled"
//! means that step's own `if:` is a constant false — not that the words appear
//! nearby.

use regex::Regex;
use serde_yaml::Value;
use std::fs;
use std::process::ExitCode;

const DIR: &str = ".github/workflows";

/// Uploads allowed to stay active, each with a reason.
///
/// Keyed by `<workflow file>::<job id>::<step name>`. Deliberately that
/// specific: renaming or moving the step invalidates the exemption and the gate
/// speaks up again, which the grep version could not offer.
const ALLOWLIST: &[(&str, &str)] = &[
    (
        "release-hardened.yml::sbom-and-signing::Upload SBOM and Provenance",
        "Not a test artifact and not optional: the post-deployment-validation job \
         downloads `sbom-and-provenance` to check the deployment against its provenance. \
         Disabling this breaks the release pipeline.",
    ),
    (
        "artifact-cleanup.yml::artifact-cleanup::Upload Cleanup Report",
        "Operational output, not test data: the cleanup run's own report, kept 14 days. \
         Worth noting separately — its `name:` is `artifact-cleanup-report-$(date …)`, \
         and `$( )` in a `with:` value is not shell-substituted, so every run uploads \
         under that literal name.",
    ),
];

struct Found {
    file: String,
    job: String,
    step: String,
    if_expr: String,
}

fn label(f: &Found) -> String {
    format!("{}  job={}  step=\"{}\"", f.file, f.job, f.step)
}

fn main() -> ExitCode {
    let upload = Regex::new(r"^actions/upload-artifact(@|$)").unwrap();
    let always_false = Regex::new(r"^\s*(false|\$\{\{\s*false\s*\}\})\s*$").unwrap();

    let mut entries: Vec<_> = match fs::read_dir(DIR) {
        Ok(rd) => rd.filter_map(Result::ok).map(|e| e.file_name()).collect(),
        Err(e) => {
            eprintln!("❌ cannot read {DIR}: {e}");
            return ExitCode::from(2);
        }
    };
    entries.sort();

    let (mut disabled, mut exempt, mut active) = (0usize, Vec::new(), Vec::new());
    let mut files_checked = 0usize;

    for name in entries {
        let name = name.to_string_lossy().to_string();
        if !name.ends_with(".yml") && !name.ends_with(".yaml") {
            continue;
        }
        let path = format!("{DIR}/{name}");
        files_checked += 1;

        let text = match fs::read_to_string(&path) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("❌ cannot read {path}: {e}");
                return ExitCode::from(2);
            }
        };
        let doc: Value = match serde_yaml::from_str(&text) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("❌ {name}: cannot parse — {e}");
                eprintln!("   Fix the YAML first; validate-workflows.yml covers that.");
                return ExitCode::FAILURE;
            }
        };

        let Some(jobs) = doc.get("jobs").and_then(Value::as_mapping) else {
            continue;
        };

        for (job_key, job) in jobs {
            let job_id = job_key.as_str().unwrap_or("?").to_string();
            let Some(steps) = job.get("steps").and_then(Value::as_sequence) else {
                continue;
            };

            for step in steps {
                let uses = step.get("uses").and_then(Value::as_str).unwrap_or("").trim();
                if !upload.is_match(uses) {
                    continue;
                }

                let step_name = step
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("(unnamed step)")
                    .to_string();
                let if_expr = step.get("if").and_then(Value::as_str).unwrap_or("").to_string();
                let key = format!("{name}::{job_id}::{step_name}");
                let found = Found {
                    file: name.clone(),
                    job: job_id.clone(),
                    step: step_name,
                    if_expr: if if_expr.is_empty() { "(no if:)".into() } else { if_expr.clone() },
                };

                if !if_expr.is_empty() && always_false.is_match(&if_expr) {
                    disabled += 1;
                } else if let Some((_, reason)) = ALLOWLIST.iter().find(|(k, _)| *k == key) {
                    exempt.push((found, *reason));
                } else {
                    active.push(found);
                }
            }
        }
    }

    println!("🔍 No-test-artifacts policy: {files_checked} workflow file(s)");
    println!(
        "   disabled: {disabled}   exempt: {}   active: {}",
        exempt.len(),
        active.len()
    );

    for (f, reason) in &exempt {
        println!("\n   ⚪ exempt  {}\n              {reason}", label(f));
    }

    if active.is_empty() {
        println!("\n✅ No active artifact uploads outside the allowlist");
        return ExitCode::SUCCESS;
    }

    eprintln!("\n❌ {} active artifact upload(s):", active.len());
    for f in &active {
        eprintln!("   {}\n     if: {}", label(f), f.if_expr);
    }
    eprintln!("\nEither disable the step with `if: ${{{{ false }}}}` on the step itself,");
    eprintln!("or add an ALLOWLIST entry in this file with a reason for keeping it.");
    ExitCode::FAILURE
}
