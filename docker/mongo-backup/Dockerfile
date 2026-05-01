FROM mongo:8

RUN apt-get update -qq && apt-get install -qq -y cron \
  && rm -rf /var/lib/apt/lists/*

COPY scripts/mongo-backup.sh /scripts/mongo-backup.sh
RUN chmod +x /scripts/mongo-backup.sh
