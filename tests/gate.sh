#!/usr/bin/env bash
# Run test suites; exit 1 unless every one ends with "0 failures". Usage: bash gate.sh regression.js chat33.js …
cd "$(dirname "$0")"
status=0
for t in "$@"; do
    last=$(timeout 300 node "$t" 2>&1 | tail -1)
    printf '%-20s %s\n' "$t" "$last"
    [ "$last" = "0 failures" ] || status=1
done
exit $status
