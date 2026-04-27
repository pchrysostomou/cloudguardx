import { AssetType, CloudProvider } from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import { AssetsService } from "./assets.service";

const principal = {
  userId: "user-1",
  tenantId: "tenant-1",
  membershipId: "membership-1",
  role: RoleKey.SecurityAnalyst,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("AssetsService", () => {
  it("lists assets only through tenant-scoped repository filters", async () => {
    const repository = {
      listForTenant: jest.fn().mockResolvedValue([
        {
          id: "asset-1",
          tenantId: "tenant-1",
          cloudAccountId: "account-1",
          provider: CloudProvider.AWS,
          assetType: AssetType.AWS_S3_BUCKET,
          externalId: "arn:aws:s3:::bucket",
          arn: "arn:aws:s3:::bucket",
          region: "us-east-1",
          name: "bucket",
          tags: { Environment: "test" },
          sensitivity: 5,
          criticality: 4,
          firstSeenAt: new Date("2026-04-26T00:00:00.000Z"),
          lastSeenAt: new Date("2026-04-26T00:00:00.000Z"),
          deletedAt: null
        }
      ])
    };
    const service = new AssetsService(repository as never);

    const result = await service.listForTenant(principal, {
      cloudAccountId: "account-1",
      assetType: "aws_s3_bucket"
    });

    expect(repository.listForTenant).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      cloudAccountId: "account-1",
      assetType: AssetType.AWS_S3_BUCKET,
      region: undefined,
      includeDeleted: undefined
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        resourceType: "aws_s3_bucket"
      })
    );
  });
});
