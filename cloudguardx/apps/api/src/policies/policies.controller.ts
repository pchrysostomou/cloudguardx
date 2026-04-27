import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { PoliciesService } from "./policies.service";

@ApiTags("policies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("policies")
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  @RequirePermissions(PermissionAction.FindingRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.policiesService.listForTenant(principal);
  }

  @Get(":id")
  @RequirePermissions(PermissionAction.FindingRead)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") policyId: string) {
    return this.policiesService.getForTenant(principal, policyId);
  }
}
