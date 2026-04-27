# LocalStack

LocalStack is included for scanner integration tests and local AWS onboarding flows.

Enabled services mirror the initial AWS support target: S3, EC2, IAM, STS, CloudTrail, RDS, Lambda, ECR, Secrets Manager, and KMS.

The `init/` directory contains local-only bootstrap resources for future scanner integration tests. These resources must never be used as production IAM policy examples; production onboarding uses a customer-created read-only role and a tenant-specific external ID.
