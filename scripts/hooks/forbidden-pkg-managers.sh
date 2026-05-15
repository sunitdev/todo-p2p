#!/usr/bin/env bash
# Enforce bun-only rule (see CLAUDE.md "Critical rules").
# Rejects:
#   1. Staged lockfiles from other package managers.
#   2. npm/pnpm/yarn install commands inside staged package.json scripts.
set -euo pipefail

fail=0

for f in "$@"; do
  base="$(basename "$f")"
  case "$base" in
    package-lock.json|npm-shrinkwrap.json|pnpm-lock.yaml|yarn.lock)
      echo "✗ forbidden lockfile staged: $f (repo is bun-only)" >&2
      fail=1
      ;;
  esac

  if [ "$base" = "package.json" ] && [ -f "$f" ]; then
    if grep -nE '"(npm|pnpm|yarn)[[:space:]]+(install|add|i|exec|run|create)' "$f" >/dev/null 2>&1; then
      echo "✗ forbidden package-manager invocation in $f:" >&2
      grep -nE '"(npm|pnpm|yarn)[[:space:]]+(install|add|i|exec|run|create)' "$f" >&2
      fail=1
    fi
  fi
done

exit $fail
