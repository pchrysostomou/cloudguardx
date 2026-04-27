import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { Environment } from "../../config/env.schema";
import { MembershipsRepository } from "../../memberships/repositories/memberships.repository";
import { mapPrismaRoleToSharedRole, permissionsForRole } from "../rbac/role-permissions";
import type { AccessTokenPayload, RequestWithPrincipal } from "./request-with-principal";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly membershipsRepository: MembershipsRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get("JWT_ACCESS_TOKEN_SECRET", { infer: true })
      });
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }

    const membership = await this.membershipsRepository.findActiveMembershipForPrincipal({
      membershipId: payload.membershipId,
      tenantId: payload.tenantId,
      userId: payload.sub
    });

    if (!membership) {
      throw new UnauthorizedException("Inactive tenant membership");
    }

    const role = mapPrismaRoleToSharedRole(membership.roleKey);
    const principal: AuthenticatedPrincipal = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      role,
      permissions: permissionsForRole(role),
      tokenFamilyId: payload.tokenFamilyId
    };

    request.user = principal;
    return true;
  }

  private extractBearerToken(request: RequestWithPrincipal): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");
    return scheme?.toLowerCase() === "bearer" && token ? token : null;
  }
}

