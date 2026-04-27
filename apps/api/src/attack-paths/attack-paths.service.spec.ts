import {
  AttackGraphEdgeKind as PrismaAttackGraphEdgeKind,
  AttackGraphNodeKind as PrismaAttackGraphNodeKind
} from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import { AttackPathsService } from "./attack-paths.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("AttackPathsService", () => {
  it("returns tenant-scoped graph nodes and edges", async () => {
    const repository = {
      getGraphForTenant: jest.fn().mockResolvedValue({
        nodes: [
          {
            id: "node-1",
            tenantId: "tenant-1",
            assetId: "asset-1",
            kind: PrismaAttackGraphNodeKind.RESOURCE,
            externalId: "asset:asset-1",
            label: "public-bucket",
            properties: { assetType: "aws_s3_bucket" },
            createdAt: new Date("2026-04-26T00:00:00.000Z"),
            updatedAt: new Date("2026-04-26T00:00:00.000Z")
          }
        ],
        edges: [
          {
            id: "edge-1",
            tenantId: "tenant-1",
            sourceNodeId: "internet",
            targetNodeId: "node-1",
            kind: PrismaAttackGraphEdgeKind.NETWORK_EXPOSURE,
            label: "Public bucket exposure",
            properties: { findingId: "finding-1" },
            createdAt: new Date("2026-04-26T00:00:00.000Z")
          }
        ]
      })
    };
    const service = new AttackPathsService(repository as never);

    const result = await service.getGraph(principal);

    expect(repository.getGraphForTenant).toHaveBeenCalledWith("tenant-1");
    expect(result.nodes[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        kind: "resource",
        properties: { assetType: "aws_s3_bucket" }
      })
    );
    expect(result.edges[0]).toEqual(
      expect.objectContaining({
        kind: "network_exposure",
        properties: { findingId: "finding-1" }
      })
    );
  });
});
