import { BadRequestException, Injectable } from "@nestjs/common";
import { RoleKey } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { mapSharedRoleToPrismaRole } from "../common/rbac/role-permissions";
import { UsersService } from "../users/users.service";
import { MembershipsRepository } from "./repositories/memberships.repository";

@Injectable()
export class MembershipsService {
  constructor(
    private readonly membershipsRepository: MembershipsRepository,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService
  ) {}

  async listForTenant(principal: AuthenticatedPrincipal) {
    const memberships = await this.membershipsRepository.listForTenant(principal.tenantId);

    return memberships.map((membership) => ({
      id: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      email: membership.user.email,
      displayName: membership.user.displayName,
      role: membership.roleKey,
      status: membership.status,
      createdAt: membership.createdAt.toISOString()
    }));
  }

  async invite(principal: AuthenticatedPrincipal, input: { email: string; role: RoleKey; displayName?: string }, metadata: RequestMetadata) {
    if (input.role === RoleKey.Owner) {
      throw new BadRequestException("Owner role cannot be assigned through invitations");
    }

    const user = await this.usersService.findOrCreateInvitedUser({
      email: input.email,
      displayName: input.displayName
    });

    const membership = await this.membershipsRepository.inviteMember({
      tenantId: principal.tenantId,
      userId: user.id,
      roleKey: mapSharedRoleToPrismaRole(input.role),
      invitedByUserId: principal.userId
    });

    await this.auditLogService.record({
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      action: AuditActions.MembershipInvite,
      targetType: "membership",
      targetId: membership.id,
      metadata: {
        invitedUserId: user.id,
        role: input.role
      },
      ...metadata
    });

    return {
      id: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: membership.roleKey,
      status: membership.status
    };
  }
}

