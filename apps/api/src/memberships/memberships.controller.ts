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
import { InviteMemberDto } from "./dto/invite-member.dto";
import { MembershipsService } from "./memberships.service";

@ApiTags("memberships")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  @RequirePermissions(PermissionAction.TenantRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.membershipsService.listForTenant(principal);
  }

  @Post("invitations")
  @RequirePermissions(PermissionAction.UserInvite)
  invite(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: InviteMemberDto,
    @Req() request: Request
  ) {
    return this.membershipsService.invite(
      principal,
      {
        email: dto.email,
        role: dto.role,
        displayName: dto.displayName
      },
      requestMetadataFrom(request)
    );
  }
}

