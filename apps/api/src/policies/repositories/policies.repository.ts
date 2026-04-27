import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class PoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForTenant(tenantId: string) {
    return this.prisma.policy.findMany({
      where: { tenantId },
      orderBy: [{ enabled: "desc" }, { key: "asc" }]
    });
  }

  findByIdForTenant(input: { tenantId: string; policyId: string }) {
    return this.prisma.policy.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.policyId
      }
    });
  }
}
