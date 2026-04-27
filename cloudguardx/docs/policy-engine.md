# Policy Engine

The policy engine is reserved as an isolated package so cloud resource normalization, policy evaluation, and finding creation can be tested independently from HTTP controllers.

Required initial policies for later phases:

- S3 bucket must not be public.
- S3 Block Public Access must be enabled.
- Security groups must not expose SSH or RDP to `0.0.0.0/0`.
- IAM policies must not allow `Action: "*"`.
- IAM users must not have old access keys.
- Root account MFA must be enabled.
- CloudTrail must be enabled.
- RDS instances must not be public and must use encryption.
- Lambda functions must not expose secrets in environment variables.
- ECR images must not contain critical CVEs.
- KMS keys must not be public.

Policy tests should feed normalized AWS resources into the engine directly and assert deterministic pass/fail results plus evidence.

