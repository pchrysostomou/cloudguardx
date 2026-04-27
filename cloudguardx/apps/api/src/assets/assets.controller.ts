import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { AssetsService } from "./assets.service";
import { ListAssetsQuery } from "./dto/list-assets.query";

@ApiTags("assets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions(PermissionAction.AssetRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ListAssetsQuery) {
    return this.assetsService.listForTenant(principal, query);
  }

  @Get(":id")
  @RequirePermissions(PermissionAction.AssetRead)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") assetId: string) {
    return this.assetsService.getForTenant(principal, assetId);
  }
}
