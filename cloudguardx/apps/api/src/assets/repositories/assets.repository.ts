import { Injectable } from "@nestjs/common";
import type { AssetType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface ListAssetsInput {
  tenantId: string;
  cloudAccountId?: string;
  assetType?: AssetType;
  region?: string;
  includeDeleted?: boolean;
}

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForTenant(input: ListAssetsInput) {
    return this.prisma.asset.findMany({
      where: {
        tenantId: input.tenantId,
        cloudAccountId: input.cloudAccountId,
        assetType: input.assetType,
        region: input.region,
        ...(input.includeDeleted ? {} : { deletedAt: null })
      },
      orderBy: [{ lastSeenAt: "desc" }, { name: "asc" }],
      take: 500
    });
  }

  findByIdForTenant(input: { tenantId: string; assetId: string }) {
    return this.prisma.asset.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.assetId
      }
    });
  }
}
