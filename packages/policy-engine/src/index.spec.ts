import { describe, expect, it } from "vitest";
import { AwsResourceType, CloudProvider } from "@cloudguardx/shared-types";
import {
  cisAwsFrameworkDefinition,
  complianceMappingsForPolicy,
  defaultPolicyDefinitions,
  evaluateDefaultPolicies,
  remediationGuidanceForPolicy
} from "./index";
import type { NormalizedAwsResource, PolicyEvaluationContext } from "./index";

function contextFor(resourceType: AwsResourceType, metadata: Record<string, unknown>): PolicyEvaluationContext {
  const normalizedResource: NormalizedAwsResource = {
    resourceType,
    externalId: "external-1",
    region: "us-east-1",
    name: "resource-1",
    metadata
  };

  return {
    tenantId: "tenant-1",
    evaluatedAt: "2026-04-26T00:00:00.000Z",
    asset: {
      id: "asset-1",
      tenantId: "tenant-1",
      cloudAccountId: "account-1",
      provider: CloudProvider.Aws,
      resourceType,
      externalId: normalizedResource.externalId,
      region: normalizedResource.region,
      name: normalizedResource.name
    },
    normalizedResource
  };
}

describe("policy engine", () => {
  it("contains the initial Phase 4 AWS policy set", () => {
    expect(defaultPolicyDefinitions.map((policy) => policy.key)).toEqual([
      "aws_s3_bucket_public_access_prohibited",
      "aws_s3_block_public_access_enabled",
      "aws_security_group_no_world_open_admin_ports",
      "aws_iam_policy_no_wildcard_admin",
      "aws_iam_user_no_old_access_keys",
      "aws_root_account_mfa_enabled",
      "aws_cloudtrail_enabled",
      "aws_rds_instance_not_public_encrypted",
      "aws_lambda_no_plaintext_secret_env",
      "aws_ecr_no_critical_cves",
      "aws_kms_key_not_public"
    ]);
  });

  it("fails public S3 buckets and captures evidence", () => {
    const results = evaluateDefaultPolicies(
      contextFor(AwsResourceType.S3Bucket, {
        publicAccess: {
          aclAllowsPublicRead: false,
          policyAllowsPublicRead: true,
          policyAllowsPublicWrite: false
        },
        publicAccessBlock: {
          blockPublicAcls: true,
          ignorePublicAcls: true,
          blockPublicPolicy: false,
          restrictPublicBuckets: true
        }
      })
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      policyKey: "aws_s3_bucket_public_access_prohibited",
      passed: false,
      evidence: {
        policyAllowsPublicRead: true
      }
    });
    expect(results[1]).toMatchObject({
      policyKey: "aws_s3_block_public_access_enabled",
      passed: false,
      evidence: {
        missingControls: ["blockPublicPolicy"]
      }
    });
  });

  it("fails security groups exposing SSH to the internet", () => {
    const [result] = evaluateDefaultPolicies(
      contextFor(AwsResourceType.SecurityGroup, {
        ingressRules: [
          {
            protocol: "tcp",
            fromPort: 22,
            toPort: 22,
            cidrIpv4: "0.0.0.0/0"
          }
        ]
      })
    );

    expect(result).toMatchObject({
      policyKey: "aws_security_group_no_world_open_admin_ports",
      passed: false
    });
    expect(result?.failure?.riskFactors.internetExposure).toBe(10);
  });

  it("passes CloudTrail trails that are actively logging", () => {
    const [result] = evaluateDefaultPolicies(
      contextFor(AwsResourceType.CloudTrailTrail, {
        isLogging: true
      })
    );

    expect(result).toMatchObject({
      policyKey: "aws_cloudtrail_enabled",
      passed: true
    });
  });

  it("returns deterministic policy results for the same context", () => {
    const context = contextFor(AwsResourceType.SecurityGroup, {
      ingressRules: [
        {
          protocol: "tcp",
          fromPort: 3389,
          toPort: 3389,
          cidrIpv4: "0.0.0.0/0"
        }
      ]
    });

    expect(evaluateDefaultPolicies(context)).toEqual(evaluateDefaultPolicies(context));
  });

  it("maps AWS policy findings to deterministic CIS AWS-style controls", () => {
    expect(cisAwsFrameworkDefinition.controls.map((control) => control.key)).toContain("cis-aws-s3-1");
    expect(complianceMappingsForPolicy("aws_s3_bucket_public_access_prohibited")).toEqual([
      expect.objectContaining({
        controlKey: "cis-aws-s3-1",
        rationale: expect.stringContaining("Public bucket")
      })
    ]);
    expect(complianceMappingsForPolicy("unknown-policy")).toEqual([]);
  });

  it("returns non-destructive remediation guidance for mapped policies", () => {
    const guidance = remediationGuidanceForPolicy("aws_iam_policy_no_wildcard_admin");

    expect(guidance.title).toBe("Reduce wildcard IAM administration");
    expect(guidance.guidanceMarkdown).toContain("informational only");
    expect(guidance.guidanceMarkdown).not.toContain("aws iam");
    expect(guidance.guidanceMarkdown).not.toContain("terraform apply");
  });
});
