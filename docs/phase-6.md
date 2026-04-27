# Phase 6 Notes

Phase 6 adds compliance mapping, deterministic attack graph generation, and remediation guidance.

## Compliance Mapping

- Findings are mapped to CIS AWS-style controls through built-in policy keys.
- Compliance framework and control definitions are global reference data.
- Compliance mappings are tenant-scoped records and must always be queried with the authenticated `tenantId`.
- Repeated failing scans replace mappings for the finding before writing current mappings, preventing duplicate active mapping records for the same finding.
- Resolved findings keep their historical compliance mappings, but summaries expose the finding status so callers can distinguish resolved findings from open compliance exposure.

## Attack Graph

- The attack graph is deterministic and CSPM-derived.
- It is built from CloudGuardX assets and active findings only.
- It is not a full exploit-path simulator, IAM reachability solver, network path tracer, or proof of exploitability.
- Nodes and edges are rebuilt for the tenant during scan completion from tenant-scoped assets and active tenant-scoped findings.
- Resolved findings are excluded from graph edge generation.

## Remediation Guidance

- Remediation records are non-destructive guidance only.
- Phase 6 does not execute AWS CLI commands, Terraform, cloud SDK calls, or automatic cloud changes.
- Generated records set `isDestructive` to `false`, `terraformPatch` to `null`, and `awsCliCommands` to `null`.
- Technical debt: deterministic built-in guidance currently uses the existing `human` remediation source enum value because the schema only has `human` and `ai`. A future migration should add a non-AI `builtin` or `system` source before AI-generated guidance is introduced.

## Schema And Migration Risk

- The Prisma schema already contains the Phase 6 tables and enums.
- The repository currently has no Prisma migration history, so deployments must ensure the live database has the schema represented by `apps/api/prisma/schema.prisma` before enabling Phase 6 endpoints or workers.
