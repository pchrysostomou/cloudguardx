import { Injectable } from "@nestjs/common";
import {
  AttackGraphEdgeKind,
  AttackGraphNodeKind,
  AssetType,
  CloudAccountStatus,
  CloudProvider as PrismaCloudProvider,
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus,
  RemediationSource,
  ScanEventLevel,
  ScanJobStatus
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { AwsDiscoveredResource } from "@cloudguardx/aws-connectors";
import {
  AwsResourceType,
  CloudProvider as SharedCloudProvider,
  FindingSeverity as SharedFindingSeverity
} from "@cloudguardx/shared-types";
import type { CloudAssetRef } from "@cloudguardx/shared-types";
import {
  cisAwsFrameworkDefinition,
  complianceMappingsForPolicy,
  defaultPolicyDefinitions,
  evaluatePolicyDefinition,
  remediationGuidanceForPolicy
} from "@cloudguardx/policy-engine";
import type { NormalizedAwsResource, PolicyDefinition, PolicyEvaluationResult } from "@cloudguardx/policy-engine";
import { calculateRiskScore, normalizeRiskScoreFactors } from "@cloudguardx/risk-engine";
import { PrismaService } from "../database/prisma.service";

export type ClaimedScanJob = NonNullable<Awaited<ReturnType<ScannerWorkerRepository["claimNextJob"]>>>;

interface CompleteJobInput {
  tenantId: string;
  scanJobId: string;
  cloudAccountId: string;
  resources: AwsDiscoveredResource[];
  scannerMode: string;
  metadata: Prisma.InputJsonObject;
  scannedAt?: string;
}

interface UpsertedAsset {
  id: string;
  tenantId: string;
  cloudAccountId: string;
  provider: PrismaCloudProvider;
  assetType: AssetType;
  externalId: string;
  arn: string | null;
  region: string | null;
  name: string;
  normalized: Prisma.JsonValue;
  sensitivity: number;
  criticality: number;
}

interface PersistEvaluationInput {
  tx: Prisma.TransactionClient;
  tenantId: string;
  cloudAccountId: string;
  scanJobId: string;
  complianceControlsByKey: Map<string, { id: string; key: string }>;
  asset: UpsertedAsset;
  policy: {
    id: string;
    key: string;
    parameters: Prisma.JsonValue | null;
  };
  result: PolicyEvaluationResult;
  evaluatedAt: Date;
}

@Injectable()
export class ScannerWorkerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimNextJob(workerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.scanJob.findFirst({
        where: { status: ScanJobStatus.QUEUED },
        orderBy: { createdAt: "asc" },
        include: {
          cloudAccount: true
        }
      });

      if (!candidate) {
        return null;
      }

      const claimed = await tx.scanJob.updateMany({
        where: {
          id: candidate.id,
          tenantId: candidate.tenantId,
          status: ScanJobStatus.QUEUED
        },
        data: {
          status: ScanJobStatus.RUNNING,
          startedAt: new Date(),
          errorCode: null,
          errorMessage: null
        }
      });

      if (claimed.count !== 1) {
        return null;
      }

      await tx.scanEvent.create({
        data: {
          tenantId: candidate.tenantId,
          scanJobId: candidate.id,
          level: ScanEventLevel.INFO,
          message: "Scan job claimed by worker",
          metadata: {
            workerId
          }
        }
      });

      return tx.scanJob.findFirst({
        where: {
          id: candidate.id,
          tenantId: candidate.tenantId
        },
        include: {
          cloudAccount: true
        }
      });
    });
  }

  async completeJob(input: CompleteJobInput): Promise<void> {
    const evaluatedAt = input.scannedAt ? new Date(input.scannedAt) : new Date();

    await this.prisma.$transaction(async (tx) => {
      const completed = await tx.scanJob.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.scanJobId,
          cloudAccountId: input.cloudAccountId,
          status: ScanJobStatus.RUNNING
        },
        data: {
          status: ScanJobStatus.SUCCEEDED,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null
        }
      });

      if (completed.count !== 1) {
        throw new Error("Scan job is not running or is outside the tenant/account scope");
      }

      const policies = await this.ensureDefaultPolicies(tx, input.tenantId, defaultPolicyDefinitions);
      const complianceControlsByKey = await this.ensureDefaultComplianceControls(tx);
      const policiesByKey = new Map(policies.map((policy) => [policy.key, policy]));
      const upsertedAssets = [];
      let policyEvaluationCount = 0;
      let failedPolicyResultCount = 0;

      for (const resource of input.resources) {
        const asset = await this.upsertAssetFromResource(tx, {
          tenantId: input.tenantId,
          cloudAccountId: input.cloudAccountId,
          resource,
          evaluatedAt
        });

        upsertedAssets.push(asset);
      }

      await this.markMissingAssetsDeleted(tx, {
        tenantId: input.tenantId,
        cloudAccountId: input.cloudAccountId,
        scannedExternalIds: input.resources.map((resource) => resource.externalId),
        evaluatedAt
      });

      for (const asset of upsertedAssets) {
        for (const definition of defaultPolicyDefinitions) {
          const policy = policiesByKey.get(definition.key);

          if (!policy?.enabled) {
            continue;
          }

          const result = evaluatePolicyDefinition(definition, {
            tenantId: input.tenantId,
            asset: toCloudAssetRef(asset),
            normalizedResource: toNormalizedAwsResource(asset),
            evaluatedAt: evaluatedAt.toISOString(),
            parameters: jsonRecordOrNull(policy.parameters)
          });

          if (result.evidence.skipped === true) {
            continue;
          }

          policyEvaluationCount += 1;
          await this.persistPolicyEvaluation({
            tx,
            tenantId: input.tenantId,
            cloudAccountId: input.cloudAccountId,
            scanJobId: input.scanJobId,
            complianceControlsByKey,
            asset,
            policy,
            result,
            evaluatedAt
          });

          if (!result.passed) {
            failedPolicyResultCount += 1;
          }
        }
      }

      const attackGraphStats = await this.rebuildAttackGraph(tx, input.tenantId);

      await tx.scanEvent.create({
        data: {
          tenantId: input.tenantId,
          scanJobId: input.scanJobId,
          level: ScanEventLevel.INFO,
          message: "Scan job completed",
          metadata: {
            resourceCount: input.resources.length,
            scannerMode: input.scannerMode,
            policyEvaluationCount,
            failedPolicyResultCount,
            attackGraphNodeCount: attackGraphStats.nodeCount,
            attackGraphEdgeCount: attackGraphStats.edgeCount,
            ...input.metadata
          }
        }
      });
      await tx.cloudAccount.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.cloudAccountId
        },
        data: {
          status: CloudAccountStatus.ACTIVE,
          lastSuccessfulScanAt: new Date(),
          lastScanError: null
        }
      });
    });
  }

  async failJob(input: {
    tenantId: string;
    scanJobId: string;
    cloudAccountId: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const failed = await tx.scanJob.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.scanJobId,
          cloudAccountId: input.cloudAccountId,
          status: ScanJobStatus.RUNNING
        },
        data: {
          status: ScanJobStatus.FAILED,
          completedAt: new Date(),
          errorCode: input.errorCode,
          errorMessage: input.errorMessage
        }
      });

      if (failed.count !== 1) {
        return;
      }

      await tx.scanEvent.create({
        data: {
          tenantId: input.tenantId,
          scanJobId: input.scanJobId,
          level: ScanEventLevel.ERROR,
          message: "Scan job failed",
          metadata: {
            errorCode: input.errorCode,
            errorMessage: input.errorMessage
          }
        }
      });
      await tx.cloudAccount.updateMany({
        where: {
          tenantId: input.tenantId,
          id: input.cloudAccountId
        },
        data: {
          status: CloudAccountStatus.ERROR,
          lastScanError: input.errorMessage
        }
      });
    });
  }

  private async ensureDefaultPolicies(
    tx: Prisma.TransactionClient,
    tenantId: string,
    definitions: readonly PolicyDefinition[]
  ) {
    return Promise.all(
      definitions.map((definition) =>
        tx.policy.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: definition.key
            }
          },
          create: {
            tenantId,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            severity: mapSharedSeverityToPrisma(definition.severity),
            enabled: true,
            implementation: definition.implementation,
            parameters: Prisma.JsonNull
          },
          update: {
            name: definition.name,
            description: definition.description,
            severity: mapSharedSeverityToPrisma(definition.severity),
            implementation: definition.implementation
          }
        })
      )
    );
  }

  private async ensureDefaultComplianceControls(tx: Prisma.TransactionClient) {
    const framework = await tx.complianceFramework.upsert({
      where: {
        key_version: {
          key: cisAwsFrameworkDefinition.key,
          version: cisAwsFrameworkDefinition.version
        }
      },
      create: {
        key: cisAwsFrameworkDefinition.key,
        name: cisAwsFrameworkDefinition.name,
        version: cisAwsFrameworkDefinition.version,
        description: cisAwsFrameworkDefinition.description
      },
      update: {
        name: cisAwsFrameworkDefinition.name,
        description: cisAwsFrameworkDefinition.description
      }
    });

    const controls = await Promise.all(
      cisAwsFrameworkDefinition.controls.map((control) =>
        tx.complianceControl.upsert({
          where: {
            frameworkId_key: {
              frameworkId: framework.id,
              key: control.key
            }
          },
          create: {
            frameworkId: framework.id,
            key: control.key,
            title: control.title,
            description: control.description
          },
          update: {
            title: control.title,
            description: control.description
          }
        })
      )
    );

    return new Map(controls.map((control) => [control.key, { id: control.id, key: control.key }]));
  }

  private async upsertAssetFromResource(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      cloudAccountId: string;
      resource: AwsDiscoveredResource;
      evaluatedAt: Date;
    }
  ): Promise<UpsertedAsset> {
    const metadata = recordValue(input.resource.metadata);
    const normalized = normalizedResourceFrom(input.resource);
    const tags = recordValueOrNull(metadata.tags);

    return tx.asset.upsert({
      where: {
        tenantId_cloudAccountId_externalId: {
          tenantId: input.tenantId,
          cloudAccountId: input.cloudAccountId,
          externalId: input.resource.externalId
        }
      },
      create: {
        tenantId: input.tenantId,
        cloudAccountId: input.cloudAccountId,
        provider: PrismaCloudProvider.AWS,
        assetType: mapAwsResourceTypeToPrisma(input.resource.resourceType),
        externalId: input.resource.externalId,
        arn: stringValue(metadata.arn) || arnFromExternalId(input.resource.externalId),
        region: input.resource.region || null,
        name: input.resource.name,
        tags: tags ? toJsonObject(tags) : Prisma.JsonNull,
        normalized: toJsonObject(normalized),
        sensitivity: boundedInteger(metadata.sensitivity, 0),
        criticality: boundedInteger(metadata.criticality, 0),
        firstSeenAt: input.evaluatedAt,
        lastSeenAt: input.evaluatedAt,
        deletedAt: null
      },
      update: {
        provider: PrismaCloudProvider.AWS,
        assetType: mapAwsResourceTypeToPrisma(input.resource.resourceType),
        arn: stringValue(metadata.arn) || arnFromExternalId(input.resource.externalId),
        region: input.resource.region || null,
        name: input.resource.name,
        tags: tags ? toJsonObject(tags) : Prisma.JsonNull,
        normalized: toJsonObject(normalized),
        sensitivity: boundedInteger(metadata.sensitivity, 0),
        criticality: boundedInteger(metadata.criticality, 0),
        lastSeenAt: input.evaluatedAt,
        deletedAt: null
      }
    });
  }

  private async markMissingAssetsDeleted(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      cloudAccountId: string;
      scannedExternalIds: string[];
      evaluatedAt: Date;
    }
  ): Promise<void> {
    await tx.asset.updateMany({
      where: {
        tenantId: input.tenantId,
        cloudAccountId: input.cloudAccountId,
        deletedAt: null,
        ...(input.scannedExternalIds.length > 0
          ? {
              externalId: {
                notIn: input.scannedExternalIds
              }
            }
          : {})
      },
      data: {
        deletedAt: input.evaluatedAt
      }
    });
  }

  private async persistPolicyEvaluation(input: PersistEvaluationInput): Promise<void> {
    if (input.result.passed) {
      await input.tx.finding.updateMany({
        where: {
          tenantId: input.tenantId,
          assetId: input.asset.id,
          policyId: input.policy.id,
          status: {
            not: FindingStatus.RESOLVED
          }
        },
        data: {
          status: FindingStatus.RESOLVED,
          resolvedAt: input.evaluatedAt,
          lastSeenAt: input.evaluatedAt
        }
      });
      await input.tx.policyResult.create({
        data: {
          tenantId: input.tenantId,
          policyId: input.policy.id,
          scanJobId: input.scanJobId,
          assetId: input.asset.id,
          passed: true,
          evidence: toJsonObject(input.result.evidence),
          evaluatedAt: input.evaluatedAt
        }
      });
      return;
    }

    if (!input.result.failure) {
      throw new Error(`Policy ${input.result.policyKey} failed without failure details`);
    }

    const dedupeKey = `${input.policy.key}:${input.cloudAccountId}:${input.asset.externalId}`;
    const riskFactors = normalizeRiskScoreFactors({
      ...input.result.failure.riskFactors,
      assetSensitivity: Math.max(input.result.failure.riskFactors.assetSensitivity ?? 0, input.asset.sensitivity),
      tenantCriticality: Math.max(input.result.failure.riskFactors.tenantCriticality ?? 0, input.asset.criticality)
    });
    const risk = calculateRiskScore({
      tenantId: input.tenantId,
      findingId: "pending",
      factors: riskFactors
    });
    const existingFinding = await input.tx.finding.findUnique({
      where: {
        tenantId_dedupeKey: {
          tenantId: input.tenantId,
          dedupeKey
        }
      }
    });
    const findingStatus =
      existingFinding?.status === FindingStatus.RESOLVED || !existingFinding ? FindingStatus.OPEN : existingFinding.status;
    const finding = existingFinding
      ? await this.updateExistingFinding(input, existingFinding.id, {
          cloudAccountId: input.cloudAccountId,
          assetId: input.asset.id,
          policyId: input.policy.id,
          scanJobId: input.scanJobId,
          title: input.result.failure.title,
          description: input.result.failure.description,
          severity: mapSharedSeverityToPrisma(risk.severity),
          status: findingStatus,
          score: risk.score,
          evidence: toJsonObject(input.result.evidence),
          lastSeenAt: input.evaluatedAt,
          resolvedAt: null
        })
      : await input.tx.finding.create({
          data: {
            tenantId: input.tenantId,
            cloudAccountId: input.cloudAccountId,
            assetId: input.asset.id,
            policyId: input.policy.id,
            scanJobId: input.scanJobId,
            dedupeKey,
            title: input.result.failure.title,
            description: input.result.failure.description,
            severity: mapSharedSeverityToPrisma(risk.severity),
            status: FindingStatus.OPEN,
            score: risk.score,
            evidence: toJsonObject(input.result.evidence),
            firstSeenAt: input.evaluatedAt,
            lastSeenAt: input.evaluatedAt
          }
        });

    await input.tx.riskScore.upsert({
      where: {
        findingId: finding.id,
        tenantId: input.tenantId
      },
      create: {
        tenantId: input.tenantId,
        findingId: finding.id,
        score: risk.score,
        severity: mapSharedSeverityToPrisma(risk.severity),
        factors: toJsonObject(risk.factors),
        calculatedAt: input.evaluatedAt
      },
      update: {
        score: risk.score,
        severity: mapSharedSeverityToPrisma(risk.severity),
        factors: toJsonObject(risk.factors),
        calculatedAt: input.evaluatedAt
      }
    });
    await input.tx.policyResult.create({
      data: {
        tenantId: input.tenantId,
        policyId: input.policy.id,
        scanJobId: input.scanJobId,
        assetId: input.asset.id,
        findingId: finding.id,
        passed: false,
        evidence: toJsonObject(input.result.evidence),
        evaluatedAt: input.evaluatedAt
      }
    });
    await this.persistComplianceMappingsForFinding({
      tx: input.tx,
      tenantId: input.tenantId,
      findingId: finding.id,
      policyId: input.policy.id,
      policyKey: input.policy.key,
      complianceControlsByKey: input.complianceControlsByKey
    });
    await this.persistRemediationForFinding({
      tx: input.tx,
      tenantId: input.tenantId,
      findingId: finding.id,
      policyKey: input.policy.key
    });
  }

  private async updateExistingFinding(
    input: PersistEvaluationInput,
    findingId: string,
    data: Prisma.FindingUncheckedUpdateManyInput
  ): Promise<{ id: string }> {
    const updated = await input.tx.finding.updateMany({
      where: {
        tenantId: input.tenantId,
        id: findingId
      },
      data
    });

    if (updated.count !== 1) {
      throw new Error("Finding update failed tenant guard");
    }

    return { id: findingId };
  }

  private async persistComplianceMappingsForFinding(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    findingId: string;
    policyId: string;
    policyKey: string;
    complianceControlsByKey: Map<string, { id: string; key: string }>;
  }): Promise<void> {
    await input.tx.complianceMapping.deleteMany({
      where: {
        tenantId: input.tenantId,
        findingId: input.findingId
      }
    });

    for (const mapping of complianceMappingsForPolicy(input.policyKey)) {
      const control = input.complianceControlsByKey.get(mapping.controlKey);

      if (!control) {
        continue;
      }

      await input.tx.complianceMapping.create({
        data: {
          tenantId: input.tenantId,
          controlId: control.id,
          policyId: input.policyId,
          findingId: input.findingId,
          rationale: mapping.rationale
        }
      });
    }
  }

  private async persistRemediationForFinding(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    findingId: string;
    policyKey: string;
  }): Promise<void> {
    const guidance = remediationGuidanceForPolicy(input.policyKey);

    await input.tx.remediation.deleteMany({
      where: {
        tenantId: input.tenantId,
        findingId: input.findingId
      }
    });

    await input.tx.remediation.create({
      data: {
        tenantId: input.tenantId,
        findingId: input.findingId,
        source: RemediationSource.HUMAN,
        guidanceMarkdown: `## ${guidance.title}\n\n${guidance.guidanceMarkdown}`,
        terraformPatch: null,
        awsCliCommands: Prisma.JsonNull,
        isDestructive: false
      }
    });
  }

  private async rebuildAttackGraph(
    tx: Prisma.TransactionClient,
    tenantId: string
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    await tx.attackGraphEdge.deleteMany({ where: { tenantId } });
    await tx.attackGraphNode.deleteMany({ where: { tenantId } });

    const assets = await tx.asset.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      select: {
        id: true,
        tenantId: true,
        cloudAccountId: true,
        assetType: true,
        externalId: true,
        arn: true,
        region: true,
        name: true,
        sensitivity: true,
        criticality: true
      }
    });
    const activeFindings = await tx.finding.findMany({
      where: {
        tenantId,
        status: {
          not: FindingStatus.RESOLVED
        }
      },
      include: {
        policy: true
      }
    });
    const nodesByAssetId = new Map<string, { id: string; assetType: AssetType }>();
    const nodesBySyntheticKey = new Map<string, { id: string }>();
    const dataAssetNodeIds: string[] = [];
    let nodeCount = 0;
    let edgeCount = 0;
    const edgeKeys = new Set<string>();

    for (const asset of assets) {
      const node = await tx.attackGraphNode.create({
        data: {
          tenantId,
          assetId: asset.id,
          kind: identityAssetTypes.has(asset.assetType) ? AttackGraphNodeKind.IDENTITY : AttackGraphNodeKind.RESOURCE,
          externalId: `asset:${asset.id}`,
          label: asset.name,
          properties: toJsonObject({
            assetType: prismaAssetTypeToAwsResourceType[asset.assetType],
            cloudAccountId: asset.cloudAccountId,
            externalId: asset.externalId,
            arn: asset.arn,
            region: asset.region,
            sensitivity: asset.sensitivity,
            criticality: asset.criticality
          })
        }
      });

      nodeCount += 1;
      nodesByAssetId.set(asset.id, { id: node.id, assetType: asset.assetType });

      if (dataAssetTypes.has(asset.assetType)) {
        dataAssetNodeIds.push(node.id);
      }
    }

    const ensureSyntheticNode = async (input: {
      key: string;
      kind: AttackGraphNodeKind;
      label: string;
      properties: Record<string, unknown>;
    }) => {
      const existing = nodesBySyntheticKey.get(input.key);

      if (existing) {
        return existing;
      }

      const node = await tx.attackGraphNode.create({
        data: {
          tenantId,
          assetId: null,
          kind: input.kind,
          externalId: `synthetic:${input.key}`,
          label: input.label,
          properties: toJsonObject({
            synthetic: true,
            ...input.properties
          })
        }
      });
      const ref = { id: node.id };

      nodeCount += 1;
      nodesBySyntheticKey.set(input.key, ref);

      return ref;
    };

    const createEdge = async (input: {
      sourceNodeId: string;
      targetNodeId: string;
      kind: AttackGraphEdgeKind;
      label: string;
      findingId: string;
      policyKey: string;
      evidence: unknown;
    }) => {
      const edgeKey = `${input.sourceNodeId}:${input.targetNodeId}:${input.kind}:${input.findingId}:${input.label}`;

      if (edgeKeys.has(edgeKey)) {
        return;
      }

      edgeKeys.add(edgeKey);
      await tx.attackGraphEdge.create({
        data: {
          tenantId,
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          kind: input.kind,
          label: input.label,
          properties: toJsonObject({
            findingId: input.findingId,
            policyKey: input.policyKey,
            evidence: recordValue(input.evidence)
          })
        }
      });
      edgeCount += 1;
    };

    for (const finding of activeFindings) {
      if (!finding.assetId) {
        continue;
      }

      const assetNode = nodesByAssetId.get(finding.assetId);
      const policyKey = finding.policy?.key;

      if (!assetNode || !policyKey) {
        continue;
      }

      const internetNode = async () =>
        ensureSyntheticNode({
          key: "public-internet",
          kind: AttackGraphNodeKind.RESOURCE,
          label: "Public internet",
          properties: { category: "public_exposure" }
        });
      const credentialNode = async () =>
        ensureSyntheticNode({
          key: "credential-material",
          kind: AttackGraphNodeKind.IDENTITY,
          label: "Exposed credential material",
          properties: { category: "credential_exposure" }
        });
      const adminNode = async () =>
        ensureSyntheticNode({
          key: "aws-account-administration",
          kind: AttackGraphNodeKind.RESOURCE,
          label: "AWS account administration",
          properties: { category: "administrative_control_plane" }
        });

      if (policyKey === "aws_s3_bucket_public_access_prohibited") {
        const source = await internetNode();

        await createEdge({
          sourceNodeId: source.id,
          targetNodeId: assetNode.id,
          kind: AttackGraphEdgeKind.NETWORK_EXPOSURE,
          label: "Public bucket exposure",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });
        await createEdge({
          sourceNodeId: source.id,
          targetNodeId: assetNode.id,
          kind: AttackGraphEdgeKind.DATA_ACCESS,
          label: "Public data access",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });
      }

      if (policyKey === "aws_s3_block_public_access_enabled") {
        const source = await internetNode();

        await createEdge({
          sourceNodeId: source.id,
          targetNodeId: assetNode.id,
          kind: AttackGraphEdgeKind.NETWORK_EXPOSURE,
          label: "Weak public-access guardrail",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });
      }

      if (policyKey === "aws_security_group_no_world_open_admin_ports") {
        const source = await internetNode();

        await createEdge({
          sourceNodeId: source.id,
          targetNodeId: assetNode.id,
          kind: AttackGraphEdgeKind.NETWORK_EXPOSURE,
          label: "World-open administrative ingress",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });
      }

      if (policyKey === "aws_iam_policy_no_wildcard_admin") {
        const target = await adminNode();

        await createEdge({
          sourceNodeId: assetNode.id,
          targetNodeId: target.id,
          kind: AttackGraphEdgeKind.PERMISSION,
          label: "Wildcard administrative permission",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });

        for (const dataNodeId of dataAssetNodeIds) {
          await createEdge({
            sourceNodeId: assetNode.id,
            targetNodeId: dataNodeId,
            kind: AttackGraphEdgeKind.DATA_ACCESS,
            label: "Wildcard data access path",
            findingId: finding.id,
            policyKey,
            evidence: finding.evidence
          });
        }
      }

      if (
        policyKey === "aws_iam_user_no_old_access_keys" ||
        policyKey === "aws_root_account_mfa_enabled" ||
        policyKey === "aws_lambda_no_plaintext_secret_env"
      ) {
        const target = await credentialNode();

        await createEdge({
          sourceNodeId: assetNode.id,
          targetNodeId: target.id,
          kind: AttackGraphEdgeKind.CREDENTIAL_EXPOSURE,
          label: "Credential exposure",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });
      }

      if (policyKey === "aws_rds_instance_not_public_encrypted") {
        const evidence = recordValue(finding.evidence);

        if (evidence.publiclyAccessible === true) {
          const source = await internetNode();

          await createEdge({
            sourceNodeId: source.id,
            targetNodeId: assetNode.id,
            kind: AttackGraphEdgeKind.NETWORK_EXPOSURE,
            label: "Public database exposure",
            findingId: finding.id,
            policyKey,
            evidence: finding.evidence
          });
          await createEdge({
            sourceNodeId: source.id,
            targetNodeId: assetNode.id,
            kind: AttackGraphEdgeKind.DATA_ACCESS,
            label: "Public database access path",
            findingId: finding.id,
            policyKey,
            evidence: finding.evidence
          });
        }
      }

      if (policyKey === "aws_kms_key_not_public") {
        const source = await internetNode();

        await createEdge({
          sourceNodeId: source.id,
          targetNodeId: assetNode.id,
          kind: AttackGraphEdgeKind.DATA_ACCESS,
          label: "Public key access",
          findingId: finding.id,
          policyKey,
          evidence: finding.evidence
        });
      }
    }

    return { nodeCount, edgeCount };
  }
}

const awsResourceTypeToPrismaAssetType: Record<AwsResourceType, AssetType> = {
  [AwsResourceType.S3Bucket]: AssetType.AWS_S3_BUCKET,
  [AwsResourceType.Ec2Instance]: AssetType.AWS_EC2_INSTANCE,
  [AwsResourceType.IamUser]: AssetType.AWS_IAM_USER,
  [AwsResourceType.IamRole]: AssetType.AWS_IAM_ROLE,
  [AwsResourceType.IamPolicy]: AssetType.AWS_IAM_POLICY,
  [AwsResourceType.SecurityGroup]: AssetType.AWS_SECURITY_GROUP,
  [AwsResourceType.RdsInstance]: AssetType.AWS_RDS_INSTANCE,
  [AwsResourceType.LambdaFunction]: AssetType.AWS_LAMBDA_FUNCTION,
  [AwsResourceType.CloudTrailTrail]: AssetType.AWS_CLOUDTRAIL_TRAIL,
  [AwsResourceType.EcrRepository]: AssetType.AWS_ECR_REPOSITORY,
  [AwsResourceType.SecretsManagerSecret]: AssetType.AWS_SECRETS_MANAGER_SECRET,
  [AwsResourceType.KmsKey]: AssetType.AWS_KMS_KEY
};

const prismaAssetTypeToAwsResourceType: Record<AssetType, AwsResourceType> = {
  [AssetType.AWS_S3_BUCKET]: AwsResourceType.S3Bucket,
  [AssetType.AWS_EC2_INSTANCE]: AwsResourceType.Ec2Instance,
  [AssetType.AWS_IAM_USER]: AwsResourceType.IamUser,
  [AssetType.AWS_IAM_ROLE]: AwsResourceType.IamRole,
  [AssetType.AWS_IAM_POLICY]: AwsResourceType.IamPolicy,
  [AssetType.AWS_SECURITY_GROUP]: AwsResourceType.SecurityGroup,
  [AssetType.AWS_RDS_INSTANCE]: AwsResourceType.RdsInstance,
  [AssetType.AWS_LAMBDA_FUNCTION]: AwsResourceType.LambdaFunction,
  [AssetType.AWS_CLOUDTRAIL_TRAIL]: AwsResourceType.CloudTrailTrail,
  [AssetType.AWS_ECR_REPOSITORY]: AwsResourceType.EcrRepository,
  [AssetType.AWS_SECRETS_MANAGER_SECRET]: AwsResourceType.SecretsManagerSecret,
  [AssetType.AWS_KMS_KEY]: AwsResourceType.KmsKey
};

const identityAssetTypes = new Set<AssetType>([
  AssetType.AWS_IAM_USER,
  AssetType.AWS_IAM_ROLE,
  AssetType.AWS_IAM_POLICY
]);

const dataAssetTypes = new Set<AssetType>([
  AssetType.AWS_S3_BUCKET,
  AssetType.AWS_RDS_INSTANCE,
  AssetType.AWS_SECRETS_MANAGER_SECRET,
  AssetType.AWS_KMS_KEY
]);

function mapAwsResourceTypeToPrisma(resourceType: AwsResourceType): AssetType {
  return awsResourceTypeToPrismaAssetType[resourceType];
}

function mapSharedSeverityToPrisma(severity: SharedFindingSeverity): PrismaFindingSeverity {
  switch (severity) {
    case SharedFindingSeverity.Critical:
      return PrismaFindingSeverity.CRITICAL;
    case SharedFindingSeverity.High:
      return PrismaFindingSeverity.HIGH;
    case SharedFindingSeverity.Medium:
      return PrismaFindingSeverity.MEDIUM;
    case SharedFindingSeverity.Low:
      return PrismaFindingSeverity.LOW;
    case SharedFindingSeverity.Informational:
      return PrismaFindingSeverity.INFORMATIONAL;
    default:
      throw new Error(`Unsupported finding severity: ${severity satisfies never}`);
  }
}

function toCloudAssetRef(asset: UpsertedAsset): CloudAssetRef {
  return {
    id: asset.id,
    tenantId: asset.tenantId,
    cloudAccountId: asset.cloudAccountId,
    provider: SharedCloudProvider.Aws,
    resourceType: prismaAssetTypeToAwsResourceType[asset.assetType],
    externalId: asset.externalId,
    region: asset.region,
    name: asset.name
  };
}

function toNormalizedAwsResource(asset: UpsertedAsset): NormalizedAwsResource {
  const normalized = recordValue(asset.normalized);

  return {
    resourceType: prismaAssetTypeToAwsResourceType[asset.assetType],
    externalId: asset.externalId,
    region: asset.region,
    name: asset.name,
    metadata: recordValue(normalized.metadata)
  };
}

function normalizedResourceFrom(resource: AwsDiscoveredResource): NormalizedAwsResource {
  return {
    resourceType: resource.resourceType,
    externalId: resource.externalId,
    region: resource.region || null,
    name: resource.name,
    metadata: recordValue(resource.metadata)
  };
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function jsonRecordOrNull(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordValueOrNull(value: unknown): Record<string, unknown> | null {
  const record = recordValue(value);

  return Object.keys(record).length > 0 ? record : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function boundedInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(value), 0), 10);
}

function arnFromExternalId(externalId: string): string | null {
  return externalId.startsWith("arn:") ? externalId : null;
}
