#!/bin/sh
# Restore a KirjaSwappi MongoDB dump into the running mongo container.
#
# Usage (from repo root, archive path is inside the mongo-backups volume):
#   docker compose -f docker-compose.prod.yml run --rm mongo-backup \
#     /scripts/mongo-restore.sh /backups/kirjaswappi-<TIMESTAMP>.archive.gz
#
# The mongo-backup image includes this script at /scripts/mongo-restore.sh.
# Compose injects MONGO_* / MONGODB_DATABASE into the one-off container environment.
set -eu

ARCHIVE="${1:?missing archive path}"

if [ ! -f "${ARCHIVE}" ]; then
  echo "Archive not found: ${ARCHIVE}" >&2
  exit 1
fi

echo "[$(date -u)] Restoring ${ARCHIVE} into ${MONGODB_DATABASE}"
mongorestore \
  --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGODB_DATABASE}?authSource=admin" \
  --archive="${ARCHIVE}" \
  --gzip \
  --drop

echo "[$(date -u)] Restore complete"
