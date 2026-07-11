#!/bin/sh
set -e
echo "[api] waiting for database..."
# Best-effort migrate on boot (prod compose sets RUN_MIGRATIONS=true)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[api] prisma migrate deploy"
  npx prisma migrate deploy --schema apps/api/prisma/schema.prisma || \
    node node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
fi
if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "[api] seed"
  node apps/api/prisma/seed.js || true
fi
echo "[api] starting Nest"
exec node apps/api/dist/main.js
