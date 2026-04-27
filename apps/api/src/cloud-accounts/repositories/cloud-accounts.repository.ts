import { Injectable } from "@nestjs/common";
import { CloudAccountStatus, CloudProvider } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface CreateAwsCloudAccountInput {
  tenantId: string;
  name: string;
  externalAccountId: string;
  roleArn: string;
  externalIdCiphertext: string;
  metadata: Prisma.InputJsonObject;
}

@Injectable()
export class CloudAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createAwsAccount(input: CreateAwsCloudAccountInput) {
    return this.prisma.cloudAccount.create({
      data: {
        tenantId: input.tenantId,
        provider: CloudProvider.AWS,
        name: input.name,
        externalAccountId: input.externalAccountId,
        roleArn: input.roleArn,
        externalIdCiphertext: input.externalIdCiphertext,
        status: CloudAccountStatus.PENDING,
        metadata: input.metadata
      }
    });
  }

  listForTenant(tenantId: string) {
    return this.prisma.cloudAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
  }

  findByIdForTenant(input: { tenantId: string; cloudAccountId: string }) {
    return this.prisma.cloudAccount.findFirst({
      where: {
        id: input.cloudAccountId,
        tenantId: input.tenantId
      }
    });
  }

  findByExternalAccountIdForTenant(input: { tenantId: string; externalAccountId: string }) {
    return this.prisma.cloudAccount.findFirst({
      where: {
        tenantId: input.tenantId,
        provider: CloudProvider.AWS,
        externalAccountId: input.externalAccountId
      }
    });
  }
}
