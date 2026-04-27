import { RoleKey as PrismaRoleKey } from "@prisma/client";
import { PermissionAction, RoleKey } from "@cloudguardx/shared-types";

export const allPermissionActions: PermissionAction[] = Object.values(PermissionAction);

export const rolePermissionMap: Record<RoleKey, PermissionAction[]> = {
  [RoleKey.Owner]: allPermissionActions,
  [RoleKey.Admin]: [
    PermissionAction.TenantRead,
    PermissionAction.UserInvite,
    PermissionAction.CloudAccountRead,
    PermissionAction.CloudAccountManage,
    PermissionAction.ScanRun,
    PermissionAction.AssetRead,
    PermissionAction.FindingRead,
    PermissionAction.FindingManage,
    PermissionAction.ComplianceRead,
    PermissionAction.AttackPathRead,
    PermissionAction.RemediationRead,
    PermissionAction.RemediationManage,
    PermissionAction.AuditLogRead,
    PermissionAction.NotificationManage,
    PermissionAction.AdminManage
  ],
  [RoleKey.SecurityAnalyst]: [
    PermissionAction.TenantRead,
    PermissionAction.CloudAccountRead,
    PermissionAction.ScanRun,
    PermissionAction.AssetRead,
    PermissionAction.FindingRead,
    PermissionAction.FindingManage,
    PermissionAction.ComplianceRead,
    PermissionAction.AttackPathRead,
    PermissionAction.RemediationRead,
    PermissionAction.RemediationManage,
    PermissionAction.AuditLogRead
  ],
  [RoleKey.ReadOnly]: [
    PermissionAction.TenantRead,
    PermissionAction.CloudAccountRead,
    PermissionAction.AssetRead,
    PermissionAction.FindingRead,
    PermissionAction.ComplianceRead,
    PermissionAction.AttackPathRead,
    PermissionAction.RemediationRead
  ]
};

export function permissionsForRole(role: RoleKey): PermissionAction[] {
  return rolePermissionMap[role];
}

export function mapSharedRoleToPrismaRole(role: RoleKey): PrismaRoleKey {
  switch (role) {
    case RoleKey.Owner:
      return PrismaRoleKey.OWNER;
    case RoleKey.Admin:
      return PrismaRoleKey.ADMIN;
    case RoleKey.SecurityAnalyst:
      return PrismaRoleKey.SECURITY_ANALYST;
    case RoleKey.ReadOnly:
      return PrismaRoleKey.READ_ONLY;
    default:
      throw new Error(`Unsupported role: ${role satisfies never}`);
  }
}

export function mapPrismaRoleToSharedRole(role: PrismaRoleKey): RoleKey {
  switch (role) {
    case PrismaRoleKey.OWNER:
      return RoleKey.Owner;
    case PrismaRoleKey.ADMIN:
      return RoleKey.Admin;
    case PrismaRoleKey.SECURITY_ANALYST:
      return RoleKey.SecurityAnalyst;
    case PrismaRoleKey.READ_ONLY:
      return RoleKey.ReadOnly;
    default:
      throw new Error(`Unsupported Prisma role: ${role satisfies never}`);
  }
}
