# CloudGuardX

CloudGuardX is a full-stack Cloud Security Posture Management (CSPM) demo platform for discovering cloud assets, detecting security findings, and prioritising risk across a tenant-scoped environment.

It models the core shape of a modern security SaaS product: a NestJS API, React dashboard, PostgreSQL data model, JWT authentication, RBAC-style permissions, background worker processing, and mock AWS scanning workflows. The project is designed as a public portfolio repository that demonstrates engineering architecture and product thinking without requiring real cloud credentials.

## Screenshots

> Add screenshots to `docs/screenshots/` using these filenames.

![CloudGuardX overview dashboard](docs/screenshots/overview.png)

![Cloud asset inventory](docs/screenshots/assets.png)

![Security findings list](docs/screenshots/findings.png)

![Finding detail workflow](docs/screenshots/finding-detail.png)

## Features

- Cloud asset inventory with AWS S3 demo resources
- Security finding detection, including public S3 bucket exposure
- CSPM-style risk scoring using exploitability, exposure, sensitivity, and criticality signals
- Findings lifecycle management: Open, Triaged, Risk Accepted, and Resolved
- JWT-based authentication with refresh tokens
- RBAC-style permission checks in the API
- Multi-tenant domain model for users, memberships, tenants, assets, findings, and cloud accounts
- Background worker service for scanner-style processing
- Demo seed data for a realistic local walkthrough
- Docker-based local infrastructure with PostgreSQL, Redis, and LocalStack

## What This Demonstrates

- Full-stack TypeScript architecture across API, worker, frontend, and shared packages
- Secure backend design patterns: JWT auth, validation, permission checks, and tenant-scoped access
- Multi-tenant modelling for SaaS-style security products
- Background worker processing for asynchronous scan workflows
- Prisma and PostgreSQL data modelling with migrations and seed data
- CSPM-style risk prioritisation and finding lifecycle workflows
- Clean monorepo organisation using npm workspaces

## Architecture Overview

```text
                 +----------------------+
                 |  React + Vite Web UI |
                 |  localhost:5173      |
                 +----------+-----------+
                            |
                            | /api via Vite dev proxy
                            v
                 +----------------------+
                 |  NestJS API          |
                 |  localhost:3000/api  |
                 +----------+-----------+
                            |
                 +----------+-----------+
                 |                      |
                 v                      v
        +----------------+      +-------------------+
        | PostgreSQL     |      | Redis / Worker    |
        | Prisma ORM     |      | scan processing   |
        +----------------+      +---------+---------+
                                           |
                                           v
                                  +----------------+
                                  | Mock AWS layer |
                                  | LocalStack     |
                                  +----------------+
```

The web app calls `/api/*` during development. Vite proxies those requests to the NestJS API, while the API persists data through Prisma and coordinates scanner-style work with the worker service.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| API | NestJS, Node.js, TypeScript |
| Worker | NestJS application context |
| Database | PostgreSQL, Prisma |
| Auth | JWT access tokens, refresh tokens |
| Infrastructure | Docker Compose, Redis, LocalStack |
| Monorepo | npm workspaces |

## Local Development Setup

Requirements:

- Node.js 22.12 or newer
- npm 10 or newer
- Docker Desktop or Docker Engine
- macOS or Linux

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/cloudguardx.git
cd cloudguardx
cp .env.example .env
npm install
```

Start local infrastructure:

```bash
docker compose up -d postgres redis localstack
```

Prepare the database:

```bash
npm run db:generate
npm run db:migrate:dev
npm run db:seed
```

Run the services in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:worker
```

```bash
npm run dev:web
```

Local URLs:

| Service | URL |
| --- | --- |
| Web app | `http://localhost:5173` |
| API | `http://localhost:3000/api` |
| Swagger docs | `http://localhost:3000/docs` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| LocalStack | `http://localhost:4566` |

## Demo Credentials

The seed script creates a demo tenant, user, AWS account, S3 asset, and security finding.

```text
Email: demo@cloudguardx.local
Password: CloudGuardX-Demo-123!
```

Login with the API:

```bash
curl -s http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@cloudguardx.local","password":"CloudGuardX-Demo-123!"}'
```

Use the returned `accessToken` for API requests:

```bash
curl http://localhost:3000/api/assets \
  -H "Authorization: Bearer <accessToken>"
```

To authenticate the browser dashboard during local development, open DevTools and run:

```js
localStorage.setItem("cloudguardx.accessToken", "<accessToken>");
location.reload();
```

## Project Structure

```text
cloudguardx/
├── apps/
│   ├── api/          # NestJS HTTP API
│   ├── web/          # React + Vite dashboard
│   └── worker/       # Background scanner worker
├── packages/
│   ├── shared-types/ # Shared domain types
│   ├── policy-engine/
│   ├── risk-engine/
│   ├── aws-connectors/
│   └── ui/
├── infra/            # Docker, LocalStack, nginx, PostgreSQL notes
├── docs/             # Architecture, security, testing, and domain notes
├── scripts/
├── docker-compose.yml
└── package.json
```

The root `package.json` uses npm workspaces to coordinate builds, tests, and local development across the API, worker, web app, and shared packages.

## Troubleshooting

### `DATABASE_URL` missing

Copy the example environment file before running Prisma or the API:

```bash
cp .env.example .env
```

Then verify `DATABASE_URL` points to the local Docker PostgreSQL instance.

### Docker or PostgreSQL is not running

Start the required services and wait for the health checks to pass:

```bash
docker compose up -d postgres redis localstack
docker compose ps
```

If migrations fail, confirm PostgreSQL is listening on `localhost:5432`.

### Browser token is not set

If the dashboard shows `API access token not found`, log in through the API and store the returned token:

```js
localStorage.setItem("cloudguardx.accessToken", "<accessToken>");
location.reload();
```

### Vite API proxy

In development, the web app should call `/api/assets`, `/api/findings`, and `/api/cloud-accounts` on `localhost:5173`. Vite proxies those requests to `http://localhost:3000`.

If those routes return Vite `404` responses, restart the web dev server:

```bash
npm run dev:web
```

Also confirm the API is running:

```bash
curl http://localhost:3000/api/health/live
```

## Security Note

CloudGuardX is a demo system. It does not require real AWS credentials and does not call production AWS APIs. The AWS scanner path uses mock providers and LocalStack-safe local infrastructure so the project can be explored without connecting to a real cloud account.

The local `.env.example` values are development placeholders. Replace secrets before using any shared or deployed environment.

## Limitations

- This is not a production-ready CSPM platform.
- AWS integrations are mocked for local demonstration.
- Scanner workflows are designed to show architecture, not production scale.
- Risk scoring and policy checks are intentionally simplified.
- Deployment hardening, secrets management, observability, and high availability are outside the current scope.

## Future Improvements

- Real AWS onboarding with cross-account IAM role assumptions
- Queue-backed worker jobs with retries and dead-letter handling
- Additional cloud asset types and policy checks
- End-to-end tests for dashboard and API workflows
- Audit log UI and tenant administration screens
- Deployment manifests and production observability

## License

MIT License placeholder.
