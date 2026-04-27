# CloudGuardX

A multi-tenant **Cloud Security Posture Management (CSPM)** platform built as a production-style monorepo. CloudGuardX scans AWS infrastructure, surfaces security findings with risk scores, maps controls to compliance frameworks, and generates AI-assisted remediation guidance — all running locally without real cloud credentials.

> Built as a portfolio project demonstrating full-stack architecture, security engineering patterns, and production engineering practices.

---

## Screenshots

> Screenshots are captured from a running local instance. Follow the [Local setup](#local-setup) steps, seed the database, and open `http://localhost:5173` to see the full UI.

Key views: **Login page** → **Overview dashboard** (posture metrics + severity chart) → **Cloud Accounts** (status cards + connect modal) → **Assets inventory** → **Findings table** (filterable) → **Finding detail** (risk breakdown + status update + activity log).

---

## Demo walkthrough

**1. Sign in**
Navigate to `http://localhost:5173`. The login page is pre-filled with demo credentials — click **Sign in**.

**2. Overview dashboard**
See five posture metrics (accounts, assets, open findings, critical findings, max risk score), a live **Findings by Severity** chart, recent findings, asset mix breakdown, and a priority queue of unresolved critical/high issues.

**3. Cloud Accounts**
Open the **Cloud Accounts** page to see connected AWS accounts with their scan status. Click **Connect AWS Account** to open the onboarding modal — fill in an account name, 12-digit AWS account ID, IAM Role ARN, and use the auto-generated External ID for the trust policy.

**4. Assets inventory**
The **Assets** page lists every discovered resource — EC2 instances, S3 buckets, IAM roles, RDS instances, and more — with sensitivity and criticality ratings from the risk engine.

**5. Findings**
Filter findings by severity or status. Click any finding to open the detail view.

**6. Finding detail**
See the full risk score breakdown, evidence JSON, and metadata. Use the **Update status** segmented control to move a finding from Open → Triaged → Resolved. Every status change is recorded in the **Activity log** panel in real time.

---

## Architecture

```
┌─────────────┐   HTTP/REST   ┌────────────────────────────┐
│  React SPA  │ ────────────► │       NestJS API           │
│  (Vite)     │ ◄──── JWT ─── │  Auth · RBAC · Findings    │
└─────────────┘               │  Assets · Compliance        │
                               │  Remediations · Audit log  │
                               └──────────┬─────────────────┘
                                          │ Prisma ORM
                               ┌──────────▼─────────────────┐
                               │       PostgreSQL            │
                               │  30+ models, migrations     │
                               └──────────┬─────────────────┘
                                          │
               ┌──────────────────────────┤
               │                          │
┌──────────────▼──────┐      ┌────────────▼───────┐
│   Scanner Worker    │      │       Redis         │
│   (NestJS)          │      │  (future: queues)   │
│  Poll → scan jobs   │      └────────────────────┘
│  AWS SDK mock       │
│  LocalStack-safe    │
└─────────────────────┘
```

**Why a separate worker?**
Scanning AWS accounts is long-running and I/O-bound. Decoupling it from the API keeps HTTP responses fast, allows independent scaling, and enables job retries without affecting the request cycle.

**Why a monorepo?**
Shared TypeScript types (`packages/shared-types`) ensure the API, worker, and frontend all use the same domain model at compile time — no runtime drift between what the API returns and what the UI expects.

**Why Prisma?**
The schema captures 30+ domain models including findings, assets, policies, compliance mappings, attack graph nodes/edges, and refresh token families. Prisma migrations provide a reproducible, auditable database history.

**Key security patterns:**
- JWT access tokens (10 min TTL) + rotating refresh tokens with family tracking and reuse detection
- Role-based access control (OWNER → ADMIN → SECURITY_ANALYST → READ_ONLY) enforced at the guard layer
- Field-level encryption for sensitive data (AWS role ARNs, external IDs)
- Prompt injection defences and deterministic output in the AI remediation module
- Helmet + CORS + input validation on every API boundary

---

## Repository layout

```
apps/
  api/       NestJS HTTP API (auth, RBAC, all domain modules)
  web/       React + Vite dashboard
  worker/    Background scanner worker (poll-based job queue)
packages/
  shared-types/    Domain types shared across apps
  policy-engine/   Policy evaluation boundary
  risk-engine/     Risk scoring boundary
  aws-connectors/  AWS connector boundary (LocalStack-safe)
  ui/              Shared UI component boundary
infra/
  docker/     Per-service Dockerfiles
  nginx/      Web production reverse-proxy config
  postgres/   DB bootstrap SQL
  localstack/ AWS emulation init scripts
docs/
  deployment/ Local development guide
```

---

## Local setup

**Prerequisites:** Node.js ≥ 22.12, npm ≥ 10, Docker Desktop (or local PostgreSQL + Redis)

```bash
# 1. Clone and install
cp .env.example .env
npm install

# 2. Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate:dev

# 3. Seed demo data (creates demo@cloudguardx.local account)
npm run db:seed

# 4. Start infrastructure
docker compose up -d postgres redis localstack

# 5. Start all three apps in one command
npm run dev:all
```

Or run each app in a separate terminal:

```bash
npm run dev:api      # NestJS API  → http://localhost:3000
npm run dev:worker   # Scanner worker
npm run dev:web      # React SPA   → http://localhost:5173
```

**Local URLs:**

| Service | URL |
|---|---|
| Web dashboard | http://localhost:5173 |
| API | http://localhost:3000/api |
| Swagger docs | http://localhost:3000/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| LocalStack (AWS) | http://localhost:4566 |

---

## Demo credentials

`npm run db:seed` creates a demo account:

| Field | Value |
|---|---|
| Email | `demo@cloudguardx.local` |
| Password | `CloudGuardX-Demo-123!` |

The web login page is pre-filled with these credentials.

---

## Docker-only flow

```bash
docker compose up -d postgres redis localstack
docker compose run --rm api npm run db:migrate:dev
docker compose run --rm api npm run db:seed
docker compose up --build api worker web
```

The web service is available at `http://localhost:5173`.

---

## Validation

```bash
npm run db:generate
npm run lint
npm run typecheck
npm run test
npm run build
```

---

## Safety notes

- `.env` is git-ignored. Only `.env.example` is committed.
- The AI remediation module uses `MockAIProvider` by default — no OpenAI key required.
- Remediation output is stored as guidance only. CloudGuardX never executes AWS CLI commands, applies Terraform, or calls any AWS remediation API.
- LocalStack and mock scanner paths are for development only.
