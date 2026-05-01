FROM mongo:8

RUN apt-get update -qq && apt-get install -qq -y cron \
  && rm -rf /var/lib/apt/lists/*

COPY scripts/mongo-backup.sh /scripts/mongo-backup.sh
COPY scripts/mongo-restore.sh /scripts/mongo-restore.sh
COPY docker/mongo-backup/entrypoint.sh /usr/local/bin/mongo-backup-entrypoint.sh
RUN chmod +x /scripts/mongo-backup.sh /scripts/mongo-restore.sh \
  /usr/local/bin/mongo-backup-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/mongo-backup-entrypoint.sh"]
CMD []
