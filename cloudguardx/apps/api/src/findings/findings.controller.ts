import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { Request } from "express";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { requestMetadataFrom } from "../common/auth/request-metadata";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { ListFindingsQuery } from "./dto/list-findings.query";
import { UpdateFindingStatusDto } from "./dto/update-finding-status.dto";
import { FindingsService } from "./findings.service";

@ApiTags("findings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("findings")
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  @RequirePermissions(PermissionAction.FindingRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Query() query: ListFindingsQuery) {
    return this.findingsService.listForTenant(principal, query);
  }

  @Get(":id")
  @RequirePermissions(PermissionAction.FindingRead)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") findingId: string) {
    return this.findingsService.getForTenant(principal, findingId);
  }

  @Patch(":id/status")
  @RequirePermissions(PermissionAction.FindingManage)
  updateStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id") findingId: string,
    @Body() dto: UpdateFindingStatusDto,
    @Req() request: Request
  ) {
    return this.findingsService.updateStatus(principal, findingId, dto.status, requestMetadataFrom(request));
  }
}
