import { Injectable } from "@nestjs/common";
import { RoleKey as PrismaRoleKey, TenantStatus } from "@prisma/client";
import type { PermissionAction } from "@cloudguardx/shared-types";
import { PrismaService } from "../../database/prisma.service";
import { allPermissionActions, mapPrismaRoleToSharedRole, permissionsForRole } from "../../common/rbac/role-permissions";

export interface CreateTenantWithOwnerInput {
  name: string;
  slug: string;
  ownerUserId: string;
}

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createTenantWithOwner(input: CreateTenantWithOwnerInput) {
    return this.prisma.$transaction(async (tx) => {
      const permissions = await Promise.all(
        allPermissionActions.map((action) =>
          tx.permission.upsert({
            where: { action },
            create: {
              action,
              description: action
            },
            update: {}
          })
        )
      );

      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          status: TenantStatus.ACTIVE
        }
      });

      const roles = await Promise.all(
        Object.values(PrismaRoleKey).map((roleKey) => {
          const role = mapPrismaRoleToSharedRole(roleKey);
          const rolePermissions = permissions.filter((permission) =>
            permissionsForRole(role).includes(permission.action as PermissionAction)
          );

          return tx.role.create({
            data: {
              tenantId: tenant.id,
              key: roleKey,
              name: role,
              description: `${role} role`,
              permissions: {
                connect: rolePermissions.map((permission) => ({ id: permission.id }))
              }
            }
          });
        })
      );
      const ownerRole = roles.find((role) => role.key === PrismaRoleKey.OWNER);

      if (!ownerRole) {
        throw new Error("Owner role was not created");
      }

      const membership = await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: input.ownerUserId,
          roleId: ownerRole.id,
          roleKey: PrismaRoleKey.OWNER
        }
      });

      return { tenant, membership };
    });
  }

  listActiveTenantsForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        tenant: {
          status: "ACTIVE"
        }
      },
      include: {
        tenant: true
      },
      orderBy: { createdAt: "asc" }
    });
  }

  findActiveTenantByIdForUser(input: { tenantId: string; userId: string }) {
    return this.prisma.membership.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        status: "ACTIVE",
        tenant: {
          status: "ACTIVE"
        }
      },
      include: {
        tenant: true
      }
    });
  }

  tenantSlugExists(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true }
    });
  }
}
