#!/usr/bin/env bash
set -euo pipefail

echo "== Checking git status =="
git status --short

echo "== Checking dangerous staged files =="

DANGEROUS_FILES=$(git diff --cached --name-only | grep -E '(^|/)(\.env|\.env\..*|.*\.pem|.*\.key|.*secret.*|.*password.*|node_modules|uploads|logs|\.omc|\.omx|\.omg)' | grep -Ev '(^|/)\.env\.example$' || true)

if [ -n "$DANGEROUS_FILES" ]; then
  echo "Dangerous files are staged:"
  echo "$DANGEROUS_FILES"
  exit 1
fi

echo "== Checking dangerous tracked files =="

TRACKED_DANGEROUS=$(git ls-files | grep -E '(^|/)(\.env|\.env\..*|.*\.pem|.*\.key|.*secret.*|.*password.*|node_modules|uploads|logs|\.omc|\.omx|\.omg)' | grep -Ev '(^|/)\.env\.example$' || true)

if [ -n "$TRACKED_DANGEROUS" ]; then
  echo "Dangerous files are already tracked:"
  echo "$TRACKED_DANGEROUS"
  echo "Review these before continuing."
  exit 1
fi

echo "== Running i18n verification =="
node agent-harness/verify-i18n.mjs

echo "== Running rewards verification =="
node agent-harness/verify-rewards.mjs

echo "== Frontend build/lint =="
cd dailycoding
npm run build
npm run lint
cd ..

echo "== Backend lint =="
cd dailycoding-server
if npm run | grep -q " lint"; then
  npm run lint
else
  echo "No backend lint script found. Skipping backend lint."
fi
cd ..

echo "All checks passed."
