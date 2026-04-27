import { PermissionAction, RoleKey } from "@cloudguardx/shared-types";
import { permissionsForRole } from "./role-permissions";

describe("role permissions", () => {
  it("does not allow read_only users to invite users or manage findings", () => {
    const permissions = permissionsForRole(RoleKey.ReadOnly);

    expect(permissions).toContain(PermissionAction.FindingRead);
    expect(permissions).toContain(PermissionAction.AttackPathRead);
    expect(permissions).not.toContain(PermissionAction.UserInvite);
    expect(permissions).not.toContain(PermissionAction.FindingManage);
    expect(permissions).not.toContain(PermissionAction.CloudAccountManage);
    expect(permissions).not.toContain(PermissionAction.RemediationManage);
    expect(permissions).not.toContain(PermissionAction.ScanRun);
  });

  it("allows admins to invite users", () => {
    expect(permissionsForRole(RoleKey.Admin)).toContain(PermissionAction.UserInvite);
  });

  it("allows security analysts to generate remediation guidance", () => {
    expect(permissionsForRole(RoleKey.SecurityAnalyst)).toContain(PermissionAction.RemediationManage);
  });
});
