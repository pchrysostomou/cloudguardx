import { ComplianceRepository } from "./compliance.repository";

describe("ComplianceRepository", () => {
  it("seeds default CIS AWS-style controls with idempotent upserts", async () => {
    const prisma = {
      complianceFramework: {
        upsert: jest.fn().mockResolvedValue({ id: "framework-1" })
      },
      complianceControl: {
        upsert: jest.fn((args: { create: { key: string } }) =>
          Promise.resolve({
            id: `control-${args.create.key}`,
            key: args.create.key
          })
        )
      }
    };
    const repository = new ComplianceRepository(prisma as never);

    await repository.ensureDefaultControls();

    expect(prisma.complianceFramework.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key_version: {
            key: "cis_aws_foundations",
            version: "phase-6"
          }
        },
        update: expect.objectContaining({
          name: "CIS AWS Foundations-style controls"
        })
      })
    );
    expect(prisma.complianceControl.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          frameworkId_key: {
            frameworkId: "framework-1",
            key: "cis-aws-s3-1"
          }
        }
      })
    );
  });
});
