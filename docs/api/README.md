# API Usage

The NestJS API exposes OpenAPI documentation through Swagger at `/docs` when the service is running.

Phase 1 endpoints:

- `GET /api` returns service metadata.
- `GET /api/health/live` returns process liveness.
- `GET /api/health/ready` verifies that the API can query PostgreSQL.

All future tenant-scoped endpoints should accept tenant context from authenticated JWT claims, not from caller-controlled request bodies. Controllers should stay thin and delegate authorization, validation, and persistence to services and repositories.
