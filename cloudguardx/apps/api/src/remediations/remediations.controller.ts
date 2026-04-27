import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { ListRemediationsQuery } from "./dto/list-remediations.query";
import { RemediationsService } from "./remediations.service";

@ApiTags("remediations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("remediations")
export class RemediationsController {
  constructor(private readonly remediationsService: RemediationsService) {}

  @Get()
  @RequirePermissions(PermissionAction.RemediationRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ListRemediationsQuery) {
    return this.remediationsService.listForTenant(principal, query);
  }

  @Get(":id")
  @RequirePermissions(PermissionAction.RemediationRead)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") remediationId: string) {
    return this.remediationsService.getForTenant(principal, remediationId);
  }
}
