#!/bin/sh
# Restore a KirjaSwappi MongoDB dump into the running mongo container.
#
# Usage:
#   ./scripts/mongo-restore.sh /backups/kirjaswappi-<TIMESTAMP>.archive.gz
#
# Run via:
#   docker compose -f docker-compose.prod.yml run --rm mongo-backup \
#     /scripts/mongo-restore.sh /backups/kirjaswappi-<TIMESTAMP>.archive.gz
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
