# Threat Model

## Assets

- tenant data and cloud inventory
- findings, compliance results, and attack paths
- AWS role ARNs and external IDs
- refresh tokens, API keys, and MFA secrets
- AI remediation prompts and generated guidance
- audit logs

## Primary Threats

- malicious tenant attempts cross-tenant reads or writes
- compromised user account attempts privilege escalation
- stolen refresh token is reused after rotation
- compromised scanner worker attempts cloud mutation or data exfiltration
- AWS role is misconfigured with excessive permissions
- SSRF through cloud metadata, tags, URLs, or remediation inputs
- prompt injection through malicious AWS names, tags, policy documents, or environment variables
- database leakage exposes secrets or tenant data
- broken access control allows read-only users to mutate resources
- remediation suggestions include unsafe destructive commands

## Phase 1 Controls

- tenant-scoped schema design
- explicit hashed and encrypted sensitive-field naming
- isolated worker process
- separate policy, risk, and connector package boundaries
- Swagger and validation configured at API bootstrap
- security headers through Helmet
- docs capturing assumptions before feature work begins

Detailed mitigations become executable in the owning implementation phases.

