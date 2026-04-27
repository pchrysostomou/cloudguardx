import { Injectable } from "@nestjs/common";
import { Prisma, RemediationSource } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class RemediationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForTenant(input: { tenantId: string; findingId?: string }) {
    return this.prisma.remediation.findMany({
      where: {
        tenantId: input.tenantId,
        findingId: input.findingId
      },
      include: {
        finding: true
      },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  findByIdForTenant(input: { tenantId: string; remediationId: string }) {
    return this.prisma.remediation.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.remediationId
      },
      include: {
        finding: true
      }
    });
  }

  findFindingContextByIdForTenant(input: { tenantId: string; findingId: string }) {
    return this.prisma.finding.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.findingId
      },
      select: {
        id: true,
        tenantId: true,
        title: true,
        description: true,
        severity: true,
        status: true,
        score: true,
        evidence: true,
        firstSeenAt: true,
        lastSeenAt: true,
        asset: {
          select: {
            id: true,
            assetType: true,
            externalId: true,
            arn: true,
            region: true,
            name: true,
            tags: true,
            normalized: true,
            sensitivity: true,
            criticality: true
          }
        },
        cloudAccount: {
          select: {
            id: true,
            provider: true,
            name: true,
            externalAccountId: true,
            metadata: true
          }
        },
        policy: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            severity: true,
            parameters: true
          }
        },
        riskScore: {
          select: {
            factors: true,
            calculatedAt: true
          }
        }
      }
    });
  }

  createAiGuidance(input: {
    tenantId: string;
    findingId: string;
    guidanceMarkdown: string;
    terraformPatch: string;
    awsCliCommands: Record<string, unknown>;
    isDestructive: boolean;
    createdByUserId: string;
  }) {
    return this.prisma.remediation.create({
      data: {
        tenantId: input.tenantId,
        findingId: input.findingId,
        source: RemediationSource.AI,
        guidanceMarkdown: input.guidanceMarkdown,
        terraformPatch: input.terraformPatch,
        awsCliCommands: input.awsCliCommands as Prisma.InputJsonObject,
        isDestructive: input.isDestructive,
        createdByUserId: input.createdByUserId
      },
      include: {
        finding: true
      }
    });
  }
}
