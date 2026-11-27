#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker é necessário para rodar os gates." >&2
  exit 1
fi

docker compose up -d db

ready=0
for _ in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U catraca -d catraca >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "O Postgres não ficou pronto." >&2
  docker compose logs --tail 100 db
  exit 1
fi

docker compose run --build --rm \
  -e DATABASE_URL=postgres://catraca:catraca@db:5432/catraca_test \
  -e GATEWAY_DELAY_FACTOR=0 \
  -e COOKIE_SECRET=test-cookie-secret \
  app npm test
