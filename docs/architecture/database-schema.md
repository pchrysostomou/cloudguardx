# Database Schema

The Phase 1 Prisma schema defines the core CloudGuardX data model:

- identity and tenancy: `users`, `tenants`, `memberships`, `roles`, `permissions`
- cloud onboarding and scans: `cloud_accounts`, `scan_jobs`, `scan_events`
- posture inventory: `assets`, `findings`, `policies`, `policy_results`, `risk_scores`
- compliance: `compliance_frameworks`, `compliance_controls`, `compliance_mappings`
- attack paths: `attack_graph_nodes`, `attack_graph_edges`
- action support: `remediations`, `audit_logs`, `notifications`
- security state: `api_keys`, `refresh_tokens`, `mfa_devices`

Most operational tables are tenant-scoped. Global tables are limited to users, permissions, and compliance framework definitions. Tenant-scoped relations use compound foreign keys where a tenant-scoped record points to another tenant-scoped record, giving the application-layer tenant checks a database-level backstop.

Refresh tokens include token family tracking so Phase 2 can implement rotation and reuse detection without changing the schema.

Sensitive fields are named explicitly with `Ciphertext` or `Hash` suffixes to keep storage expectations visible in code review.
