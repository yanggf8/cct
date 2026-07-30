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

# Ratchet: four pre-existing findings are suppressed so this gate is green on
# day one and fails on anything NEW. They are all the same class — a context
# property that is read but never declared — and none of them stops GitHub
# loading the file: trading-system.yml carries one and has three successful
# runs. They are still real smells and should be fixed, at which point the
# corresponding name comes off this list:
#
#   trading-system.yml:392                 github.event.inputs.analysis_type,
#                                          but workflow_dispatch declares no
#                                          inputs — the value is always empty,
#                                          and steps.analysis-type.outputs
#                                          .analysis_type is probably meant
#   cache-warming.yml:65                   warmup-strategy
#   release-hardened.yml:25                needs.build_hash.outputs.verification
#   test-summary-schema-validation.yml:332 github.number (github.event.number?)
#
# Only these four names are exempt; an undefined property under any other name
# still fails, as does every syntax error.
KNOWN='property "(analysis_type|warmup-strategy|verification|number)" is not defined'

# -oneline keeps each finding on a single line so CI logs stay greppable.
if "$ACTIONLINT" -oneline -ignore "$KNOWN" "$DIR"/*.yml; then
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
