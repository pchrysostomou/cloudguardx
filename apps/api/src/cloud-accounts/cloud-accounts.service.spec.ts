import { BadRequestException } from "@nestjs/common";
import { RoleKey } from "@cloudguardx/shared-types";
import { CloudAccountsService } from "./cloud-accounts.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.Admin,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("CloudAccountsService", () => {
  it("onboards an AWS read-only role without returning the external ID", async () => {
    const cloudAccountsRepository = {
      findByExternalAccountIdForTenant: jest.fn().mockResolvedValue(null),
      createAwsAccount: jest.fn().mockResolvedValue({
        id: "account-1",
        tenantId: "tenant-1",
        provider: "AWS",
        name: "Production",
        externalAccountId: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/CloudGuardXReadOnly",
        status: "PENDING",
        lastSuccessfulScanAt: null,
        lastScanError: null,
        metadata: { onboardingMode: "read_only_role", regions: ["us-east-1"] },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      })
    };
    const fieldEncryptionService = {
      encrypt: jest.fn().mockReturnValue("encrypted-external-id")
    };
    const auditLogService = { record: jest.fn() };
    const service = new CloudAccountsService(
      cloudAccountsRepository as never,
      fieldEncryptionService as never,
      auditLogService as never
    );

    const result = await service.onboardAwsReadOnlyRole(
      principal,
      {
        name: "Production",
        externalAccountId: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/CloudGuardXReadOnly",
        externalId: "tenant-1-external-id",
        regions: ["us-east-1"]
      },
      { ipAddress: "127.0.0.1" }
    );

    expect(fieldEncryptionService.encrypt).toHaveBeenCalledWith("tenant-1-external-id");
    expect(cloudAccountsRepository.createAwsAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        externalIdCiphertext: "encrypted-external-id"
      })
    );
    expect(result).not.toHaveProperty("externalId");
    expect(result).not.toHaveProperty("externalIdCiphertext");
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "user-1",
        action: "cloud_account.create"
      })
    );
  });

  it("rejects a role ARN for a different AWS account", async () => {
    const service = new CloudAccountsService({} as never, {} as never, {} as never);

    await expect(
      service.onboardAwsReadOnlyRole(
        principal,
        {
          name: "Production",
          externalAccountId: "123456789012",
          roleArn: "arn:aws:iam::999999999999:role/CloudGuardXReadOnly",
          externalId: "tenant-1-external-id"
        },
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
