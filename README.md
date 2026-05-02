# KirjaSwappi Infrastructure

[![E2E Integration Tests](https://github.com/KirjaSwappi/kirjaswappi-infra/actions/workflows/e2e.yml/badge.svg)](https://github.com/KirjaSwappi/kirjaswappi-infra/actions/workflows/e2e.yml)

Infrastructure, deployment, and end-to-end testing for the [KirjaSwappi](https://github.com/KirjaSwappi) book exchange platform.

## Repository Structure

```
├── .github/workflows/   CI/CD pipelines
├── docker-compose.prod.yml   Production stack (all services)
├── docker-compose.ci.yml     Minimal CI stack for e2e tests
├── e2e/                      End-to-end test suite
│   ├── tests/                API integration tests (Node.js)
│   ├── ui-tests/             UI tests (Playwright + Chromium)
│   ├── lib/                  Shared test utilities
│   └── Dockerfile.frontend   Frontend build for CI
├── Caddyfile                 Reverse proxy configuration
├── docker/                   Custom Docker images
├── prometheus/               Monitoring configuration
├── alertmanager/             Alert routing rules
└── scripts/                  Deployment & maintenance scripts
```

## E2E Test Suite

The e2e suite validates that all KirjaSwappi services work correctly together across repository boundaries.

### API Tests (6 tests)

| Test | Coverage |
|------|----------|
| Signup & Login | User registration, email verification, authentication |
| Book CRUD | Create, read, list books with multipart uploads |
| Swap Requests | Request lifecycle (create, accept, reject) |
| Chat | Real-time messaging within swap requests |
| User Profile | Profile updates, favorites, avatar upload |
| Notifications | gRPC push + WebSocket delivery |

### UI Tests (10 tests, Playwright)

| Test | Coverage |
|------|----------|
| Registration form | Renders fields, validates input |
| Login | Credentials flow, redirect to home |
| Add book form | Multi-step form rendering, step navigation |
| Book on profile | Book appears after creation |
| Book details | Detail page renders title/author |
| Swap request | Full swap flow between two users |
| Invalid login | Error message display |
| Password mismatch | Client-side validation |
| Protected routes | Redirect to login when unauthenticated |
| Register link | Navigation between auth pages |

### Running Locally

```bash
# Start the CI stack
docker compose -f docker-compose.ci.yml up -d --build

# Run API tests
cd e2e && node run-tests.mjs

# Run UI tests (requires Playwright browsers)
cd e2e && npx playwright install chromium
cd e2e && npx playwright test
```

### Running via GitHub Actions

```bash
gh workflow run e2e.yml \
  -f backend_ref=main \
  -f notification_ref=main \
  -f frontend_ref=main
```

## Production Stack

The production compose file (`docker-compose.prod.yml`) includes:

- **Backend** — Spring Boot API (Java)
- **Frontend** — React SPA served by Nginx
- **Notification** — Go gRPC + WebSocket service
- **MongoDB** — Primary datastore
- **Redis** — Caching & sessions
- **RabbitMQ** — Message broker (STOMP for WebSocket relay)
- **MinIO** — S3-compatible object storage (book cover photos)
- **Caddy** — Reverse proxy with automatic HTTPS
- **Prometheus + Alertmanager** — Monitoring & alerts

## Related Repositories

| Repo | Description |
|------|-------------|
| [kirjaswappi-backend](https://github.com/KirjaSwappi/kirjaswappi-backend) | Java Spring Boot API |
| [kirjaswappi-frontend](https://github.com/KirjaSwappi/kirjaswappi-frontend) | React TypeScript SPA |
| [kirjaswappi-notification](https://github.com/KirjaSwappi/kirjaswappi-notification) | Go notification service (gRPC + WebSocket) |
