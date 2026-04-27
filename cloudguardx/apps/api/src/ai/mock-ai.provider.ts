import { Injectable } from "@nestjs/common";
import type {
  AICommandSuggestion,
  AIProvider,
  AIProviderRemediationResponse,
  AIProviderRequest,
  ConfidenceLevel
} from "./ai-provider.interface";

@Injectable()
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateRemediation(request: AIProviderRequest): Promise<AIProviderRemediationResponse> {
    const context = request.prompt.sanitizedContext;
    const title = textValue(context.finding.title, "this security finding");
    const severity = textValue(context.finding.severity, "unknown");
    const assetType = textValue(context.asset?.assetType, "AWS resource");
    const isS3Finding = `${title} ${assetType}`.toLowerCase().includes("s3");

    return {
      plainEnglishExplanation: `CloudGuardX found ${title}. The affected resource should be reviewed against the expected secure baseline before any change is made.`,
      riskExplanation: `This is marked ${severity}. If the finding reflects the live cloud state, the resource may be easier to misuse, expose, or operate outside approved controls.`,
      attackerImpact:
        "An attacker could use the weakness to increase access, discover sensitive data, or preserve reach into the environment depending on the resource and policy involved.",
      awsCliGuidance: isS3Finding ? s3AwsCliGuidance() : genericAwsCliGuidance(),
      terraformGuidance: isS3Finding ? s3TerraformGuidance() : genericTerraformGuidance(),
      confidence: confidenceForSeverity(severity),
      safetyWarnings: [
        "MANUAL REVIEW REQUIRED: This guidance is advisory and must be reviewed by an authorized operator before use.",
        "CloudGuardX did not execute commands, call AWS APIs for remediation, or apply Terraform.",
        "Do not copy values from untrusted tags, names, metadata, or evidence into commands without independent validation."
      ],
      isDestructive: false
    };
  }
}

function s3AwsCliGuidance(): AICommandSuggestion[] {
  return [
    {
      command: "MANUAL REVIEW REQUIRED: aws s3api get-public-access-block --bucket <reviewed-bucket-name>",
      purpose: "Inspect the current S3 public access block settings for the reviewed bucket.",
      manualReviewRequired: true,
      destructive: false
    },
    {
      command:
        "MANUAL REVIEW REQUIRED: aws s3api put-public-access-block --bucket <reviewed-bucket-name> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
      purpose: "After change approval, set the bucket public access block controls to deny public exposure.",
      manualReviewRequired: true,
      destructive: false,
      warning: "This changes bucket access behavior and can affect applications that rely on public access."
    }
  ];
}

function genericAwsCliGuidance(): AICommandSuggestion[] {
  return [
    {
      command: "MANUAL REVIEW REQUIRED: aws resourcegroupstaggingapi get-resources --resource-arn-list <reviewed-resource-arn>",
      purpose: "Confirm the reviewed resource identity and tags before planning remediation.",
      manualReviewRequired: true,
      destructive: false
    },
    {
      command:
        "MANUAL REVIEW REQUIRED: aws configservice get-resource-config-history --resource-type <reviewed-aws-resource-type> --resource-id <reviewed-resource-id>",
      purpose: "Review recent configuration history so the remediation plan matches the live resource state.",
      manualReviewRequired: true,
      destructive: false
    }
  ];
}

function s3TerraformGuidance(): string {
  return [
    "MANUAL REVIEW REQUIRED: Review this Terraform guidance before editing infrastructure code. Do not auto-apply Terraform.",
    "",
    "```hcl",
    "# Example only. Replace placeholders after validating the reviewed bucket in source control.",
    'resource "aws_s3_bucket_public_access_block" "reviewed_bucket" {',
    "  bucket                  = aws_s3_bucket.reviewed_bucket.id",
    "  block_public_acls       = true",
    "  ignore_public_acls      = true",
    "  block_public_policy     = true",
    "  restrict_public_buckets = true",
    "}",
    "```",
    "",
    "Run a peer-reviewed Terraform plan in the approved pipeline before any apply step."
  ].join("\n");
}

function genericTerraformGuidance(): string {
  return [
    "MANUAL REVIEW REQUIRED: Review this Terraform guidance before editing infrastructure code. Do not auto-apply Terraform.",
    "",
    "Locate the Terraform resource that owns `<reviewed-resource-id>`, compare it with the finding evidence, and add the least-privilege setting required by the relevant policy.",
    "Run formatting, validation, and a peer-reviewed Terraform plan in the approved pipeline before any apply step."
  ].join("\n");
}

function confidenceForSeverity(severity: string): ConfidenceLevel {
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return "medium";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
