# CloudGuardX

CloudGuardX is a private-portfolio Cloud Security Posture Management platform built as a multi-tenant SaaS monorepo. It includes a NestJS API, background scanner worker, React dashboard, Prisma/PostgreSQL persistence, Redis-ready infrastructure, LocalStack-safe AWS emulation, RBAC, audit logging, risk scoring, compliance and attack-path foundations, and safe AI remediation guidance through a mock provider.

The project is designed to run locally without real external API keys. It does not connect to production AWS, OpenAI, or Llama APIs.

## What Is Included

- Multi-tenant auth, memberships, RBAC, and audit logs
- AWS read-only onboarding and scanner boundaries with mock/safe local providers
- Findings, assets, policies, risk scores, compliance mappings, attack paths, and remediation records
- AI remediation assistant with prompt-injection defenses and deterministic mock output
- PostgreSQL, Redis, and LocalStack Docker Compose setup
- Prisma migration and safe demo seed data
- Workspace lint, typecheck, test, build, and CI workflow

## Repository Layout

```text
apps/
  api/       NestJS HTTP API
  web/       React dashboard
  worker/    background scanner worker
packages/
  shared-types/    shared domain types
  policy-engine/   policy evaluation boundary
  risk-engine/     risk scoring boundary
  aws-connectors/  AWS connector boundary
  ui/              shared UI boundary
infra/
  docker/     Dockerfiles
  nginx/      web production nginx config
  postgres/   database bootstrap
  redis/      cache notes
  localstack/ LocalStack notes and init scripts
docs/          architecture, security, deployment, API, and testing notes
```

## Local Setup

Prerequisites:

- Node.js 22.12 or newer
- npm 10 or newer
- Docker Desktop, or local PostgreSQL/Redis with matching URLs

Setup:

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:validate
npm run db:migrate:dev
npm run db:seed
```

Start dependencies with Docker:

```bash
docker compose up -d postgres redis localstack
```

Start the apps in three terminals:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```

Local URLs:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Web: `http://localhost:5173` or the next Vite port shown in the terminal
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- LocalStack: `http://localhost:4566`

## Demo Login

`npm run db:seed` creates:

- Email: `demo@cloudguardx.local`
- Password: `CloudGuardX-Demo-123!`

Get an access token:

```bash
curl -s http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@cloudguardx.local","password":"CloudGuardX-Demo-123!"}'
```

Then set the returned `accessToken` in the browser console:

```js
localStorage.setItem("cloudguardx.accessToken", "<access-token>");
location.reload();
```

## Docker-Only Flow

```bash
docker compose up -d postgres redis localstack
docker compose run --rm api npm run db:migrate:dev
docker compose run --rm api npm run db:seed
docker compose up --build api worker web
```

The web service is available at `http://localhost:5173`.

## Validation

```bash
npm run db:generate
npm run db:validate
npm run db:migrate:dev
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run build` now cleans the API and worker build outputs before Nest builds, so `dist/main.js` is reliably emitted for local and Docker starts.

## Safety Notes

- `.env` is ignored by git. Commit only `.env.example`.
- The AI remediation assistant uses `MockAIProvider` by default.
- Generated remediation is stored as guidance only. CloudGuardX never executes AWS CLI commands, never calls AWS APIs for remediation, and never applies Terraform.
- LocalStack and mock scanner paths are for development only.
