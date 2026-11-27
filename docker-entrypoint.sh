#!/bin/sh
set -eu

if [ "${1:-}" = "serve" ]; then
  exec ./node_modules/.bin/tsx src/main.ts
fi

exec "$@"
