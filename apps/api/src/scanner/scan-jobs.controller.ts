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
import { CreateScanJobDto } from "./dto/create-scan-job.dto";
import { ScanJobsService } from "./scan-jobs.service";

@ApiTags("scan-jobs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("scan-jobs")
export class ScanJobsController {
  constructor(private readonly scanJobsService: ScanJobsService) {}

  @Get()
  @RequirePermissions(PermissionAction.CloudAccountRead)
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.scanJobsService.listForTenant(principal);
  }

  @Get(":id")
  @RequirePermissions(PermissionAction.CloudAccountRead)
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param("id") scanJobId: string) {
    return this.scanJobsService.getForTenant(principal, scanJobId);
  }

  @Post()
  @RequirePermissions(PermissionAction.ScanRun)
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateScanJobDto, @Req() request: Request) {
    return this.scanJobsService.create(
      principal,
      {
        cloudAccountId: dto.cloudAccountId,
        scanType: dto.scanType
      },
      requestMetadataFrom(request)
    );
  }
}
