#!/bin/sh
# mongo-backup sidecar: persist env for cron, then run as daemon; or exec a one-off command.
set -eu

write_cron_env() {
  mkdir -p /etc/kirjaswappi
  umask 077
  : > /etc/kirjaswappi/cron.env
  for _name in MONGO_HOST MONGO_PORT MONGO_USER MONGO_PASSWORD MONGODB_DATABASE BACKUP_RETENTION_DAYS; do
    _val=$(eval "printf '%s' \"\$$_name\"")
    _escaped=$(printf '%s' "$_val" | sed "s/'/'\\\\''/g")
    echo "${_name}='${_escaped}'" >> /etc/kirjaswappi/cron.env
  done
  chmod 600 /etc/kirjaswappi/cron.env
}

install_crontab() {
  _schedule="${BACKUP_CRON:-0 3 * * *}"
  cat > /etc/cron.d/kirjaswappi-mongo <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

${_schedule} root /bin/sh -c '. /etc/kirjaswappi/cron.env && exec /scripts/mongo-backup.sh >> /var/log/cron.log 2>&1'
EOF
  chmod 0644 /etc/cron.d/kirjaswappi-mongo
}

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

write_cron_env
install_crontab

touch /var/log/cron.log
cron
exec tail -F /var/log/cron.log
