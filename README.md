# CloudGuardX

CloudGuardX is a production-oriented Cloud Security Posture Management platform built as a multi-tenant SaaS monorepo.

Phase 1 establishes the foundations:

- npm workspaces monorepo
- NestJS API skeleton with Swagger, validation, security middleware, and Prisma integration
- React and TypeScript dashboard shell
- standalone NestJS worker skeleton
- PostgreSQL, Redis, LocalStack, and service Docker Compose stack
- Prisma schema covering the core security domain tables
- shared TypeScript types package
- initial architecture, security, deployment, API, and testing documentation

Later phases add authentication, tenant isolation enforcement, AWS onboarding, scanner workers, policy evaluation, risk scoring, compliance mapping, attack paths, remediation, notifications, and hardened CI.

## Repository Layout

```text
apps/
  api/       NestJS HTTP API
  web/       React dashboard
  worker/    background scanner and async jobs process
packages/
  shared-types/    cross-app domain types and enums
  policy-engine/   isolated policy evaluation boundary
  risk-engine/     isolated risk scoring boundary
  aws-connectors/  AWS read-only connector boundary
  ui/              shared React UI boundary
infra/
  docker/     application Dockerfiles
  nginx/      local reverse proxy configuration
  postgres/   database bootstrap
  redis/      cache configuration location
  localstack/ AWS emulator configuration location
docs/          architecture, security, deployment, and API notes
tests/         cross-service integration, E2E, and security test suites
```

## Local Development

1. Copy `.env.example` to `.env` and replace secrets before sharing the environment with anyone else.
2. Install dependencies:

```bash
npm install
```

3. Generate the Prisma client:

```bash
npm run db:generate
```

4. Start PostgreSQL, Redis, LocalStack, and the app containers:

```bash
npm run compose:up
```

For app-only development, run services locally after PostgreSQL and Redis are available:

```bash
npm run start:dev --workspace @cloudguardx/api
npm run dev --workspace @cloudguardx/web
npm run start:dev --workspace @cloudguardx/worker
```

## API Documentation

When the API is running, Swagger is available at `http://localhost:3000/docs`.

## Phase Boundary

This phase intentionally does not create synthetic cloud findings or scanner output. Scanner behavior, policy logic, risk scoring, auth flows, and remediation generation are added in later phases with tests around each module.
