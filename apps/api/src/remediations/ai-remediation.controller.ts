import { Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PermissionAction } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { Request } from "express";
import { CurrentPrincipal } from "../common/auth/current-principal.decorator";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { requestMetadataFrom } from "../common/auth/request-metadata";
import { RequirePermissions } from "../common/rbac/permissions.decorator";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { AiRemediationService } from "./ai-remediation.service";

@ApiTags("findings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("findings")
export class AiRemediationController {
  constructor(private readonly aiRemediationService: AiRemediationService) {}

  @Post(":id/ai-remediation")
  @RequirePermissions(PermissionAction.RemediationManage)
  generateForFinding(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("id") findingId: string,
    @Req() request: Request
  ) {
    return this.aiRemediationService.generateForFinding(principal, findingId, requestMetadataFrom(request));
  }
}
