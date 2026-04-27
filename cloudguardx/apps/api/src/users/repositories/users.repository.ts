import { Injectable } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
  status?: UserStatus;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        status: input.status ?? UserStatus.ACTIVE
      }
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId }
    });
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  }
}

