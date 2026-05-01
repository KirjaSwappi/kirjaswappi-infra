#!/bin/sh
# Daily MongoDB dump.
#
# Runs inside the mongo-backup container. Connection settings are taken from
# the environment (see docker-compose). Scheduled runs receive env via
# /etc/kirjaswappi/cron.env because cron does not inherit the container env.
# /backups, which is a host-mounted volume so dumps survive container churn.
#
# Retention is enforced locally; for off-site copies, schedule rsync/aws s3
# from the host (or replace this script with one that pushes to S3 directly).
set -eu

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="/backups"
OUT_FILE="${OUT_DIR}/kirjaswappi-${TIMESTAMP}.archive.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "${OUT_DIR}"

echo "[$(date -u)] Dumping ${MONGODB_DATABASE} to ${OUT_FILE}"
mongodump \
  --uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}/${MONGODB_DATABASE}?authSource=admin" \
  --archive \
  --gzip \
  > "${OUT_FILE}"

echo "[$(date -u)] Pruning archives older than ${RETENTION_DAYS} days"
find "${OUT_DIR}" -name 'kirjaswappi-*.archive.gz' -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date -u)] Backup complete"
