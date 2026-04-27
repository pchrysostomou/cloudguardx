import { BadRequestException } from "@nestjs/common";
import { RoleKey } from "@cloudguardx/shared-types";
import { RoleKey as PrismaRoleKey } from "@prisma/client";
import { MembershipsService } from "./memberships.service";

const principal = {
  userId: "actor-1",
  tenantId: "tenant-1",
  membershipId: "membership-actor",
  role: RoleKey.Admin,
  permissions: [],
  tokenFamilyId: "family-1"
};

describe("MembershipsService", () => {
  it("invites users only into the authenticated tenant and audits the change", async () => {
    const membershipsRepository = {
      inviteMember: jest.fn().mockResolvedValue({
        id: "membership-2",
        tenantId: "tenant-1",
        userId: "user-2",
        roleKey: PrismaRoleKey.SECURITY_ANALYST,
        status: "INVITED"
      })
    };
    const usersService = {
      findOrCreateInvitedUser: jest.fn().mockResolvedValue({ id: "user-2" })
    };
    const auditLogService = { record: jest.fn() };
    const service = new MembershipsService(
      membershipsRepository as never,
      usersService as never,
      auditLogService as never
    );

    await service.invite(
      principal,
      {
        email: "analyst@example.com",
        role: RoleKey.SecurityAnalyst
      },
      { ipAddress: "127.0.0.1" }
    );

    expect(membershipsRepository.inviteMember).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        invitedByUserId: "actor-1",
        roleKey: PrismaRoleKey.SECURITY_ANALYST
      })
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        actorUserId: "actor-1",
        action: "membership.invite"
      })
    );
  });

  it("does not allow owner invitations", async () => {
    const service = new MembershipsService({} as never, {} as never, {} as never);

    await expect(
      service.invite(
        principal,
        {
          email: "owner@example.com",
          role: RoleKey.Owner
        },
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

