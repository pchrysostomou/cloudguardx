# Testing Strategy

Phase 1 includes workspace-level test entry points and smoke tests.

Planned coverage:

- unit tests for services, guards, policy evaluators, and risk scoring
- integration tests for Prisma repositories, tenant isolation, auth flows, and scanner persistence
- scanner tests against mocked AWS clients and LocalStack
- API tests for auth, RBAC, tenant isolation, findings, compliance, and remediation
- frontend component tests for dashboard states and user flows
- E2E flows for onboarding, scanning, finding triage, compliance review, and user administration
- security tests for prompt injection, SSRF controls, token reuse detection, and broken access control

Required cases from the product brief are tracked here until their owning phases add executable tests.

