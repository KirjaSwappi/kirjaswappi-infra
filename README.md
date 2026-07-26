# KirjaSwappi Infrastructure

[![E2E Tests](https://github.com/KirjaSwappi/kirjaswappi-infra/actions/workflows/e2e.yml/badge.svg)](https://github.com/KirjaSwappi/kirjaswappi-infra/actions/workflows/e2e.yml)
[![Build Infra Images](https://github.com/KirjaSwappi/kirjaswappi-infra/actions/workflows/build-infra-images.yml/badge.svg)](https://github.com/KirjaSwappi/kirjaswappi-infra/actions/workflows/build-infra-images.yml)

Docker Compose deployment, reverse proxy, monitoring, and end-to-end tests for [KirjaSwappi](https://kirjaswappi.fi).

## Repository Structure

```text
├── docker-compose.prod.yml      Production stack (all services)
├── docker-compose.ci.yml        Minimal CI stack for e2e tests
├── Caddyfile                    Reverse proxy configuration
├── docker/                      Custom Docker image build contexts
│   ├── caddy/
│   ├── prometheus/
│   ├── alertmanager/
│   └── mongo-backup/
├── prometheus/                  Prometheus scrape configuration
├── alertmanager/                Alert routing rules
├── scripts/                     Maintenance scripts (backup, etc.)
└── e2e/                         End-to-end test suite
    ├── tests/                   API integration tests (Node.js)
    ├── lib/                     Shared test utilities
    └── Dockerfile.frontend      Frontend build for CI
```

## Production Stack

`docker-compose.prod.yml` runs the complete KirjaSwappi platform:

| Service | Description |
| ------- | ----------- |
| backend | Spring Boot API |
| notification | Go gRPC + WebSocket notification service |
| mongodb | Primary datastore |
| redis | Cache & sessions |
| rabbitmq | Message broker (STOMP relay for WebSocket) |
| minio | S3-compatible photo storage |
| caddy | Reverse proxy with automatic HTTPS |
| prometheus | Metrics collection |
| alertmanager | Alert routing |
| grafana | Metrics dashboards |
| mongo-backup | Scheduled MongoDB backups |

### Required Environment Variables

```bash
# Security — generate with: openssl rand -base64 64
JWT_SECRET=
ACTIVITY_HMAC_SECRET=

# Database
MONGODB_URI=
MONGODB_DATABASE=

# Services
REDIS_PASSWORD=
RABBITMQ_USERNAME=
RABBITMQ_PASSWORD=
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=

# SMTP
SMTP_HOST=
SMTP_USER=
SMTP_PASS=

# Origins
FRONTEND_URL=
CORS_ORIGINS=

# Image tags (default: latest)
INFRA_IMAGE_TAG=
BACKEND_IMAGE_TAG=
NOTIFICATION_IMAGE_TAG=

# Alertmanager webhooks
ALERTMANAGER_WEBHOOK_URL=
ALERTMANAGER_WEBHOOK_URL_CRITICAL=
```

### Deploy

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Infra Images

Prebuilt infra images are published to GHCR on every push to `main`:

| Image | Description |
| ----- | ----------- |
| `ghcr.io/kirjaswappi/kirjaswappi-caddy` | Reverse proxy |
| `ghcr.io/kirjaswappi/kirjaswappi-prometheus` | Metrics |
| `ghcr.io/kirjaswappi/kirjaswappi-alertmanager` | Alerts |
| `ghcr.io/kirjaswappi/kirjaswappi-mongo-backup` | Backup |

All images are tagged with `latest` and full git SHA. Set `INFRA_IMAGE_TAG` to pin a specific build.

## E2E Tests

The e2e suite spins up the full stack via `docker-compose.ci.yml` and validates all services together.

| Area | Coverage |
| ---- | -------- |
| Auth | Registration, email verification, login, 2FA |
| Books | Create, read, list, photo upload |
| Swap requests | Full lifecycle (create → accept → complete) |
| Chat | Real-time messaging within swap requests |
| User profile | Updates, favorites, avatar upload |
| Notifications | gRPC push + WebSocket delivery |

### Run Locally

```bash
docker compose -f docker-compose.ci.yml up -d --build
cd e2e && node run-tests.mjs
```

### Trigger via GitHub Actions

```bash
gh workflow run e2e.yml \
  -f backend_ref=main \
  -f notification_ref=main \
  -f frontend_ref=main
```

## Related Repositories

| Repo | Description |
| ---- | ----------- |
| [kirjaswappi-backend](https://github.com/KirjaSwappi/kirjaswappi-backend) | Java Spring Boot API |
| [kirjaswappi-frontend](https://github.com/KirjaSwappi/kirjaswappi-frontend) | React TypeScript SPA |
| [kirjaswappi-notification](https://github.com/KirjaSwappi/kirjaswappi-notification) | Go notification service |

---

© 2024–2026 KirjaSwappi. All rights reserved. See [LICENSE](LICENSE) for terms.
