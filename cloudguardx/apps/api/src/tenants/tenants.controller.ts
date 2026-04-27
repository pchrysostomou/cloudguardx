import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { Request } from "express";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { requestMetadataFrom } from "../common/auth/request-metadata";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { TenantsService } from "./tenants.service";

@ApiTags("tenants")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @RequirePermissions(PermissionAction.TenantRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.tenantsService.listForPrincipal(principal);
  }

  @Post()
  @RequirePermissions(PermissionAction.TenantManage)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateTenantDto, @Req() request: Request) {
    return this.tenantsService.createTenantForUser(
      {
        name: dto.name,
        slug: dto.slug,
        ownerUserId: principal.userId
      },
      requestMetadataFrom(request)
    );
  }
}

