import { AwsResourceType, FindingSeverity } from "@cloudguardx/shared-types";
import type { CloudAssetRef, PartialRiskScoreFactors } from "@cloudguardx/shared-types";

export interface NormalizedAwsResource {
  resourceType: AwsResourceType | string;
  externalId: string;
  region: string | null;
  name: string;
  metadata: Record<string, unknown>;
}

export interface PolicyEvaluationContext {
  tenantId: string;
  asset: CloudAssetRef;
  normalizedResource: NormalizedAwsResource;
  evaluatedAt: string;
  parameters?: Record<string, unknown> | null;
}

export interface PolicyFailureDetails {
  title: string;
  description: string;
  severity: FindingSeverity;
  riskFactors: PartialRiskScoreFactors;
}

export interface PolicyEvaluationResult {
  policyKey: string;
  passed: boolean;
  evidence: Record<string, unknown>;
  failure?: PolicyFailureDetails;
}

export interface PolicyDefinition {
  key: string;
  name: string;
  description: string;
  severity: FindingSeverity;
  implementation: string;
  appliesTo: AwsResourceType[];
  evaluate: (context: PolicyEvaluationContext) => PolicyEvaluationResult;
}

export const defaultPolicyDefinitions: readonly PolicyDefinition[] = [
  {
    key: "aws_s3_bucket_public_access_prohibited",
    name: "S3 buckets must not be public",
    description: "Detects S3 buckets with public ACL or bucket policy access.",
    severity: FindingSeverity.High,
    implementation: "builtin:aws.s3.public_access_prohibited",
    appliesTo: [AwsResourceType.S3Bucket],
    evaluate: evaluateS3PublicAccess
  },
  {
    key: "aws_s3_block_public_access_enabled",
    name: "S3 Block Public Access must be enabled",
    description: "Requires all S3 Block Public Access controls to be enabled.",
    severity: FindingSeverity.Medium,
    implementation: "builtin:aws.s3.block_public_access_enabled",
    appliesTo: [AwsResourceType.S3Bucket],
    evaluate: evaluateS3BlockPublicAccess
  },
  {
    key: "aws_security_group_no_world_open_admin_ports",
    name: "Security groups must not expose SSH or RDP to the internet",
    description: "Detects ingress rules exposing TCP 22 or 3389 to 0.0.0.0/0 or ::/0.",
    severity: FindingSeverity.High,
    implementation: "builtin:aws.security_group.no_world_open_admin_ports",
    appliesTo: [AwsResourceType.SecurityGroup],
    evaluate: evaluateSecurityGroupAdminIngress
  },
  {
    key: "aws_iam_policy_no_wildcard_admin",
    name: "IAM policies must not allow wildcard administration",
    description: "Detects IAM policy statements that allow every action on every resource.",
    severity: FindingSeverity.Critical,
    implementation: "builtin:aws.iam_policy.no_wildcard_admin",
    appliesTo: [AwsResourceType.IamPolicy],
    evaluate: evaluateIamPolicyWildcardAdmin
  },
  {
    key: "aws_iam_user_no_old_access_keys",
    name: "IAM users must not have old access keys",
    description: "Detects IAM user access keys older than the configured maximum age.",
    severity: FindingSeverity.Medium,
    implementation: "builtin:aws.iam_user.no_old_access_keys",
    appliesTo: [AwsResourceType.IamUser],
    evaluate: evaluateIamUserOldAccessKeys
  },
  {
    key: "aws_root_account_mfa_enabled",
    name: "Root account MFA must be enabled",
    description: "Detects AWS root account identities without MFA enabled.",
    severity: FindingSeverity.Critical,
    implementation: "builtin:aws.root_account.mfa_enabled",
    appliesTo: [AwsResourceType.IamUser],
    evaluate: evaluateRootMfa
  },
  {
    key: "aws_cloudtrail_enabled",
    name: "CloudTrail must be enabled",
    description: "Detects CloudTrail trails that are not currently logging.",
    severity: FindingSeverity.High,
    implementation: "builtin:aws.cloudtrail.enabled",
    appliesTo: [AwsResourceType.CloudTrailTrail],
    evaluate: evaluateCloudTrailEnabled
  },
  {
    key: "aws_rds_instance_not_public_encrypted",
    name: "RDS instances must not be public and must use encryption",
    description: "Detects RDS instances that are publicly accessible or lack storage encryption.",
    severity: FindingSeverity.High,
    implementation: "builtin:aws.rds.not_public_encrypted",
    appliesTo: [AwsResourceType.RdsInstance],
    evaluate: evaluateRdsPublicAndEncryption
  },
  {
    key: "aws_lambda_no_plaintext_secret_env",
    name: "Lambda functions must not expose secrets in environment variables",
    description: "Detects Lambda environment variable names that indicate plaintext secrets.",
    severity: FindingSeverity.High,
    implementation: "builtin:aws.lambda.no_plaintext_secret_env",
    appliesTo: [AwsResourceType.LambdaFunction],
    evaluate: evaluateLambdaSecretEnvironment
  },
  {
    key: "aws_ecr_no_critical_cves",
    name: "ECR images must not contain critical CVEs",
    description: "Detects ECR repositories with image scan results containing critical vulnerabilities.",
    severity: FindingSeverity.Critical,
    implementation: "builtin:aws.ecr.no_critical_cves",
    appliesTo: [AwsResourceType.EcrRepository],
    evaluate: evaluateEcrCriticalCves
  },
  {
    key: "aws_kms_key_not_public",
    name: "KMS keys must not be public",
    description: "Detects KMS key policies that allow public access.",
    severity: FindingSeverity.Critical,
    implementation: "builtin:aws.kms.key_not_public",
    appliesTo: [AwsResourceType.KmsKey],
    evaluate: evaluateKmsPublicAccess
  }
];

export function evaluateDefaultPolicies(context: PolicyEvaluationContext): PolicyEvaluationResult[] {
  return defaultPolicyDefinitions
    .filter((definition) => policyAppliesToAsset(definition, context.asset.resourceType))
    .map((definition) => evaluatePolicyDefinition(definition, context));
}

export interface ComplianceControlDefinition {
  key: string;
  title: string;
  description: string;
}

export interface ComplianceFrameworkDefinition {
  key: string;
  name: string;
  version: string;
  description: string;
  controls: readonly ComplianceControlDefinition[];
}

export interface PolicyComplianceMappingDefinition {
  policyKey: string;
  controlKey: string;
  rationale: string;
}

export interface RemediationGuidanceDefinition {
  policyKey: string;
  title: string;
  guidanceMarkdown: string;
}

export const cisAwsFrameworkDefinition: ComplianceFrameworkDefinition = {
  key: "cis_aws_foundations",
  name: "CIS AWS Foundations-style controls",
  version: "phase-6",
  description: "Initial CloudGuardX CIS AWS-style control set mapped from deterministic AWS posture policies.",
  controls: [
    {
      key: "cis-aws-s3-1",
      title: "S3 buckets should block public access",
      description: "Object storage should not expose bucket contents through public ACLs or public bucket policies."
    },
    {
      key: "cis-aws-s3-2",
      title: "S3 Block Public Access should be enabled",
      description: "All S3 Block Public Access settings should be enabled for storage resources."
    },
    {
      key: "cis-aws-network-1",
      title: "Administrative ports should not be exposed to the internet",
      description: "Security groups should not allow world-open SSH or RDP ingress."
    },
    {
      key: "cis-aws-iam-1",
      title: "IAM policies should avoid wildcard administration",
      description: "IAM policies should not grant every action on every resource."
    },
    {
      key: "cis-aws-iam-2",
      title: "IAM access keys should be rotated",
      description: "Long-lived IAM user access keys should stay within the configured maximum age."
    },
    {
      key: "cis-aws-iam-3",
      title: "Root account MFA should be enabled",
      description: "The AWS root account should require multi-factor authentication."
    },
    {
      key: "cis-aws-logging-1",
      title: "CloudTrail should be enabled",
      description: "CloudTrail should be actively logging account activity."
    },
    {
      key: "cis-aws-data-1",
      title: "Databases should not be public and should be encrypted",
      description: "RDS instances should not be publicly accessible and should use storage encryption."
    },
    {
      key: "cis-aws-compute-1",
      title: "Compute configuration should not expose plaintext secrets",
      description: "Lambda environment variables should not contain likely plaintext secret values."
    },
    {
      key: "cis-aws-container-1",
      title: "Container images should not contain critical CVEs",
      description: "ECR repositories should not include images with critical vulnerability findings."
    },
    {
      key: "cis-aws-kms-1",
      title: "KMS keys should not allow public access",
      description: "KMS key policies should not grant public access."
    }
  ]
};

export const policyComplianceMappings: readonly PolicyComplianceMappingDefinition[] = [
  {
    policyKey: "aws_s3_bucket_public_access_prohibited",
    controlKey: "cis-aws-s3-1",
    rationale: "Public bucket ACLs and policies directly violate the storage public-access control."
  },
  {
    policyKey: "aws_s3_block_public_access_enabled",
    controlKey: "cis-aws-s3-2",
    rationale: "Missing Block Public Access settings weaken the expected S3 public-access guardrail."
  },
  {
    policyKey: "aws_security_group_no_world_open_admin_ports",
    controlKey: "cis-aws-network-1",
    rationale: "World-open SSH or RDP ingress creates direct administrative exposure."
  },
  {
    policyKey: "aws_iam_policy_no_wildcard_admin",
    controlKey: "cis-aws-iam-1",
    rationale: "Wildcard action and resource grants represent unrestricted administrative permission."
  },
  {
    policyKey: "aws_iam_user_no_old_access_keys",
    controlKey: "cis-aws-iam-2",
    rationale: "Access keys beyond the maximum age require rotation."
  },
  {
    policyKey: "aws_root_account_mfa_enabled",
    controlKey: "cis-aws-iam-3",
    rationale: "Root account access without MFA violates root identity protection expectations."
  },
  {
    policyKey: "aws_cloudtrail_enabled",
    controlKey: "cis-aws-logging-1",
    rationale: "Inactive CloudTrail logging prevents account activity visibility."
  },
  {
    policyKey: "aws_rds_instance_not_public_encrypted",
    controlKey: "cis-aws-data-1",
    rationale: "Public database exposure or missing encryption violates data protection expectations."
  },
  {
    policyKey: "aws_lambda_no_plaintext_secret_env",
    controlKey: "cis-aws-compute-1",
    rationale: "Likely plaintext secrets in function configuration create credential exposure."
  },
  {
    policyKey: "aws_ecr_no_critical_cves",
    controlKey: "cis-aws-container-1",
    rationale: "Critical image vulnerabilities violate container hygiene expectations."
  },
  {
    policyKey: "aws_kms_key_not_public",
    controlKey: "cis-aws-kms-1",
    rationale: "Public KMS key policies violate key-management access expectations."
  }
];

export const remediationGuidanceDefinitions: readonly RemediationGuidanceDefinition[] = [
  {
    policyKey: "aws_s3_bucket_public_access_prohibited",
    title: "Remove public S3 bucket access",
    guidanceMarkdown:
      "Review the bucket ACL and bucket policy. Remove public principals, restrict access to explicit trusted identities, and validate that intended application access still works. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_s3_block_public_access_enabled",
    title: "Enable S3 Block Public Access",
    guidanceMarkdown:
      "Enable all S3 Block Public Access settings at the bucket or account level after confirming no approved public hosting dependency exists. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_security_group_no_world_open_admin_ports",
    title: "Restrict administrative ingress",
    guidanceMarkdown:
      "Replace world-open SSH or RDP ingress with approved private network ranges, VPN access, or a managed session service. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_iam_policy_no_wildcard_admin",
    title: "Reduce wildcard IAM administration",
    guidanceMarkdown:
      "Replace wildcard actions and resources with least-privilege statements scoped to required services and ARNs. Review dependent workloads before applying policy changes. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_iam_user_no_old_access_keys",
    title: "Rotate stale IAM access keys",
    guidanceMarkdown:
      "Create a replacement key, update dependent workloads, verify successful use, then deactivate and delete the old key through the approved change process. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_root_account_mfa_enabled",
    title: "Enable MFA for the AWS root account",
    guidanceMarkdown:
      "Enable MFA on the root account using the organization's approved authenticator process and store recovery material according to policy. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_cloudtrail_enabled",
    title: "Restore CloudTrail logging",
    guidanceMarkdown:
      "Confirm the intended trail configuration, storage destination, and permissions, then re-enable logging through the approved change workflow. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_rds_instance_not_public_encrypted",
    title: "Reduce RDS data exposure",
    guidanceMarkdown:
      "Move the database behind private network access and plan encryption remediation using a snapshot or migration path where required. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_lambda_no_plaintext_secret_env",
    title: "Move Lambda secrets to a managed secret store",
    guidanceMarkdown:
      "Replace likely plaintext environment secrets with references to an approved secret manager and rotate any exposed credentials. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_ecr_no_critical_cves",
    title: "Rebuild vulnerable container images",
    guidanceMarkdown:
      "Patch affected base images and dependencies, rebuild images, rescan them, and promote only verified images through the deployment pipeline. This guidance is informational only and does not change AWS resources."
  },
  {
    policyKey: "aws_kms_key_not_public",
    title: "Restrict KMS key policy principals",
    guidanceMarkdown:
      "Remove public principals from the key policy and scope access to required accounts, roles, or services. This guidance is informational only and does not change AWS resources."
  }
];

export function complianceMappingsForPolicy(policyKey: string): PolicyComplianceMappingDefinition[] {
  return policyComplianceMappings.filter((mapping) => mapping.policyKey === policyKey);
}

export function remediationGuidanceForPolicy(policyKey: string): RemediationGuidanceDefinition {
  return (
    remediationGuidanceDefinitions.find((guidance) => guidance.policyKey === policyKey) ?? {
      policyKey,
      title: "Review finding and apply least-privilege remediation",
      guidanceMarkdown:
        "Review the finding evidence, validate business intent, and apply the smallest safe configuration change through the approved change process. This guidance is informational only and does not change cloud resources."
    }
  );
}

export function evaluatePolicyDefinition(
  definition: PolicyDefinition,
  context: PolicyEvaluationContext
): PolicyEvaluationResult {
  if (!policyAppliesToAsset(definition, context.asset.resourceType)) {
    return {
      policyKey: definition.key,
      passed: true,
      evidence: {
        skipped: true,
        reason: "asset_type_not_applicable",
        assetType: context.asset.resourceType
      }
    };
  }

  return definition.evaluate(context);
}

export function policyAppliesToAsset(definition: PolicyDefinition, assetType: AwsResourceType | string): boolean {
  return definition.appliesTo.includes(assetType as AwsResourceType);
}

function evaluateS3PublicAccess(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const publicAccess = recordValue(context.normalizedResource.metadata.publicAccess);
  const aclAllowsPublicRead = booleanValue(publicAccess.aclAllowsPublicRead);
  const policyAllowsPublicRead = booleanValue(publicAccess.policyAllowsPublicRead);
  const policyAllowsPublicWrite = booleanValue(publicAccess.policyAllowsPublicWrite);
  const isPublic = aclAllowsPublicRead || policyAllowsPublicRead || policyAllowsPublicWrite;
  const evidence = {
    aclAllowsPublicRead,
    policyAllowsPublicRead,
    policyAllowsPublicWrite
  };

  return resultFromPass("aws_s3_bucket_public_access_prohibited", !isPublic, evidence, {
    title: "S3 bucket allows public access",
    description: `${context.asset.name} allows public ACL or bucket policy access.`,
    severity: FindingSeverity.High,
    riskFactors: {
      internetExposure: 9,
      exploitability: 6,
      blastRadius: 7,
      complianceImpact: 7
    }
  });
}

function evaluateS3BlockPublicAccess(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const blockPublicAccess = recordValue(context.normalizedResource.metadata.publicAccessBlock);
  const controls = {
    blockPublicAcls: booleanValue(blockPublicAccess.blockPublicAcls),
    ignorePublicAcls: booleanValue(blockPublicAccess.ignorePublicAcls),
    blockPublicPolicy: booleanValue(blockPublicAccess.blockPublicPolicy),
    restrictPublicBuckets: booleanValue(blockPublicAccess.restrictPublicBuckets)
  };
  const missingControls = Object.entries(controls)
    .filter(([, enabled]) => !enabled)
    .map(([control]) => control);

  return resultFromPass("aws_s3_block_public_access_enabled", missingControls.length === 0, { controls, missingControls }, {
    title: "S3 Block Public Access is not fully enabled",
    description: `${context.asset.name} does not have every S3 Block Public Access control enabled.`,
    severity: FindingSeverity.Medium,
    riskFactors: {
      internetExposure: 6,
      exploitability: 5,
      blastRadius: 5,
      complianceImpact: 7
    }
  });
}

function evaluateSecurityGroupAdminIngress(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const ingressRules = arrayValue(context.normalizedResource.metadata.ingressRules).map(normalizeIngressRule);
  const exposedRules = ingressRules.filter(
    (rule) => cidrIsWorldOpen(rule.cidr) && (portRangeIncludes(rule, 22) || portRangeIncludes(rule, 3389))
  );

  return resultFromPass(
    "aws_security_group_no_world_open_admin_ports",
    exposedRules.length === 0,
    { exposedRules, evaluatedRuleCount: ingressRules.length },
    {
    title: "Security group exposes administrative access to the internet",
    description: `${context.asset.name} allows SSH or RDP ingress from a world-open CIDR range.`,
    severity: FindingSeverity.High,
    riskFactors: {
      internetExposure: 10,
      exploitability: 8,
      blastRadius: 6,
      complianceImpact: 6
    }
    }
  );
}

function evaluateIamPolicyWildcardAdmin(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const statements = arrayValue(context.normalizedResource.metadata.statements).map(recordValue);
  const wildcardStatements = statements.filter((statement) => {
    const effect = stringValue(statement.Effect ?? statement.effect).toLowerCase();
    const actions = stringArrayValue(statement.Action ?? statement.action);
    const resources = stringArrayValue(statement.Resource ?? statement.resource);

    return effect === "allow" && includesWildcard(actions) && includesWildcard(resources);
  });

  return resultFromPass(
    "aws_iam_policy_no_wildcard_admin",
    wildcardStatements.length === 0,
    { wildcardStatementCount: wildcardStatements.length },
    {
      title: "IAM policy allows wildcard administrative access",
      description: `${context.asset.name} includes an Allow statement for every action on every resource.`,
      severity: FindingSeverity.Critical,
      riskFactors: {
        privilegeLevel: 10,
        exploitability: 8,
        blastRadius: 9,
        complianceImpact: 8
      }
    }
  );
}

function evaluateIamUserOldAccessKeys(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const maxAgeDays = numberValue(context.parameters?.maxAgeDays, 90);
  const evaluatedAtMs = Date.parse(context.evaluatedAt);
  const accessKeys = arrayValue(context.normalizedResource.metadata.accessKeys).map(recordValue);
  const oldKeys = accessKeys
    .map((key) => {
      const createdAt = stringValue(key.createdAt);
      const ageDays = Number.isFinite(evaluatedAtMs) ? ageInDays(createdAt, evaluatedAtMs) : 0;

      return {
        keyId: stringValue(key.keyId),
        createdAt,
        ageDays
      };
    })
    .filter((key) => key.ageDays > maxAgeDays);

  return resultFromPass("aws_iam_user_no_old_access_keys", oldKeys.length === 0, { maxAgeDays, oldKeys }, {
    title: "IAM user has old access keys",
    description: `${context.asset.name} has one or more access keys older than ${maxAgeDays} days.`,
    severity: FindingSeverity.Medium,
    riskFactors: {
      privilegeLevel: 6,
      exploitability: 6,
      credentialExposure: 8,
      complianceImpact: 6
    }
  });
}

function evaluateRootMfa(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const isRootUser = booleanValue(context.normalizedResource.metadata.isRootUser);
  const mfaEnabled = booleanValue(context.normalizedResource.metadata.mfaEnabled);

  if (!isRootUser) {
    return {
      policyKey: "aws_root_account_mfa_enabled",
      passed: true,
      evidence: {
        rootUser: false
      }
    };
  }

  return resultFromPass("aws_root_account_mfa_enabled", mfaEnabled, { rootUser: true, mfaEnabled }, {
    title: "AWS root account does not have MFA enabled",
    description: `${context.asset.name} represents the root account and MFA is not enabled.`,
    severity: FindingSeverity.Critical,
    riskFactors: {
      privilegeLevel: 10,
      exploitability: 7,
      blastRadius: 10,
      credentialExposure: 8,
      complianceImpact: 8
    }
  });
}

function evaluateCloudTrailEnabled(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const isLogging = booleanValue(context.normalizedResource.metadata.isLogging);

  return resultFromPass("aws_cloudtrail_enabled", isLogging, { isLogging }, {
    title: "CloudTrail trail is not logging",
    description: `${context.asset.name} is not actively logging CloudTrail events.`,
    severity: FindingSeverity.High,
    riskFactors: {
      exploitability: 5,
      blastRadius: 7,
      complianceImpact: 9
    }
  });
}

function evaluateRdsPublicAndEncryption(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const publiclyAccessible = booleanValue(context.normalizedResource.metadata.publiclyAccessible);
  const storageEncrypted = booleanValue(context.normalizedResource.metadata.storageEncrypted);

  return resultFromPass(
    "aws_rds_instance_not_public_encrypted",
    !publiclyAccessible && storageEncrypted,
    { publiclyAccessible, storageEncrypted },
    {
    title: "RDS instance is public or unencrypted",
    description: `${context.asset.name} is publicly accessible, lacks storage encryption, or both.`,
    severity: FindingSeverity.High,
    riskFactors: {
      internetExposure: publiclyAccessible ? 8 : 2,
      exploitability: publiclyAccessible ? 7 : 4,
      assetSensitivity: 8,
      complianceImpact: 8
    }
    }
  );
}

function evaluateLambdaSecretEnvironment(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const environment = recordValue(context.normalizedResource.metadata.environment);
  const sensitiveVariableNames = Object.keys(environment).filter((name) => secretNamePattern.test(name));

  return resultFromPass("aws_lambda_no_plaintext_secret_env", sensitiveVariableNames.length === 0, { sensitiveVariableNames }, {
    title: "Lambda function exposes likely secrets in environment variables",
    description: `${context.asset.name} has environment variables whose names indicate plaintext secrets.`,
    severity: FindingSeverity.High,
    riskFactors: {
      privilegeLevel: 5,
      exploitability: 7,
      credentialExposure: 9,
      complianceImpact: 6
    }
  });
}

function evaluateEcrCriticalCves(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const imageScanFindings = recordValue(context.normalizedResource.metadata.imageScanFindings);
  const criticalCount = numberValue(imageScanFindings.critical, 0);

  return resultFromPass("aws_ecr_no_critical_cves", criticalCount === 0, { criticalCount }, {
    title: "ECR repository contains images with critical CVEs",
    description: `${context.asset.name} has image scan findings with critical vulnerabilities.`,
    severity: FindingSeverity.Critical,
    riskFactors: {
      exploitability: 8,
      knownCves: 10,
      blastRadius: 7,
      complianceImpact: 7
    }
  });
}

function evaluateKmsPublicAccess(context: PolicyEvaluationContext): PolicyEvaluationResult {
  const publicAccess = booleanValue(context.normalizedResource.metadata.publicAccess);
  const policyAllowsPublic = booleanValue(context.normalizedResource.metadata.policyAllowsPublic);

  return resultFromPass("aws_kms_key_not_public", !publicAccess && !policyAllowsPublic, { publicAccess, policyAllowsPublic }, {
    title: "KMS key policy allows public access",
    description: `${context.asset.name} has a KMS key policy that allows public access.`,
    severity: FindingSeverity.Critical,
    riskFactors: {
      privilegeLevel: 8,
      exploitability: 8,
      assetSensitivity: 9,
      complianceImpact: 9
    }
  });
}

function resultFromPass(
  policyKey: string,
  passed: boolean,
  evidence: Record<string, unknown>,
  failure: PolicyFailureDetails
): PolicyEvaluationResult {
  return {
    policyKey,
    passed,
    evidence,
    failure: passed ? undefined : failure
  };
}

interface IngressRule {
  protocol: string;
  fromPort: number | null;
  toPort: number | null;
  cidr: string;
}

const secretNamePattern = /(secret|token|password|passwd|api[_-]?key|access[_-]?key)/i;

function normalizeIngressRule(value: unknown): IngressRule {
  const rule = recordValue(value);

  return {
    protocol: stringValue(rule.protocol).toLowerCase(),
    fromPort: nullableNumberValue(rule.fromPort),
    toPort: nullableNumberValue(rule.toPort),
    cidr: stringValue(rule.cidrIpv4 || rule.cidrIpv6 || rule.cidr)
  };
}

function portRangeIncludes(rule: IngressRule, port: number): boolean {
  if (rule.protocol && rule.protocol !== "tcp" && rule.protocol !== "-1" && rule.protocol !== "all") {
    return false;
  }

  if (rule.fromPort === null || rule.toPort === null) {
    return rule.protocol === "-1" || rule.protocol === "all";
  }

  return rule.fromPort <= port && rule.toPort >= port;
}

function cidrIsWorldOpen(cidr: string): boolean {
  return cidr === "0.0.0.0/0" || cidr === "::/0";
}

function includesWildcard(values: string[]): boolean {
  return values.includes("*");
}

function stringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(stringValue).filter(Boolean);
  }

  const stringified = stringValue(value);

  return stringified ? [stringified] : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ageInDays(isoDate: string, evaluatedAtMs: number): number {
  const createdAtMs = Date.parse(isoDate);

  if (!Number.isFinite(createdAtMs)) {
    return 0;
  }

  return Math.floor((evaluatedAtMs - createdAtMs) / 86_400_000);
}
