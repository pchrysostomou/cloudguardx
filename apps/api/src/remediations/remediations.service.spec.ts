import {
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus as PrismaFindingStatus,
  RemediationSource as PrismaRemediationSource
} from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import { RemediationsService } from "./remediations.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("RemediationsService", () => {
  it("lists non-destructive remediation guidance inside the authenticated tenant", async () => {
    const repository = {
      listForTenant: jest.fn().mockResolvedValue([
        {
          id: "remediation-1",
          tenantId: "tenant-1",
          findingId: "finding-1",
          source: PrismaRemediationSource.HUMAN,
          guidanceMarkdown: "Review and update through approved change control.",
          terraformPatch: null,
          awsCliCommands: null,
          isDestructive: false,
          createdByUserId: null,
          createdAt: new Date("2026-04-26T00:00:00.000Z"),
          finding: {
            title: "S3 bucket allows public access",
            severity: PrismaFindingSeverity.HIGH,
            status: PrismaFindingStatus.OPEN
          }
        }
      ])
    };
    const service = new RemediationsService(repository as never);

    const result = await service.listForTenant(principal, { findingId: "finding-1" });

    expect(repository.listForTenant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      findingId: "finding-1"
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        findingId: "finding-1",
        source: "human",
        isDestructive: false,
        terraformPatch: null,
        findingSeverity: "high"
      })
    );
  });
});
