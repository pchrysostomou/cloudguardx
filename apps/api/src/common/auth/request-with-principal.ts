import type { Request } from "express";
import type { AuthenticatedPrincipal, PermissionAction, RoleKey } from "@cloudguardx/shared-types";

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  membershipId: string;
  role: RoleKey;
  permissions: PermissionAction[];
  tokenFamilyId: string;
}

export interface RequestWithPrincipal extends Request {
  user: AuthenticatedPrincipal;
}

