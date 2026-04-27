import { NotFoundException } from "@nestjs/common";
import { ScanJobStatus } from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import { ScanJobsService } from "./scan-jobs.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("ScanJobsService", () => {
  it("creates pending scan jobs only for accounts in the authenticated tenant", async () => {
    const scanJobsRepository = {
      createPendingJob: jest.fn().mockResolvedValue({
        id: "scan-job-1",
        tenantId: "tenant-1",
        cloudAccountId: "account-1",
        requestedById: "user-1",
        status: ScanJobStatus.QUEUED,
        scanType: "asset_inventory",
        startedAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      })
    };
    const cloudAccountsRepository = {
      findByIdForTenant: jest.fn().mockResolvedValue({
        id: "account-1",
        tenantId: "tenant-1"
      })
    };
    const auditLogService = { record: jest.fn() };
    const service = new ScanJobsService(
      scanJobsRepository as never,
      cloudAccountsRepository as never,
      auditLogService as never
    );

    const result = await service.create(principal, { cloudAccountId: "account-1" }, { userAgent: "jest" });

    expect(cloudAccountsRepository.findByIdForTenant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      cloudAccountId: "account-1"
    });
    expect(scanJobsRepository.createPendingJob).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      cloudAccountId: "account-1",
      requestedById: "user-1",
      scanType: "asset_inventory"
    });
    expect(result.state).toBe("pending");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "user-1",
        action: "scan_job.create"
      })
    );
  });

  it("rejects scan jobs for cloud accounts outside the tenant", async () => {
    const service = new ScanJobsService(
      { createPendingJob: jest.fn() } as never,
      { findByIdForTenant: jest.fn().mockResolvedValue(null) } as never,
      { record: jest.fn() } as never
    );

    await expect(service.create(principal, { cloudAccountId: "account-from-other-tenant" }, {})).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
