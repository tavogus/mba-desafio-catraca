#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker é necessário para subir a Catraca." >&2
  exit 1
fi

docker compose up --build -d --remove-orphans

for _ in $(seq 1 90); do
  if curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
    echo "Catraca disponível em http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "A Catraca não ficou pronta a tempo." >&2
docker compose logs --tail 200
exit 1
