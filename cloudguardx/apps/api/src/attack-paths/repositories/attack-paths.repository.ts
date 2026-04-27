import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class AttackPathsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getGraphForTenant(tenantId: string) {
    const [nodes, edges] = await Promise.all([
      this.prisma.attackGraphNode.findMany({
        where: { tenantId },
        orderBy: [{ kind: "asc" }, { label: "asc" }]
      }),
      this.prisma.attackGraphEdge.findMany({
        where: { tenantId },
        orderBy: [{ kind: "asc" }, { label: "asc" }]
      })
    ]);

    return { nodes, edges };
  }
}
