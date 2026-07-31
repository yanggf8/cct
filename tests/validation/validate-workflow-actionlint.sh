#!/usr/bin/env bash
#
# Guard: every .github/workflows/*.yml must pass actionlint.
#
# Why it exists, on top of validate-workflow-yaml.mjs: neither a strict YAML
# loader nor the SchemaStore github-workflow schema validates EXPRESSION syntax,
# and a bad expression is rejected by GitHub at load time exactly like a
# duplicate mapping key — conclusion=failure, zero jobs, no logs, and the run
# labelled with the file path instead of the workflow's name.
#
# enhanced-cache-tests.yml failed that way 30 times in a row for two separate
# reasons that only actionlint caught:
#
#   1. arithmetic in an expression, which the grammar does not have:
#        "remaining token(s) in the input: \"*\", \"INTEGER\""
#   2. an empty pair of expression delimiters written inside a `run:` block —
#      a `#` line there is a SHELL comment, not a YAML one, so GitHub still
#      expands expressions across it:
#        "unexpected end of input while parsing variable access ..."
#
# Run: npm run test:actionlint   (or invoke this script directly)

set -euo pipefail

DIR=".github/workflows"

if [[ ! -d "$DIR" ]]; then
    echo "❌ $DIR not found — run this from the repository root."
    exit 2
fi

# Resolve actionlint: PATH first, then a repo-local copy.
ACTIONLINT=""
if command -v actionlint >/dev/null 2>&1; then
    ACTIONLINT="$(command -v actionlint)"
elif [[ -x "./bin/actionlint" ]]; then
    ACTIONLINT="./bin/actionlint"
fi

if [[ -z "$ACTIONLINT" ]]; then
    # Same principle as validate-workflow-yaml.mjs: a missing tool must abort
    # loudly rather than silently pass, otherwise the gate quietly stops
    # guarding anything.
    echo "❌ actionlint not available — cannot validate workflow expressions."
    echo ""
    echo "   Install one of:"
    echo "     go install github.com/rhysd/actionlint/cmd/actionlint@latest"
    echo "     brew install actionlint"
    echo "     bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) latest ./bin"
    echo ""
    echo "   In CI, prefer the pinned action: rhysd/actionlint@v1"
    exit 2
fi

echo "🔍 actionlint: $("$ACTIONLINT" -version | head -1)"

# Ratchet: one pre-existing finding is suppressed so this gate is green on
# day one and fails on anything NEW. It is a context property that is read but
# never declared, which does not stop GitHub loading the file —
# trading-system.yml carries it and has 99 successful runs. It is still a real
# smell and should be fixed, at which point the name comes off this list:
#
#   trading-system.yml:392                 github.event.inputs.analysis_type,
#                                          but workflow_dispatch declares no
#                                          inputs — the value is always empty,
#                                          and steps.analysis-type.outputs
#                                          .analysis_type is probably meant
#
# `github.number` came off this list once the schema-validation comment step
# stopped using it.
#
# Only this one name is exempt; an undefined property under any other name
# still fails, as does every syntax error. Note the suppression is by NAME, not
# by location — a new misuse of that name elsewhere would also be hidden, which
# is the price of the ratchet and the reason to keep it short.
KNOWN='property "(analysis_type)" is not defined'

# shellcheck and pyflakes integration are switched off on purpose.
#
# actionlint shells out to them for `run:` blocks when they are on PATH. They
# are installed on ubuntu-latest but usually not on a dev machine, so leaving
# them on makes the gate behave DIFFERENTLY locally and in CI — this script
# reported "clean" locally and then failed its first CI run on a wall of
# SC2086 "double quote to prevent globbing" notices in files nobody had
# touched. A gate whose result depends on what happens to be installed is not
# a gate.
#
# Those findings are style/info level and none of them stops GitHub loading a
# file, which is what this check is for. Linting shell inside workflows is a
# reasonable thing to want, but it belongs in its own check with its own
# backlog, not smuggled in here.
NO_EXTERNAL=(-shellcheck= -pyflakes=)

# -oneline keeps each finding on a single line so CI logs stay greppable.
if "$ACTIONLINT" -oneline "${NO_EXTERNAL[@]}" -ignore "$KNOWN" "$DIR"/*.yml; then
    COUNT=$(find "$DIR" -maxdepth 1 -name '*.yml' | wc -l | tr -d ' ')
    echo "✅ actionlint: $COUNT workflow file(s) clean"
    exit 0
fi

echo ""
echo "❌ actionlint found problems in $DIR"
echo "   Expression errors are load-time failures: GitHub refuses the whole file,"
echo "   the run gets zero jobs and no logs, and it is listed by path rather than"
echo "   by its name. A local YAML parse succeeding proves nothing about them."
exit 1
