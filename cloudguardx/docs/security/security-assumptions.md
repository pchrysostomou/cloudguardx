# Security Assumptions

CloudGuardX treats tenants, cloud metadata, scan output, and remediation requests as untrusted.

Initial assumptions:

- Tenant isolation is enforced in services and repositories by authenticated tenant context.
- Controllers must not trust tenant IDs supplied in request bodies.
- Refresh tokens are stored as hashes and tracked by token family.
- External IDs, future OAuth secrets, and MFA secrets are stored encrypted.
- Cloud metadata is escaped in UI rendering and isolated from AI system prompts.
- Remediation guidance is advisory only and must not execute cloud changes.
- Scanner AWS credentials are read-only and scoped to supported inventory APIs.
- Audit logs are append-only at the application layer.
- Errors returned to clients are safe and do not include secrets, SQL details, stack traces, or raw provider credentials.

