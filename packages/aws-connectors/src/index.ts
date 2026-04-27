import { AwsResourceType } from "@cloudguardx/shared-types";
import type { CloudAccountRef } from "@cloudguardx/shared-types";

export interface AwsReadOnlyConnectorConfig {
  account: CloudAccountRef;
  roleArn: string;
  externalId: string;
  region: string;
  endpointUrl?: string;
}

export interface AwsScannerIdentity {
  accountId: string;
  arn: string;
  userId: string;
}

export interface AwsScanTarget {
  account: CloudAccountRef;
  roleArn: string;
  regions: string[];
  endpointUrl?: string;
}

export interface AwsDiscoveredResource {
  resourceType: AwsResourceType;
  externalId: string;
  region: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface AwsScanResult {
  scannerMode: "mock";
  scannedAt: string;
  resources: AwsDiscoveredResource[];
  metadata: {
    readOnly: true;
    mutatingCallsAttempted: false;
    endpointUrl?: string;
  };
}

export interface AwsReadOnlyScanner {
  scan(target: AwsScanTarget): Promise<AwsScanResult>;
}

export class MockAwsReadOnlyScanner implements AwsReadOnlyScanner {
  async scan(target: AwsScanTarget): Promise<AwsScanResult> {
    const [primaryRegion] = target.regions.length > 0 ? target.regions : ["us-east-1"];

    return {
      scannerMode: "mock",
      scannedAt: new Date().toISOString(),
      resources: [
        {
          resourceType: AwsResourceType.S3Bucket,
          externalId: `arn:aws:s3:::cloudguardx-${target.account.externalAccountId}-inventory`,
          region: primaryRegion,
          name: `cloudguardx-${target.account.externalAccountId}-inventory`,
          metadata: {
            source: "mock",
            accountId: target.account.externalAccountId,
            arn: `arn:aws:s3:::cloudguardx-${target.account.externalAccountId}-inventory`,
            tags: {
              Environment: "development",
              Owner: "cloudguardx"
            },
            sensitivity: 6,
            criticality: 5,
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
          }
        },
        {
          resourceType: AwsResourceType.SecurityGroup,
          externalId: `sg-${target.account.externalAccountId.slice(-8)}`,
          region: primaryRegion,
          name: "cloudguardx-mock-security-group",
          metadata: {
            source: "mock",
            accountId: target.account.externalAccountId,
            arn: `arn:aws:ec2:${primaryRegion}:${target.account.externalAccountId}:security-group/sg-${target.account.externalAccountId.slice(-8)}`,
            tags: {
              Environment: "development",
              Owner: "cloudguardx"
            },
            sensitivity: 4,
            criticality: 7,
            ingressRules: [
              {
                protocol: "tcp",
                fromPort: 22,
                toPort: 22,
                cidrIpv4: "0.0.0.0/0",
                description: "Mock administrative access exposure"
              }
            ]
          }
        },
        {
          resourceType: AwsResourceType.CloudTrailTrail,
          externalId: `arn:aws:cloudtrail:${primaryRegion}:${target.account.externalAccountId}:trail/cloudguardx-audit`,
          region: primaryRegion,
          name: "cloudguardx-audit",
          metadata: {
            source: "mock",
            accountId: target.account.externalAccountId,
            arn: `arn:aws:cloudtrail:${primaryRegion}:${target.account.externalAccountId}:trail/cloudguardx-audit`,
            tags: {
              Environment: "development",
              Owner: "cloudguardx"
            },
            sensitivity: 3,
            criticality: 8,
            isLogging: true,
            isMultiRegionTrail: true,
            logFileValidationEnabled: true
          }
        }
      ],
      metadata: {
        readOnly: true,
        mutatingCallsAttempted: false,
        endpointUrl: target.endpointUrl
      }
    };
  }
}
