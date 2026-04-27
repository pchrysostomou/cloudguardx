import {
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus as PrismaFindingStatus
} from "@prisma/client";
import { FindingStatus, RoleKey } from "@cloudguardx/shared-types";
import { FindingsService } from "./findings.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

const finding = {
  id: "finding-1",
  tenantId: "tenant-1",
  cloudAccountId: "account-1",
  assetId: "asset-1",
  policyId: "policy-1",
  title: "S3 bucket allows public access",
  description: "Bucket is public",
  severity: PrismaFindingSeverity.HIGH,
  status: PrismaFindingStatus.OPEN,
  score: 75,
  evidence: { public: true },
  riskScore: {
    factors: { internetExposure: 9 },
    calculatedAt: new Date("2026-04-26T00:00:00.000Z")
  },
  firstSeenAt: new Date("2026-04-26T00:00:00.000Z"),
  lastSeenAt: new Date("2026-04-26T00:00:00.000Z"),
  resolvedAt: null,
  createdAt: new Date("2026-04-26T00:00:00.000Z"),
  updatedAt: new Date("2026-04-26T00:00:00.000Z")
};

describe("FindingsService", () => {
  it("lists findings through tenant-scoped repository filters", async () => {
    const repository = {
      listForTenant: jest.fn().mockResolvedValue([finding])
    };
    const service = new FindingsService(repository as never, { record: jest.fn() } as never);

    const result = await service.listForTenant(principal, { status: FindingStatus.Open });

    expect(repository.listForTenant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      status: PrismaFindingStatus.OPEN,
      severity: undefined,
      cloudAccountId: undefined,
      assetId: undefined
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        status: "open",
        riskScore: expect.objectContaining({
          factors: { internetExposure: 9 }
        })
      })
    );
  });

  it("updates finding status only inside the authenticated tenant and audits it", async () => {
    const repository = {
      updateStatusForTenant: jest.fn().mockResolvedValue({
        ...finding,
        status: PrismaFindingStatus.TRIAGED
      })
    };
    const auditLogService = { record: jest.fn() };
    const service = new FindingsService(repository as never, auditLogService as never);

    const result = await service.updateStatus(principal, "finding-1", FindingStatus.Triaged, { userAgent: "jest" });

    expect(repository.updateStatusForTenant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      findingId: "finding-1",
      status: PrismaFindingStatus.TRIAGED,
      resolvedAt: null
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "user-1",
        action: "finding.status_update",
        targetId: "finding-1"
      })
    );
    expect(result.status).toBe("triaged");
  });
});
