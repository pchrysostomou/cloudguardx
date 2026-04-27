import { SetMetadata } from "@nestjs/common";
import type { PermissionAction } from "@cloudguardx/shared-types";

export const REQUIRED_PERMISSIONS_KEY = "cloudguardx:required-permissions";

export const RequirePermissions = (...permissions: PermissionAction[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

