import { PrismaClient } from "@prisma/client";
import {
  AssetType,
  CloudAccountStatus,
  CloudProvider,
  FindingSeverity,
  FindingStatus,
  MembershipStatus,
  RemediationSource,
  RoleKey,
  TenantStatus
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const demoEmail = process.env.DEMO_USER_EMAIL ?? "demo@cloudguardx.local";
const demoPassword = process.env.DEMO_USER_PASSWORD ?? "CloudGuardX-Demo-123!";
const demoTenantSlug = "demo-security-workspace";

const permissionActions = [
  "tenant:read",
  "tenant:manage",
  "user:invite",
  "cloud_account:read",
  "cloud_account:manage",
  "scan:run",
  "asset:read",
  "finding:read",
  "finding:manage",
  "compliance:read",
  "attack_path:read",
  "remediation:read",
  "remediation:manage",
  "audit_log:read",
  "notification:manage",
  "admin:manage"
];

const rolePermissions: Record<RoleKey, string[]> = {
  [RoleKey.OWNER]: permissionActions,
  [RoleKey.ADMIN]: [
    "tenant:read",
    "user:invite",
    "cloud_account:read",
    "cloud_account:manage",
    "scan:run",
    "asset:read",
    "finding:read",
    "finding:manage",
    "compliance:read",
    "attack_path:read",
    "remediation:read",
    "remediation:manage",
    "audit_log:read",
    "notification:manage",
    "admin:manage"
  ],
  [RoleKey.SECURITY_ANALYST]: [
    "tenant:read",
    "cloud_account:read",
    "scan:run",
    "asset:read",
    "finding:read",
    "finding:manage",
    "compliance:read",
    "attack_path:read",
    "remediation:read",
    "remediation:manage",
    "audit_log:read"
  ],
  [RoleKey.READ_ONLY]: [
    "tenant:read",
    "cloud_account:read",
    "asset:read",
    "finding:read",
    "compliance:read",
    "attack_path:read",
    "remediation:read"
  ]
};

async function main(): Promise<void> {
  const permissions = await Promise.all(
    permissionActions.map((action) =>
      prisma.permission.upsert({
        where: { action },
        create: {
          action,
          description: action
        },
        update: {
          description: action
        }
      })
    )
  );

  const tenant = await prisma.tenant.upsert({
    where: { slug: demoTenantSlug },
    create: {
      name: "Demo Security Workspace",
      slug: demoTenantSlug,
      status: TenantStatus.ACTIVE,
      settings: {
        demo: true,
        dataSource: "local-seed"
      }
    },
    update: {
      name: "Demo Security Workspace",
      status: TenantStatus.ACTIVE
    }
  });

  const roles = await Promise.all(
    Object.values(RoleKey).map((roleKey) => {
      const connectedPermissions = permissions.filter((permission) => rolePermissions[roleKey].includes(permission.action));

      return prisma.role.upsert({
        where: {
          tenantId_key: {
            tenantId: tenant.id,
            key: roleKey
          }
        },
        create: {
          tenantId: tenant.id,
          key: roleKey,
          name: roleName(roleKey),
          description: `${roleName(roleKey)} role`,
          permissions: {
            connect: connectedPermissions.map((permission) => ({ id: permission.id }))
          }
        },
        update: {
          name: roleName(roleKey),
          description: `${roleName(roleKey)} role`,
          permissions: {
            set: connectedPermissions.map((permission) => ({ id: permission.id }))
          }
        }
      });
    })
  );
  const ownerRole = roles.find((role) => role.key === RoleKey.OWNER);

  if (!ownerRole) {
    throw new Error("Owner role was not created");
  }

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    create: {
      email: demoEmail,
      passwordHash: await hash(demoPassword, 10),
      displayName: "CloudGuardX Demo Admin"
    },
    update: {
      passwordHash: await hash(demoPassword, 10),
      displayName: "CloudGuardX Demo Admin"
    }
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      roleId: ownerRole.id,
      roleKey: RoleKey.OWNER,
      status: MembershipStatus.ACTIVE
    },
    update: {
      roleId: ownerRole.id,
      roleKey: RoleKey.OWNER,
      status: MembershipStatus.ACTIVE
    }
  });

  const cloudAccount = await prisma.cloudAccount.upsert({
    where: {
      tenantId_provider_externalAccountId: {
        tenantId: tenant.id,
        provider: CloudProvider.AWS,
        externalAccountId: "123456789012"
      }
    },
    create: {
      tenantId: tenant.id,
      provider: CloudProvider.AWS,
      name: "Demo AWS Account",
      externalAccountId: "123456789012",
      roleArn: "arn:aws:iam::123456789012:role/CloudGuardXReadOnly",
      externalIdCiphertext: "local-demo-external-id-ciphertext",
      status: CloudAccountStatus.ACTIVE,
      lastSuccessfulScanAt: new Date(),
      metadata: {
        onboardingMode: "demo_seed",
        regions: ["us-east-1"],
        note: "Local mock data; no production AWS API is used."
      }
    },
    update: {
      name: "Demo AWS Account",
      status: CloudAccountStatus.ACTIVE,
      lastSuccessfulScanAt: new Date(),
      metadata: {
        onboardingMode: "demo_seed",
        regions: ["us-east-1"],
        note: "Local mock data; no production AWS API is used."
      }
    }
  });

  const asset = await prisma.asset.upsert({
    where: {
      tenantId_cloudAccountId_externalId: {
        tenantId: tenant.id,
        cloudAccountId: cloudAccount.id,
        externalId: "arn:aws:s3:::demo-public-bucket"
      }
    },
    create: {
      tenantId: tenant.id,
      cloudAccountId: cloudAccount.id,
      provider: CloudProvider.AWS,
      assetType: AssetType.AWS_S3_BUCKET,
      externalId: "arn:aws:s3:::demo-public-bucket",
      arn: "arn:aws:s3:::demo-public-bucket",
      region: "us-east-1",
      name: "demo-public-bucket",
      tags: {
        Environment: "demo",
        Owner: "security"
      },
      normalized: {
        publicAccessBlock: {
          blockPublicAcls: false,
          ignorePublicAcls: false,
          blockPublicPolicy: false,
          restrictPublicBuckets: false
        }
      },
      sensitivity: 7,
      criticality: 6
    },
    update: {
      tags: {
        Environment: "demo",
        Owner: "security"
      },
      normalized: {
        publicAccessBlock: {
          blockPublicAcls: false,
          ignorePublicAcls: false,
          blockPublicPolicy: false,
          restrictPublicBuckets: false
        }
      },
      sensitivity: 7,
      criticality: 6,
      lastSeenAt: new Date(),
      deletedAt: null
    }
  });

  const policy = await prisma.policy.upsert({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: "aws.s3.block-public-access"
      }
    },
    create: {
      tenantId: tenant.id,
      key: "aws.s3.block-public-access",
      name: "S3 bucket public access should be blocked",
      description: "S3 buckets should enable public access block settings unless explicitly approved.",
      severity: FindingSeverity.HIGH,
      implementation: "mock-policy-engine",
      parameters: {
        requireAllPublicAccessBlockSettings: true
      }
    },
    update: {
      name: "S3 bucket public access should be blocked",
      description: "S3 buckets should enable public access block settings unless explicitly approved.",
      severity: FindingSeverity.HIGH,
      enabled: true,
      parameters: {
        requireAllPublicAccessBlockSettings: true
      }
    }
  });

  const finding = await prisma.finding.upsert({
    where: {
      tenantId_dedupeKey: {
        tenantId: tenant.id,
        dedupeKey: "demo:s3-public-access:demo-public-bucket"
      }
    },
    create: {
      tenantId: tenant.id,
      cloudAccountId: cloudAccount.id,
      assetId: asset.id,
      policyId: policy.id,
      dedupeKey: "demo:s3-public-access:demo-public-bucket",
      title: "S3 bucket allows public access",
      description: "The demo S3 bucket is missing public access block controls.",
      severity: FindingSeverity.HIGH,
      status: FindingStatus.OPEN,
      score: 78,
      evidence: {
        source: "local-demo-seed",
        publicAccessBlockMissing: true,
        note: "Safe demo finding. No production AWS API was called."
      }
    },
    update: {
      title: "S3 bucket allows public access",
      description: "The demo S3 bucket is missing public access block controls.",
      severity: FindingSeverity.HIGH,
      status: FindingStatus.OPEN,
      score: 78,
      lastSeenAt: new Date(),
      evidence: {
        source: "local-demo-seed",
        publicAccessBlockMissing: true,
        note: "Safe demo finding. No production AWS API was called."
      }
    }
  });

  await prisma.riskScore.upsert({
    where: {
      tenantId_findingId: {
        tenantId: tenant.id,
        findingId: finding.id
      }
    },
    create: {
      tenantId: tenant.id,
      findingId: finding.id,
      score: 78,
      severity: FindingSeverity.HIGH,
      factors: {
        internetExposure: 9,
        exploitability: 6,
        assetCriticality: 6
      }
    },
    update: {
      score: 78,
      severity: FindingSeverity.HIGH,
      factors: {
        internetExposure: 9,
        exploitability: 6,
        assetCriticality: 6
      },
      calculatedAt: new Date()
    }
  });

  const existingRemediation = await prisma.remediation.findFirst({
    where: {
      tenantId: tenant.id,
      findingId: finding.id,
      source: RemediationSource.HUMAN
    }
  });

  if (!existingRemediation) {
    await prisma.remediation.create({
      data: {
        tenantId: tenant.id,
        findingId: finding.id,
        source: RemediationSource.HUMAN,
        guidanceMarkdown:
          "MANUAL REVIEW REQUIRED: Review the bucket owner, intended exposure, and application dependencies. Add public access block controls through approved infrastructure-as-code workflow.",
        terraformPatch:
          'MANUAL REVIEW REQUIRED:\nresource "aws_s3_bucket_public_access_block" "demo_public_bucket" {\n  bucket                  = aws_s3_bucket.demo_public_bucket.id\n  block_public_acls       = true\n  ignore_public_acls      = true\n  block_public_policy     = true\n  restrict_public_buckets = true\n}',
        awsCliCommands: {
          commands: [
            {
              command: "MANUAL REVIEW REQUIRED: aws s3api get-public-access-block --bucket demo-public-bucket",
              purpose: "Inspect current public access block settings.",
              manualReviewRequired: true,
              destructive: false
            }
          ]
        },
        isDestructive: false,
        createdByUserId: user.id
      }
    });
  }

  console.log("Seeded CloudGuardX demo data.");
  console.log(`Demo login: ${demoEmail}`);
  console.log(`Demo password: ${demoPassword}`);
  console.log(`Demo tenant ID: ${tenant.id}`);
}

function roleName(roleKey: RoleKey): string {
  switch (roleKey) {
    case RoleKey.OWNER:
      return "owner";
    case RoleKey.ADMIN:
      return "admin";
    case RoleKey.SECURITY_ANALYST:
      return "security_analyst";
    case RoleKey.READ_ONLY:
      return "read_only";
    default:
      throw new Error(`Unsupported role: ${roleKey satisfies never}`);
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
