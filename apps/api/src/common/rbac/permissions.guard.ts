import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PermissionAction } from "@cloudguardx/shared-types";
import type { RequestWithPrincipal } from "../auth/request-with-principal";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<PermissionAction[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const principal = request.user;

    if (!principal) {
      throw new ForbiddenException("Authenticated principal is required");
    }

    const granted = new Set(principal.permissions);
    const hasAllRequired = requiredPermissions.every((permission) => granted.has(permission));

    if (!hasAllRequired) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
