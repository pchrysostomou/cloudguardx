import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { UserStatus } from "@prisma/client";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { PasswordService } from "../auth/password.service";
import { UsersRepository } from "./repositories/users.repository";

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService
  ) {}

  async createActiveUser(input: { email: string; password: string; displayName: string }) {
    const email = this.normalizeEmail(input.email);
    const existing = await this.usersRepository.findByEmail(email);

    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    return this.usersRepository.create({
      email,
      displayName: input.displayName.trim(),
      passwordHash: await this.passwordService.hashPassword(input.password)
    });
  }

  async findOrCreateInvitedUser(input: { email: string; displayName?: string }) {
    const email = this.normalizeEmail(input.email);
    const existing = await this.usersRepository.findByEmail(email);

    if (existing) {
      return existing;
    }

    return this.usersRepository.create({
      email,
      displayName: input.displayName?.trim() || email,
      passwordHash: await this.passwordService.hashPassword(randomUUID()),
      status: UserStatus.INVITED
    });
  }

  async getMe(principal: AuthenticatedPrincipal) {
    const user = await this.usersRepository.findById(principal.userId);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      tenantId: principal.tenantId,
      role: principal.role,
      permissions: principal.permissions
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}

