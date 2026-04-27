import { Injectable } from "@nestjs/common";
import type { FindingSeverity, FindingStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface ListFindingsInput {
  tenantId: string;
  status?: FindingStatus;
  severity?: FindingSeverity;
  cloudAccountId?: string;
  assetId?: string;
}

@Injectable()
export class FindingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForTenant(input: ListFindingsInput) {
    return this.prisma.finding.findMany({
      where: {
        tenantId: input.tenantId,
        status: input.status,
        severity: input.severity,
        cloudAccountId: input.cloudAccountId,
        assetId: input.assetId
      },
      include: {
        riskScore: true
      },
      orderBy: [{ status: "asc" }, { score: "desc" }, { lastSeenAt: "desc" }],
      take: 200
    });
  }

  findByIdForTenant(input: { tenantId: string; findingId: string }) {
    return this.prisma.finding.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.findingId
      },
      include: {
        riskScore: true
      }
    });
  }

  async updateStatusForTenant(input: {
    tenantId: string;
    findingId: string;
    status: FindingStatus;
    resolvedAt: Date | null;
  }) {
    const updated = await this.prisma.finding.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.findingId
      },
      data: {
        status: input.status,
        resolvedAt: input.resolvedAt
      }
    });

    if (updated.count !== 1) {
      return null;
    }

    return this.findByIdForTenant({
      tenantId: input.tenantId,
      findingId: input.findingId
    });
  }
}
