import { RoleKey } from "@cloudguardx/shared-types";
import { TenantsService } from "./tenants.service";

describe("TenantsService tenant isolation", () => {
  it("lists only tenants attached to the authenticated user", async () => {
    const tenantsRepository = {
      listActiveTenantsForUser: jest.fn().mockResolvedValue([
        {
          id: "membership-1",
          roleKey: "OWNER",
          tenant: {
            id: "tenant-1",
            name: "Tenant One",
            slug: "tenant-one"
          }
        }
      ]),
      tenantSlugExists: jest.fn()
    };
    const auditLogService = { record: jest.fn() };
    const service = new TenantsService(tenantsRepository as never, auditLogService as never);

    const result = await service.listForPrincipal({
      userId: "user-1",
      tenantId: "tenant-1",
      membershipId: "membership-1",
      role: RoleKey.Owner,
      permissions: [],
      tokenFamilyId: "family-1"
    });

    expect(tenantsRepository.listActiveTenantsForUser).toHaveBeenCalledWith("user-1");
    expect(result).toEqual([
      {
        id: "tenant-1",
        name: "Tenant One",
        slug: "tenant-one",
        role: "OWNER",
        membershipId: "membership-1"
      }
    ]);
  });
});

