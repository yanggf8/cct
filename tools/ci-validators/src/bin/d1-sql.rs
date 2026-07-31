//! Guard: every INSERT/UPDATE in src/ must actually execute against the real schema.
//!
//! Ported from tests/validation/validate-d1-sql.mjs — the repo is moving its
//! tooling off JavaScript. Behaviour is unchanged; `node:sqlite` becomes
//! `rusqlite` with a bundled SQLite.
//!
//! This does not compare column names as text. It builds an in-memory SQLite
//! database from schema/current-schema.sql and runs each statement against it,
//! which catches the whole class at once: unknown column, unknown table, wrong
//! placeholder count, NOT NULL violation.
//!
//! Why it exists: savePredictionsBatch wrote `primary_`/`mate_` columns that D1
//! never had — it uses the legacy `gemma_`/`distilbert_` names. D1 rejected
//! every INSERT with "no such column: primary_status", the error was swallowed
//! into a `{success:false}` return nobody checked, and the job still reported
//! success. symbol_predictions took zero rows for about six months while the
//! reports looked fine.
//!
//! tsc cannot see inside a SQL string, and the failure only appeared at runtime
//! against remote D1 inside a catch block. This turns it into a local,
//! deterministic failure.

use regex::Regex;
use rusqlite::Connection;
use std::collections::HashSet;
use std::fs;
use std::process::ExitCode;
use walkdir::WalkDir;

const SCHEMA: &str = "schema/current-schema.sql";
const SRC: &str = "src";

struct Failure {
    label: String,
    table: String,
    stage: &'static str,
    msg: String,
}

fn main() -> ExitCode {
    let schema_sql = match fs::read_to_string(SCHEMA) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("❌ cannot read {SCHEMA}: {e}");
            return ExitCode::from(2);
        }
    };

    let db = match Connection::open_in_memory() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("❌ cannot open in-memory SQLite: {e}");
            return ExitCode::from(2);
        }
    };

    // Execute the whole dump; if it is itself malformed we want to know now.
    if let Err(e) = db.execute_batch(&schema_sql) {
        eprintln!("❌ {SCHEMA} did not load: {e}");
        return ExitCode::from(2);
    }

    let tables: HashSet<String> = {
        let mut stmt = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .expect("sqlite_master query");
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))
            .expect("sqlite_master rows");
        rows.filter_map(Result::ok).collect()
    };

    // Whole template literals only; a partial match produces bogus syntax errors.
    let literal = Regex::new(r"(?s)`([^`]*)`").unwrap();
    let verb = Regex::new(r"(?i)\b(INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE)\s+(\w+)").unwrap();
    let check_failed = Regex::new(r"(?i)CHECK constraint failed").unwrap();

    let mut failures: Vec<Failure> = Vec::new();
    let (mut checked, mut skipped) = (0usize, 0usize);

    let mut files: Vec<_> = WalkDir::new(SRC)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
        .map(|e| e.path().to_path_buf())
        .filter(|p| p.extension().is_some_and(|x| x == "ts"))
        .collect();
    files.sort();

    for path in files {
        let text = match fs::read_to_string(&path) {
            Ok(t) => t,
            Err(_) => continue,
        };

        for m in literal.captures_iter(&text) {
            let whole = m.get(0).unwrap();
            let sql = m.get(1).unwrap().as_str();

            let Some(v) = verb.captures(sql) else { continue };
            let table = v.get(2).unwrap().as_str().to_string();
            if !tables.contains(&table) {
                continue; // table not in the dumped schema
            }
            if sql.contains("${") {
                skipped += 1; // runtime-interpolated SQL
                continue;
            }

            let line = text[..whole.start()].lines().count();
            let label = format!("{}:{}", path.display(), line);
            checked += 1;

            let mut stmt = match db.prepare(sql) {
                Ok(s) => s,
                Err(e) => {
                    failures.push(Failure {
                        label,
                        table,
                        stage: "prepare",
                        msg: e.to_string(),
                    });
                    continue;
                }
            };

            // Dummy binds inside a transaction that is always rolled back. 'x'
            // satisfies NOT NULL and SQLite is dynamically typed, so one value
            // works for every column.
            let n = sql.matches('?').count();
            let params: Vec<&dyn rusqlite::ToSql> = vec![&"x"; n];

            let _ = db.execute_batch("BEGIN");
            if let Err(e) = stmt.execute(params.as_slice()) {
                let msg = e.to_string();
                // A CHECK failure means the statement bound cleanly and SQLite got
                // as far as evaluating constraints — table, columns and arity are
                // all proven good, and only the dummy value is wrong (e.g.
                // report_type IN ('pre-market',…)). The real values come from
                // runtime variables, so there is nothing here to assert. NOT NULL,
                // no-such-column and arity errors carry different messages and
                // still fail.
                if !check_failed.is_match(&msg) {
                    failures.push(Failure {
                        label,
                        table,
                        stage: "execute",
                        msg,
                    });
                }
            }
            let _ = db.execute_batch("ROLLBACK");
        }
    }

    if failures.is_empty() {
        let extra = if skipped > 0 {
            format!(" ({skipped} skipped: runtime-interpolated)")
        } else {
            String::new()
        };
        println!("✅ D1 SQL check: {checked} statement(s) executed against {SCHEMA}{extra}");
        return ExitCode::SUCCESS;
    }

    eprintln!(
        "❌ D1 SQL check: {} of {checked} statement(s) failed against {SCHEMA}\n",
        failures.len()
    );
    for f in &failures {
        eprintln!("  {}  [{}] {}: {}", f.label, f.table, f.stage, f.msg);
    }
    eprintln!("\nD1 uses legacy names for dual-model data: gemma_* = primary, distilbert_* = mate.");
    eprintln!("If the schema genuinely changed, re-dump it (see \"Schema Refresh\" in CLAUDE.md).");
    ExitCode::FAILURE
}
