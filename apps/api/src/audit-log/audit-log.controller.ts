import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { AuditLogService } from "./audit-log.service";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";

@ApiTags("audit-logs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("audit-logs")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequirePermissions(PermissionAction.AuditLogRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query("limit") limit?: string) {
    return this.auditLogService.listForTenant(principal, limit ? Number(limit) : undefined);
  }
}

