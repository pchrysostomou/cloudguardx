import { ConflictException, Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { TenantsRepository } from "./repositories/tenants.repository";

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async createTenantForUser(
    input: { name: string; slug?: string; ownerUserId: string },
    metadata: RequestMetadata = {}
  ) {
    const slug = await this.generateAvailableSlug(input.slug ?? input.name);
    const result = await this.tenantsRepository.createTenantWithOwner({
      name: input.name.trim(),
      slug,
      ownerUserId: input.ownerUserId
    });

    await this.auditLogService.record({
      tenantId: result.tenant.id,
      actorUserId: input.ownerUserId,
      action: AuditActions.TenantCreate,
      targetType: "tenant",
      targetId: result.tenant.id,
      metadata: { slug },
      ...metadata
    });

    return {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
      membershipId: result.membership.id
    };
  }

  async listForPrincipal(principal: AuthenticatedPrincipal) {
    const memberships = await this.tenantsRepository.listActiveTenantsForUser(principal.userId);

    return memberships.map((membership) => ({
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      role: membership.roleKey,
      membershipId: membership.id
    }));
  }

  async assertTenantAccessible(input: { tenantId: string; userId: string }) {
    return this.tenantsRepository.findActiveTenantByIdForUser(input);
  }

  private async generateAvailableSlug(value: string): Promise<string> {
    const baseSlug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);

    if (!baseSlug) {
      throw new ConflictException("Tenant slug must contain letters or numbers");
    }

    let slug = baseSlug;
    let suffix = 1;

    while (await this.tenantsRepository.tenantSlugExists(slug)) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }
}

