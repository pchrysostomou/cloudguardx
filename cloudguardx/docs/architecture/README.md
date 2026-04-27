# Architecture

CloudGuardX is organized as a monorepo with three deployable applications and reusable domain packages.

## Applications

- `apps/api`: NestJS HTTP API, request validation, OpenAPI generation, authentication, authorization, and tenant-aware application services.
- `apps/worker`: background process for scan queues, AWS read-only collection, policy evaluation, risk scoring, notifications, and asynchronous remediation generation.
- `apps/web`: React dashboard for posture, assets, findings, compliance, attack paths, remediation, audit logs, notifications, settings, and user administration.

## Packages

- `packages/shared-types`: shared domain enums and TypeScript contracts.
- `packages/aws-connectors`: AWS read-only connector boundary.
- `packages/policy-engine`: isolated policy evaluation boundary.
- `packages/risk-engine`: isolated risk scoring boundary.
- `packages/ui`: shared UI constants and components.

## Clean Architecture Rules

- Controllers translate HTTP input and output only.
- Services hold application workflows.
- Repositories own database access.
- Scanner modules are isolated from API controllers.
- Policy and risk engines are imported as packages rather than embedded inside controllers.
- Tenant-scoped tables include `tenantId` and are indexed for authorization checks.
- Security-sensitive text from cloud metadata is stored as data and must not become system prompts, SQL fragments, shell fragments, or HTML.

