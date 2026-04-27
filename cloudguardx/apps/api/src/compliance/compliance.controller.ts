import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { ComplianceService } from "./compliance.service";

@ApiTags("compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get("controls")
  @RequirePermissions(PermissionAction.ComplianceRead)
  listControls(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.complianceService.listControls(principal);
  }

  @Get("findings/:id")
  @RequirePermissions(PermissionAction.ComplianceRead)
  listFindingMappings(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") findingId: string) {
    return this.complianceService.listFindingMappings(principal, findingId);
  }
}
