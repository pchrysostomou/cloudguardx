import { Injectable } from "@nestjs/common";
import { MembershipStatus, RoleKey as PrismaRoleKey } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveMembershipForPrincipal(input: { membershipId: string; tenantId: string; userId: string }) {
    return this.prisma.membership.findFirst({
      where: {
        id: input.membershipId,
        tenantId: input.tenantId,
        userId: input.userId,
        status: MembershipStatus.ACTIVE,
        tenant: {
          status: "ACTIVE"
        },
        user: {
          status: "ACTIVE"
        }
      }
    });
  }

  findActiveMembershipByTenantAndUser(input: { tenantId: string; userId: string }) {
    return this.prisma.membership.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        status: MembershipStatus.ACTIVE,
        tenant: {
          status: "ACTIVE"
        }
      }
    });
  }

  findFirstActiveMembershipForUser(userId: string) {
    return this.prisma.membership.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        tenant: {
          status: "ACTIVE"
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  listForTenant(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async inviteMember(input: {
    tenantId: string;
    userId: string;
    roleKey: PrismaRoleKey;
    invitedByUserId: string;
  }) {
    const role = await this.prisma.role.findUnique({
      where: {
        tenantId_key: {
          tenantId: input.tenantId,
          key: input.roleKey
        }
      }
    });

    if (!role) {
      throw new Error("Tenant role was not found");
    }

    return this.prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: input.tenantId,
          userId: input.userId
        }
      },
      create: {
        tenantId: input.tenantId,
        userId: input.userId,
        roleId: role.id,
        roleKey: input.roleKey,
        status: MembershipStatus.INVITED,
        invitedByUserId: input.invitedByUserId
      },
      update: {
        roleId: role.id,
        roleKey: input.roleKey,
        status: MembershipStatus.INVITED,
        invitedByUserId: input.invitedByUserId
      }
    });
  }
}
