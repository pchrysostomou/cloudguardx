# AWS Onboarding

CloudGuardX will onboard AWS accounts through a customer-created read-only IAM role with an external ID.

Phase 1 stores the required schema fields:

- AWS account ID
- role ARN
- encrypted external ID
- account status
- scan timestamps and errors

Least-privilege scanner permissions are introduced in Phase 3 with LocalStack-backed tests. The scanner must use read-only AWS APIs and must not call mutating AWS operations.

