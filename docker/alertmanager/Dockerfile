FROM prom/alertmanager:v0.27.0

# alertmanager.yml uses $ALERTMANAGER_WEBHOOK_URL and $ALERTMANAGER_WEBHOOK_URL_CRITICAL.
# These env vars MUST be set in the container environment (e.g. via compose `environment:`)
# before Alertmanager starts; otherwise alerts will be silently dropped.
COPY alertmanager/alertmanager.yml /etc/alertmanager/alertmanager.yml
