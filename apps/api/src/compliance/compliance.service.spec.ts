import {
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus as PrismaFindingStatus
} from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import { ComplianceService } from "./compliance.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("ComplianceService", () => {
  it("lists controls using tenant-scoped mappings", async () => {
    const repository = {
      ensureDefaultControls: jest.fn(),
      listControlsForTenant: jest.fn().mockResolvedValue([
        {
          id: "control-1",
          key: "cis-aws-s3-1",
          title: "S3 buckets should block public access",
          description: "No public buckets",
          framework: {
            id: "framework-1",
            key: "cis_aws_foundations",
            name: "CIS AWS Foundations-style controls",
            version: "phase-6",
            description: "Initial controls"
          },
          mappings: [
            {
              id: "mapping-1",
              controlId: "control-1",
              policyId: "policy-1",
              findingId: "finding-1",
              rationale: "Public bucket access",
              createdAt: new Date("2026-04-26T00:00:00.000Z"),
              finding: {
                title: "S3 bucket allows public access",
                severity: PrismaFindingSeverity.HIGH,
                status: PrismaFindingStatus.OPEN
              }
            }
          ]
        }
      ])
    };
    const service = new ComplianceService(repository as never);

    const result = await service.listControls(principal);

    expect(repository.ensureDefaultControls).toHaveBeenCalled();
    expect(repository.listControlsForTenant).toHaveBeenCalledWith("tenant-1");
    expect(result[0]).toEqual(
      expect.objectContaining({
        key: "cis-aws-s3-1",
        mappedFindingCount: 1,
        openFindingCount: 1,
        mappings: [
          expect.objectContaining({
            findingId: "finding-1",
            findingSeverity: "high",
            findingStatus: "open"
          })
        ]
      })
    );
  });

  it("requests finding mappings inside the authenticated tenant only", async () => {
    const repository = {
      listMappingsForFinding: jest.fn().mockResolvedValue([])
    };
    const service = new ComplianceService(repository as never);

    await service.listFindingMappings(principal, "finding-1");

    expect(repository.listMappingsForFinding).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      findingId: "finding-1"
    });
  });
});
