import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { RefreshTokenStatus, RoleKey as PrismaRoleKey, UserStatus } from "@prisma/client";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";

const configService = {
  get: jest.fn((key: string) => {
    const values: Record<string, string | number> = {
      JWT_ACCESS_TOKEN_SECRET: "test-access-secret-with-at-least-32-characters",
      ACCESS_TOKEN_TTL_SECONDS: 600,
      REFRESH_TOKEN_TTL_SECONDS: 604800
    };

    return values[key];
  })
};

function createService(overrides: Partial<Record<string, unknown>> = {}) {
  const usersService = {};
  const usersRepository = {};
  const tenantsService = {};
  const membershipsRepository = {
    findActiveMembershipByTenantAndUser: jest.fn().mockResolvedValue({
      id: "membership-1",
      tenantId: "tenant-1",
      userId: "user-1",
      roleKey: PrismaRoleKey.ADMIN
    })
  };
  const refreshTokenRepository = {
    findByHash: jest.fn(),
    markExpired: jest.fn(),
    markReuseAndRevokeFamily: jest.fn(),
    rotate: jest.fn().mockResolvedValue({ id: "refresh-2" }),
    revokeFamily: jest.fn(),
    create: jest.fn()
  };
  const auditLogService = {
    record: jest.fn()
  };

  const service = new AuthService(
    (overrides.usersService ?? usersService) as never,
    (overrides.usersRepository ?? usersRepository) as never,
    (overrides.tenantsService ?? tenantsService) as never,
    (overrides.membershipsRepository ?? membershipsRepository) as never,
    (overrides.refreshTokenRepository ?? refreshTokenRepository) as never,
    new PasswordService(),
    new JwtService(),
    configService as never,
    (overrides.auditLogService ?? auditLogService) as never
  );

  return {
    service,
    membershipsRepository,
    refreshTokenRepository,
    auditLogService
  };
}

describe("AuthService refresh token rotation", () => {
  it("rotates a refresh token and returns a new token pair", async () => {
    const { service, refreshTokenRepository, auditLogService } = createService();
    refreshTokenRepository.findByHash.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tenantId: "tenant-1",
      familyId: "family-1",
      status: RefreshTokenStatus.ACTIVE,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user-1", status: UserStatus.ACTIVE }
    });

    const result = await service.refresh("current-refresh-token-value", {
      ipAddress: "127.0.0.1",
      userAgent: "jest"
    });

    expect(result.accessTokenExpiresIn).toBe(600);
    expect(result.refreshTokenExpiresIn).toBe(604800);
    expect(result.refreshToken).not.toBe("current-refresh-token-value");
    expect(refreshTokenRepository.rotate).toHaveBeenCalledWith(
      expect.objectContaining({
        currentTokenId: "refresh-1",
        familyId: "family-1",
        userId: "user-1",
        tenantId: "tenant-1"
      })
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.refresh",
        tenantId: "tenant-1",
        actorUserId: "user-1"
      })
    );
  });

  it("detects refresh token reuse and revokes the token family", async () => {
    const { service, refreshTokenRepository, auditLogService } = createService();
    refreshTokenRepository.findByHash.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tenantId: "tenant-1",
      familyId: "family-1",
      status: RefreshTokenStatus.ROTATED,
      usedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user-1", status: UserStatus.ACTIVE }
    });

    await expect(service.refresh("previous-refresh-token-value", {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshTokenRepository.markReuseAndRevokeFamily).toHaveBeenCalledWith({
      tokenId: "refresh-1",
      familyId: "family-1"
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.refresh_token_reuse",
        targetId: "family-1"
      })
    );
  });

  it("treats a failed atomic rotation as refresh token reuse", async () => {
    const { service, refreshTokenRepository, auditLogService } = createService();
    refreshTokenRepository.findByHash.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tenantId: "tenant-1",
      familyId: "family-1",
      status: RefreshTokenStatus.ACTIVE,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user-1", status: UserStatus.ACTIVE }
    });
    refreshTokenRepository.rotate.mockResolvedValue(null);

    await expect(service.refresh("current-refresh-token-value", {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshTokenRepository.markReuseAndRevokeFamily).toHaveBeenCalledWith({
      tokenId: "refresh-1",
      familyId: "family-1"
    });
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.refresh_token_reuse",
        targetId: "family-1"
      })
    );
  });

  it("rejects expired refresh tokens without rotating", async () => {
    const { service, refreshTokenRepository } = createService();
    refreshTokenRepository.findByHash.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tenantId: "tenant-1",
      familyId: "family-1",
      status: RefreshTokenStatus.ACTIVE,
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      user: { id: "user-1", status: UserStatus.ACTIVE }
    });

    await expect(service.refresh("expired-refresh-token-value", {})).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshTokenRepository.markExpired).toHaveBeenCalledWith("refresh-1");
    expect(refreshTokenRepository.rotate).not.toHaveBeenCalled();
  });
});
