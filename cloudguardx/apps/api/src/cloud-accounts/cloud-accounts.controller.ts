import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { Request } from "express";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { requestMetadataFrom } from "../common/auth/request-metadata";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { CloudAccountsService } from "./cloud-accounts.service";
import { CreateAwsCloudAccountDto } from "./dto/create-aws-cloud-account.dto";

@ApiTags("cloud-accounts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("cloud-accounts")
export class CloudAccountsController {
  constructor(private readonly cloudAccountsService: CloudAccountsService) {}

  @Get()
  @RequirePermissions(PermissionAction.CloudAccountRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.cloudAccountsService.listForTenant(principal);
  }

  @Get(":id")
  @RequirePermissions(PermissionAction.CloudAccountRead)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") cloudAccountId: string) {
    return this.cloudAccountsService.getForTenant(principal, cloudAccountId);
  }

  @Post("aws")
  @RequirePermissions(PermissionAction.CloudAccountManage)
  onboardAws(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateAwsCloudAccountDto,
    @Req() request: Request
  ) {
    return this.cloudAccountsService.onboardAwsReadOnlyRole(
      principal,
      {
        name: dto.name,
        externalAccountId: dto.externalAccountId,
        roleArn: dto.roleArn,
        externalId: dto.externalId,
        regions: dto.regions
      },
      requestMetadataFrom(request)
    );
  }
}
