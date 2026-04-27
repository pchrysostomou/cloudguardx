export enum RoleKey {
  Owner = "owner",
  Admin = "admin",
  SecurityAnalyst = "security_analyst",
  ReadOnly = "read_only"
}

export enum PermissionAction {
  TenantRead = "tenant:read",
  TenantManage = "tenant:manage",
  UserInvite = "user:invite",
  CloudAccountRead = "cloud_account:read",
  CloudAccountManage = "cloud_account:manage",
  ScanRun = "scan:run",
  AssetRead = "asset:read",
  FindingRead = "finding:read",
  FindingManage = "finding:manage",
  ComplianceRead = "compliance:read",
  AttackPathRead = "attack_path:read",
  RemediationRead = "remediation:read",
  RemediationManage = "remediation:manage",
  AuditLogRead = "audit_log:read",
  NotificationManage = "notification:manage",
  AdminManage = "admin:manage"
}

export interface AuthenticatedPrincipal {
  userId: string;
  tenantId: string;
  membershipId: string;
  role: RoleKey;
  permissions: PermissionAction[];
  tokenFamilyId: string;
}
