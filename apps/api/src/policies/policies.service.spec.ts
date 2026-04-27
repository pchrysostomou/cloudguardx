import { FindingSeverity } from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import { PoliciesService } from "./policies.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("PoliciesService", () => {
  it("lists only tenant-scoped policies", async () => {
    const repository = {
      listForTenant: jest.fn().mockResolvedValue([
        {
          id: "policy-1",
          tenantId: "tenant-1",
          key: "aws_s3_bucket_public_access_prohibited",
          name: "S3 buckets must not be public",
          description: "Detects public S3 access",
          severity: FindingSeverity.HIGH,
          enabled: true,
          implementation: "builtin:aws.s3.public_access_prohibited",
          parameters: null,
          createdAt: new Date("2026-04-26T00:00:00.000Z"),
          updatedAt: new Date("2026-04-26T00:00:00.000Z")
        }
      ])
    };
    const service = new PoliciesService(repository as never);

    const result = await service.listForTenant(principal);

    expect(repository.listForTenant).toHaveBeenCalledWith("tenant-1");
    expect(result[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        severity: "high"
      })
    );
  });
});
