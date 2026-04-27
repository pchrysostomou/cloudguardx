import { AssetType, CloudProvider, FindingStatus, ScanEventLevel, ScanJobStatus } from "@prisma/client";
import { AwsResourceType } from "@cloudguardx/shared-types";
import { ScannerWorkerRepository } from "./scanner-worker.repository";

function phaseSixStubs() {
  let graphNodeCount = 0;

  return {
    complianceFramework: {
      upsert: jest.fn().mockResolvedValue({ id: "framework-1" })
    },
    complianceControl: {
      upsert: jest.fn((args: { create: { key: string } }) =>
        Promise.resolve({
          id: `control-${args.create.key}`,
          key: args.create.key
        })
      )
    },
    complianceMapping: {
      deleteMany: jest.fn(),
      create: jest.fn()
    },
    remediation: {
      deleteMany: jest.fn(),
      create: jest.fn()
    },
    attackGraphEdge: {
      deleteMany: jest.fn(),
      create: jest.fn()
    },
    attackGraphNode: {
      deleteMany: jest.fn(),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        graphNodeCount += 1;

        return Promise.resolve({
          id: `graph-node-${graphNodeCount}`,
          ...args.data
        });
      })
    }
  };
}

describe("ScannerWorkerRepository", () => {
  it("claims queued jobs with a guarded status update", async () => {
    const tx = {
      scanJob: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: "scan-job-1",
            tenantId: "tenant-1",
            status: ScanJobStatus.QUEUED,
            cloudAccount: { id: "account-1" }
          })
          .mockResolvedValueOnce({
            id: "scan-job-1",
            tenantId: "tenant-1",
            status: ScanJobStatus.RUNNING,
            cloudAccount: { id: "account-1" }
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      scanEvent: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    const result = await repository.claimNextJob("worker-test");

    expect(result).toEqual(
      expect.objectContaining({
        id: "scan-job-1",
        status: ScanJobStatus.RUNNING
      })
    );
    expect(tx.scanJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "scan-job-1",
          tenantId: "tenant-1",
          status: ScanJobStatus.QUEUED
        }
      })
    );
    expect(tx.scanEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          scanJobId: "scan-job-1",
          level: ScanEventLevel.INFO
        })
      })
    );
  });

  it("returns null if another worker already claimed the candidate", async () => {
    const tx = {
      scanJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: "scan-job-1",
          tenantId: "tenant-1",
          status: ScanJobStatus.QUEUED
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      scanEvent: {
        create: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await expect(repository.claimNextJob("worker-test")).resolves.toBeNull();
    expect(tx.scanEvent.create).not.toHaveBeenCalled();
  });

  it("marks only running tenant-scoped jobs as failed", async () => {
    const tx = {
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      scanEvent: {
        create: jest.fn()
      },
      cloudAccount: {
        updateMany: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await repository.failJob({
      tenantId: "tenant-1",
      scanJobId: "scan-job-1",
      cloudAccountId: "account-1",
      errorCode: "SCANNER_FAILED",
      errorMessage: "boom"
    });

    expect(tx.scanJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          id: "scan-job-1",
          cloudAccountId: "account-1",
          status: ScanJobStatus.RUNNING
        },
        data: expect.objectContaining({
          status: ScanJobStatus.FAILED,
          errorCode: "SCANNER_FAILED"
        })
      })
    );
    expect(tx.scanEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          scanJobId: "scan-job-1",
          level: ScanEventLevel.ERROR
        })
      })
    );
    expect(tx.cloudAccount.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          id: "account-1"
        }
      })
    );
  });

  it("does not overwrite completed or canceled jobs with failure state", async () => {
    const tx = {
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      scanEvent: {
        create: jest.fn()
      },
      cloudAccount: {
        updateMany: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await repository.failJob({
      tenantId: "tenant-1",
      scanJobId: "scan-job-1",
      cloudAccountId: "account-1",
      errorCode: "SCANNER_FAILED",
      errorMessage: "boom"
    });

    expect(tx.scanEvent.create).not.toHaveBeenCalled();
    expect(tx.cloudAccount.updateMany).not.toHaveBeenCalled();
  });

  it("ingests assets, evaluates policies, and stores findings during completion", async () => {
    let findingCount = 0;
    const tx = {
      ...phaseSixStubs(),
      policy: {
        upsert: jest.fn((args: { create: { key: string } }) =>
          Promise.resolve({
            id: `policy-${args.create.key}`,
            key: args.create.key,
            enabled: true,
            parameters: null
          })
        )
      },
      asset: {
        upsert: jest.fn(
          (args: {
            create: {
              tenantId: string;
              cloudAccountId: string;
              externalId: string;
              arn: string | null;
              region: string | null;
              name: string;
              normalized: unknown;
              sensitivity: number;
              criticality: number;
            };
          }) =>
          Promise.resolve({
            id: "asset-1",
            tenantId: args.create.tenantId,
            cloudAccountId: args.create.cloudAccountId,
            provider: CloudProvider.AWS,
            assetType: AssetType.AWS_S3_BUCKET,
            externalId: args.create.externalId,
            arn: args.create.arn,
            region: args.create.region,
            name: args.create.name,
            normalized: args.create.normalized,
            sensitivity: args.create.sensitivity,
            criticality: args.create.criticality
          })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([])
      },
      finding: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          findingCount += 1;

          return Promise.resolve({
            id: `finding-${findingCount}`,
            ...args.data
          });
        }),
        findMany: jest.fn().mockResolvedValue([])
      },
      riskScore: {
        upsert: jest.fn()
      },
      policyResult: {
        create: jest.fn()
      },
      scanEvent: {
        create: jest.fn()
      },
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      cloudAccount: {
        updateMany: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await repository.completeJob({
      tenantId: "tenant-1",
      scanJobId: "scan-job-1",
      cloudAccountId: "account-1",
      scannerMode: "mock",
      scannedAt: "2026-04-26T00:00:00.000Z",
      metadata: {
        readOnly: true,
        mutatingCallsAttempted: false
      },
      resources: [
        {
          resourceType: AwsResourceType.S3Bucket,
          externalId: "arn:aws:s3:::public-bucket",
          region: "us-east-1",
          name: "public-bucket",
          metadata: {
            arn: "arn:aws:s3:::public-bucket",
            sensitivity: 6,
            criticality: 5,
            publicAccess: {
              policyAllowsPublicRead: true
            },
            publicAccessBlock: {
              blockPublicAcls: true,
              ignorePublicAcls: true,
              blockPublicPolicy: false,
              restrictPublicBuckets: true
            }
          }
        }
      ]
    });

    expect(tx.asset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_cloudAccountId_externalId: {
            tenantId: "tenant-1",
            cloudAccountId: "account-1",
            externalId: "arn:aws:s3:::public-bucket"
          }
        }
      })
    );
    expect(tx.scanJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          id: "scan-job-1",
          cloudAccountId: "account-1",
          status: ScanJobStatus.RUNNING
        },
        data: expect.objectContaining({
          status: ScanJobStatus.SUCCEEDED
        })
      })
    );
    expect(tx.policy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_key: {
            tenantId: "tenant-1",
            key: "aws_s3_bucket_public_access_prohibited"
          }
        },
        update: expect.not.objectContaining({
          enabled: expect.any(Boolean),
          parameters: expect.anything()
        })
      })
    );
    expect(tx.finding.create).toHaveBeenCalledTimes(2);
    expect(tx.finding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          cloudAccountId: "account-1",
          assetId: "asset-1"
        })
      })
    );
    expect(tx.riskScore.upsert).toHaveBeenCalledTimes(2);
    expect(tx.policyResult.create).toHaveBeenCalledTimes(2);
    expect(tx.complianceMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          findingId: "finding-1",
          policyId: "policy-aws_s3_bucket_public_access_prohibited",
          controlId: "control-cis-aws-s3-1"
        })
      })
    );
    expect(tx.remediation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          findingId: "finding-1",
          isDestructive: false,
          terraformPatch: null
        })
      })
    );
    expect(tx.scanEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          scanJobId: "scan-job-1",
          level: ScanEventLevel.INFO,
          metadata: expect.objectContaining({
            resourceCount: 1,
            policyEvaluationCount: 2,
            failedPolicyResultCount: 2
          })
        })
      })
    );
  });

  it("does not ingest assets when completion is attempted for a non-running job", async () => {
    const tx = {
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      policy: {
        upsert: jest.fn()
      },
      asset: {
        upsert: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await expect(
      repository.completeJob({
        tenantId: "tenant-1",
        scanJobId: "scan-job-1",
        cloudAccountId: "account-1",
        scannerMode: "mock",
        metadata: {},
        resources: []
      })
    ).rejects.toThrow("Scan job is not running");

    expect(tx.policy.upsert).not.toHaveBeenCalled();
    expect(tx.asset.upsert).not.toHaveBeenCalled();
  });

  it("rebuilds tenant-scoped attack graph relationships from assets and active findings", async () => {
    const tx = {
      ...phaseSixStubs(),
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      policy: {
        upsert: jest.fn((args: { create: { key: string } }) =>
          Promise.resolve({
            id: `policy-${args.create.key}`,
            key: args.create.key,
            enabled: true,
            parameters: null
          })
        )
      },
      asset: {
        upsert: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "asset-s3",
            tenantId: "tenant-1",
            cloudAccountId: "account-1",
            assetType: AssetType.AWS_S3_BUCKET,
            externalId: "arn:aws:s3:::public-bucket",
            arn: "arn:aws:s3:::public-bucket",
            region: "us-east-1",
            name: "public-bucket",
            sensitivity: 7,
            criticality: 6
          },
          {
            id: "asset-policy",
            tenantId: "tenant-1",
            cloudAccountId: "account-1",
            assetType: AssetType.AWS_IAM_POLICY,
            externalId: "arn:aws:iam::123456789012:policy/admin",
            arn: "arn:aws:iam::123456789012:policy/admin",
            region: null,
            name: "admin",
            sensitivity: 0,
            criticality: 8
          },
          {
            id: "asset-user",
            tenantId: "tenant-1",
            cloudAccountId: "account-1",
            assetType: AssetType.AWS_IAM_USER,
            externalId: "arn:aws:iam::123456789012:user/deploy",
            arn: "arn:aws:iam::123456789012:user/deploy",
            region: null,
            name: "deploy",
            sensitivity: 0,
            criticality: 4
          }
        ])
      },
      finding: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "finding-public",
            tenantId: "tenant-1",
            assetId: "asset-s3",
            evidence: { policyAllowsPublicRead: true },
            policy: { key: "aws_s3_bucket_public_access_prohibited" }
          },
          {
            id: "finding-admin",
            tenantId: "tenant-1",
            assetId: "asset-policy",
            evidence: { wildcardStatementCount: 1 },
            policy: { key: "aws_iam_policy_no_wildcard_admin" }
          },
          {
            id: "finding-keys",
            tenantId: "tenant-1",
            assetId: "asset-user",
            evidence: { oldKeys: [{ keyId: "AKIA..." }] },
            policy: { key: "aws_iam_user_no_old_access_keys" }
          }
        ])
      },
      riskScore: {
        upsert: jest.fn()
      },
      policyResult: {
        create: jest.fn()
      },
      scanEvent: {
        create: jest.fn()
      },
      cloudAccount: {
        updateMany: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await repository.completeJob({
      tenantId: "tenant-1",
      scanJobId: "scan-job-graph",
      cloudAccountId: "account-1",
      scannerMode: "mock",
      scannedAt: "2026-04-26T00:00:00.000Z",
      metadata: {},
      resources: []
    });

    expect(tx.attackGraphEdge.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant-1" } });
    expect(tx.attackGraphNode.deleteMany).toHaveBeenCalledWith({ where: { tenantId: "tenant-1" } });
    expect(tx.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          deletedAt: null
        }
      })
    );
    expect(tx.finding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          status: {
            not: FindingStatus.RESOLVED
          }
        }
      })
    );
    expect(tx.attackGraphEdge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          kind: "NETWORK_EXPOSURE",
          label: "Public bucket exposure"
        })
      })
    );
    expect(tx.attackGraphEdge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "PERMISSION",
          label: "Wildcard administrative permission"
        })
      })
    );
    expect(tx.attackGraphEdge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "CREDENTIAL_EXPOSURE",
          label: "Credential exposure"
        })
      })
    );
    expect(tx.attackGraphEdge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "DATA_ACCESS"
        })
      })
    );
  });

  it("reopens an existing resolved finding on a repeated failing scan without creating a duplicate", async () => {
    const tx = {
      ...phaseSixStubs(),
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      policy: {
        upsert: jest.fn((args: { create: { key: string } }) =>
          Promise.resolve({
            id: `policy-${args.create.key}`,
            key: args.create.key,
            enabled: true,
            parameters: null
          })
        )
      },
      asset: {
        upsert: jest.fn(
          (args: {
            create: {
              tenantId: string;
              cloudAccountId: string;
              externalId: string;
              arn: string | null;
              region: string | null;
              name: string;
              normalized: unknown;
              sensitivity: number;
              criticality: number;
            };
          }) =>
            Promise.resolve({
              id: "asset-1",
              tenantId: args.create.tenantId,
              cloudAccountId: args.create.cloudAccountId,
              provider: CloudProvider.AWS,
              assetType: AssetType.AWS_CLOUDTRAIL_TRAIL,
              externalId: args.create.externalId,
              arn: args.create.arn,
              region: args.create.region,
              name: args.create.name,
              normalized: args.create.normalized,
              sensitivity: args.create.sensitivity,
              criticality: args.create.criticality
            })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([])
      },
      finding: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          id: "finding-1",
          status: "RESOLVED"
        }),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      },
      riskScore: {
        upsert: jest.fn()
      },
      policyResult: {
        create: jest.fn()
      },
      scanEvent: {
        create: jest.fn()
      },
      cloudAccount: {
        updateMany: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await repository.completeJob({
      tenantId: "tenant-1",
      scanJobId: "scan-job-2",
      cloudAccountId: "account-1",
      scannerMode: "mock",
      scannedAt: "2026-04-26T00:00:00.000Z",
      metadata: {},
      resources: [
        {
          resourceType: AwsResourceType.CloudTrailTrail,
          externalId: "arn:aws:cloudtrail:us-east-1:123456789012:trail/audit",
          region: "us-east-1",
          name: "audit",
          metadata: {
            isLogging: false
          }
        }
      ]
    });

    expect(tx.finding.create).not.toHaveBeenCalled();
    expect(tx.finding.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          id: "finding-1"
        },
        data: expect.objectContaining({
          status: "OPEN",
          resolvedAt: null
        })
      })
    );
    expect(tx.riskScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          findingId: "finding-1",
          tenantId: "tenant-1"
        }
      })
    );
  });

  it("resolves existing active findings when a policy passes", async () => {
    const tx = {
      ...phaseSixStubs(),
      scanJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      policy: {
        upsert: jest.fn((args: { create: { key: string } }) =>
          Promise.resolve({
            id: `policy-${args.create.key}`,
            key: args.create.key,
            enabled: true,
            parameters: null
          })
        )
      },
      asset: {
        upsert: jest.fn(
          (args: {
            create: {
              tenantId: string;
              cloudAccountId: string;
              externalId: string;
              arn: string | null;
              region: string | null;
              name: string;
              normalized: unknown;
              sensitivity: number;
              criticality: number;
            };
          }) =>
            Promise.resolve({
              id: "asset-1",
              tenantId: args.create.tenantId,
              cloudAccountId: args.create.cloudAccountId,
              provider: CloudProvider.AWS,
              assetType: AssetType.AWS_CLOUDTRAIL_TRAIL,
              externalId: args.create.externalId,
              arn: args.create.arn,
              region: args.create.region,
              name: args.create.name,
              normalized: args.create.normalized,
              sensitivity: args.create.sensitivity,
              criticality: args.create.criticality
            })
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([])
      },
      finding: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([])
      },
      riskScore: {
        upsert: jest.fn()
      },
      policyResult: {
        create: jest.fn()
      },
      scanEvent: {
        create: jest.fn()
      },
      cloudAccount: {
        updateMany: jest.fn()
      }
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new ScannerWorkerRepository(prisma as never);

    await repository.completeJob({
      tenantId: "tenant-1",
      scanJobId: "scan-job-3",
      cloudAccountId: "account-1",
      scannerMode: "mock",
      scannedAt: "2026-04-26T00:00:00.000Z",
      metadata: {},
      resources: [
        {
          resourceType: AwsResourceType.CloudTrailTrail,
          externalId: "arn:aws:cloudtrail:us-east-1:123456789012:trail/audit",
          region: "us-east-1",
          name: "audit",
          metadata: {
            isLogging: true
          }
        }
      ]
    });

    expect(tx.finding.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          assetId: "asset-1",
          policyId: "policy-aws_cloudtrail_enabled",
          status: {
            not: "RESOLVED"
          }
        },
        data: expect.objectContaining({
          status: "RESOLVED"
        })
      })
    );
    expect(tx.finding.create).not.toHaveBeenCalled();
    expect(tx.riskScore.upsert).not.toHaveBeenCalled();
    expect(tx.policyResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          passed: true
        })
      })
    );
  });
});
