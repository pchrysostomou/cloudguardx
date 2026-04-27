import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { RefreshTokenStatus, UserStatus } from "@prisma/client";
import { RoleKey } from "@cloudguardx/shared-types";
import type { PermissionAction } from "@cloudguardx/shared-types";
import type { Environment } from "../config/env.schema";
import type { RequestMetadata } from "../common/auth/request-metadata";
import type { AccessTokenPayload } from "../common/auth/request-with-principal";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { mapPrismaRoleToSharedRole, permissionsForRole } from "../common/rbac/role-permissions";
import { MembershipsRepository } from "../memberships/repositories/memberships.repository";
import { TenantsService } from "../tenants/tenants.service";
import { UsersRepository } from "../users/repositories/users.repository";
import { UsersService } from "../users/users.service";
import { PasswordService } from "./password.service";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";

export interface TokenPair {
  tokenType: "Bearer";
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersRepository: UsersRepository,
    private readonly tenantsService: TenantsService,
    private readonly membershipsRepository: MembershipsRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly auditLogService: AuditLogService
  ) {}

  async register(
    input: {
      email: string;
      password: string;
      displayName: string;
      organizationName: string;
      organizationSlug?: string;
    },
    metadata: RequestMetadata
  ) {
    const user = await this.usersService.createActiveUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName
    });
    const tenant = await this.tenantsService.createTenantForUser(
      {
        name: input.organizationName,
        slug: input.organizationSlug,
        ownerUserId: user.id
      },
      metadata
    );
    const membership = await this.membershipsRepository.findActiveMembershipForPrincipal({
      membershipId: tenant.membershipId,
      tenantId: tenant.id,
      userId: user.id
    });

    if (!membership) {
      throw new UnauthorizedException("Tenant membership was not created");
    }

    const tokens = await this.issueTokenPair(
      {
        userId: user.id,
        tenantId: tenant.id,
        membershipId: membership.id,
        role: mapPrismaRoleToSharedRole(membership.roleKey),
        familyId: randomUUID()
      },
      metadata
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      },
      tenant,
      tokens
    };
  }

  async login(input: { email: string; password: string; tenantId?: string }, metadata: RequestMetadata): Promise<TokenPair> {
    const user = await this.usersRepository.findByEmail(input.email.trim().toLowerCase());

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordMatches = await this.passwordService.verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const membership = input.tenantId
      ? await this.membershipsRepository.findActiveMembershipByTenantAndUser({
          tenantId: input.tenantId,
          userId: user.id
        })
      : await this.membershipsRepository.findFirstActiveMembershipForUser(user.id);

    if (!membership) {
      throw new UnauthorizedException("No active tenant membership");
    }

    await this.usersRepository.touchLastLogin(user.id);

    const tokens = await this.issueTokenPair(
      {
        userId: user.id,
        tenantId: membership.tenantId,
        membershipId: membership.id,
        role: mapPrismaRoleToSharedRole(membership.roleKey),
        familyId: randomUUID()
      },
      metadata
    );

    await this.auditLogService.record({
      tenantId: membership.tenantId,
      actorUserId: user.id,
      action: AuditActions.Login,
      targetType: "user",
      targetId: user.id,
      ...metadata
    });

    return tokens;
  }

  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<TokenPair> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findByHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.refreshTokenRepository.markExpired(storedToken.id);
      throw new UnauthorizedException("Refresh token expired");
    }

    if (storedToken.status !== RefreshTokenStatus.ACTIVE || storedToken.usedAt || storedToken.revokedAt) {
      await this.refreshTokenRepository.markReuseAndRevokeFamily({
        tokenId: storedToken.id,
        familyId: storedToken.familyId
      });
      await this.auditLogService.record({
        tenantId: storedToken.tenantId ?? undefined,
        actorUserId: storedToken.userId,
        action: AuditActions.TokenReuse,
        targetType: "refresh_token_family",
        targetId: storedToken.familyId,
        metadata: { tokenId: storedToken.id, previousStatus: storedToken.status },
        ...metadata
      });
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    if (!storedToken.tenantId || storedToken.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const membership = await this.membershipsRepository.findActiveMembershipByTenantAndUser({
      tenantId: storedToken.tenantId,
      userId: storedToken.userId
    });

    if (!membership) {
      throw new UnauthorizedException("No active tenant membership");
    }

    const rawNewRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashRefreshToken(rawNewRefreshToken);
    const refreshTokenExpiresIn = this.refreshTokenTtlSeconds();

    const rotatedToken = await this.refreshTokenRepository.rotate({
      currentTokenId: storedToken.id,
      newTokenHash,
      familyId: storedToken.familyId,
      userId: storedToken.userId,
      tenantId: storedToken.tenantId,
      expiresAt: this.expiresInSeconds(refreshTokenExpiresIn),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    });

    if (!rotatedToken) {
      await this.refreshTokenRepository.markReuseAndRevokeFamily({
        tokenId: storedToken.id,
        familyId: storedToken.familyId
      });
      await this.auditLogService.record({
        tenantId: storedToken.tenantId,
        actorUserId: storedToken.userId,
        action: AuditActions.TokenReuse,
        targetType: "refresh_token_family",
        targetId: storedToken.familyId,
        metadata: { tokenId: storedToken.id, previousStatus: storedToken.status },
        ...metadata
      });
      throw new UnauthorizedException("Refresh token reuse detected");
    }

    const accessToken = await this.signAccessToken({
      userId: storedToken.userId,
      tenantId: storedToken.tenantId,
      membershipId: membership.id,
      role: mapPrismaRoleToSharedRole(membership.roleKey),
      familyId: storedToken.familyId
    });

    await this.auditLogService.record({
      tenantId: storedToken.tenantId,
      actorUserId: storedToken.userId,
      action: AuditActions.Refresh,
      targetType: "refresh_token_family",
      targetId: storedToken.familyId,
      ...metadata
    });

    return {
      tokenType: "Bearer",
      accessToken,
      accessTokenExpiresIn: this.accessTokenTtlSeconds(),
      refreshToken: rawNewRefreshToken,
      refreshTokenExpiresIn
    };
  }

  async logout(refreshToken: string, metadata: RequestMetadata): Promise<{ revoked: boolean }> {
    const storedToken = await this.refreshTokenRepository.findByHash(this.hashRefreshToken(refreshToken));

    if (!storedToken) {
      return { revoked: false };
    }

    await this.refreshTokenRepository.revokeFamily(storedToken.familyId);
    await this.auditLogService.record({
      tenantId: storedToken.tenantId ?? undefined,
      actorUserId: storedToken.userId,
      action: AuditActions.Logout,
      targetType: "refresh_token_family",
      targetId: storedToken.familyId,
      ...metadata
    });

    return { revoked: true };
  }

  private async issueTokenPair(
    input: {
      userId: string;
      tenantId: string;
      membershipId: string;
      role: RoleKey;
      familyId: string;
    },
    metadata: RequestMetadata
  ): Promise<TokenPair> {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenExpiresIn = this.refreshTokenTtlSeconds();

    await this.refreshTokenRepository.create({
      userId: input.userId,
      tenantId: input.tenantId,
      tokenHash: this.hashRefreshToken(refreshToken),
      familyId: input.familyId,
      expiresAt: this.expiresInSeconds(refreshTokenExpiresIn),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent
    });

    return {
      tokenType: "Bearer",
      accessToken: await this.signAccessToken(input),
      accessTokenExpiresIn: this.accessTokenTtlSeconds(),
      refreshToken,
      refreshTokenExpiresIn
    };
  }

  private signAccessToken(input: {
    userId: string;
    tenantId: string;
    membershipId: string;
    role: RoleKey;
    familyId: string;
  }): Promise<string> {
    const permissions: PermissionAction[] = permissionsForRole(input.role);
    const payload: AccessTokenPayload = {
      sub: input.userId,
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      role: input.role,
      permissions,
      tokenFamilyId: input.familyId
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get("JWT_ACCESS_TOKEN_SECRET", { infer: true }),
      expiresIn: this.accessTokenTtlSeconds()
    });
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken, "utf8").digest("hex");
  }

  private expiresInSeconds(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }

  private accessTokenTtlSeconds(): number {
    return this.configService.get("ACCESS_TOKEN_TTL_SECONDS", { infer: true });
  }

  private refreshTokenTtlSeconds(): number {
    return this.configService.get("REFRESH_TOKEN_TTL_SECONDS", { infer: true });
  }
}
