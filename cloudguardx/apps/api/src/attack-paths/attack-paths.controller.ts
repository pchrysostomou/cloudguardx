import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { AttackPathsService } from "./attack-paths.service";

@ApiTags("attack-paths")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("attack-paths")
export class AttackPathsController {
  constructor(private readonly attackPathsService: AttackPathsService) {}

  @Get("graph")
  @RequirePermissions(PermissionAction.AttackPathRead)
  getGraph(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.attackPathsService.getGraph(principal);
  }
}
