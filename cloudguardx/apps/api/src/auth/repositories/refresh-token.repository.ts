import { Injectable } from "@nestjs/common";
import { RefreshTokenStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface CreateRefreshTokenInput {
  userId: string;
  tenantId: string;
  tokenHash: string;
  familyId: string;
  parentTokenId?: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateRefreshTokenInput) {
    return this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        parentTokenId: input.parentTokenId,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      }
    });
  }

  findByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true
      }
    });
  }

  async rotate(input: {
    currentTokenId: string;
    newTokenHash: string;
    familyId: string;
    userId: string;
    tenantId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const rotatedAt = new Date();
      const consumed = await tx.refreshToken.updateMany({
        where: {
          id: input.currentTokenId,
          status: RefreshTokenStatus.ACTIVE,
          usedAt: null,
          revokedAt: null
        },
        data: {
          status: RefreshTokenStatus.ROTATED,
          usedAt: rotatedAt
        }
      });

      if (consumed.count !== 1) {
        return null;
      }

      return tx.refreshToken.create({
        data: {
          userId: input.userId,
          tenantId: input.tenantId,
          tokenHash: input.newTokenHash,
          familyId: input.familyId,
          parentTokenId: input.currentTokenId,
          expiresAt: input.expiresAt,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent
        }
      });
    });
  }

  async markExpired(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { status: RefreshTokenStatus.EXPIRED }
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: {
        status: RefreshTokenStatus.REVOKED,
        revokedAt: new Date()
      }
    });
  }

  async markReuseAndRevokeFamily(input: { tokenId: string; familyId: string }): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { familyId: input.familyId },
        data: {
          status: RefreshTokenStatus.REVOKED,
          revokedAt: new Date()
        }
      }),
      this.prisma.refreshToken.update({
        where: { id: input.tokenId },
        data: {
          status: RefreshTokenStatus.REUSED,
          reuseDetectedAt: new Date(),
          revokedAt: new Date()
        }
      })
    ]);
  }

  userCanAuthenticate(userStatus: UserStatus): boolean {
    return userStatus === UserStatus.ACTIVE;
  }
}
