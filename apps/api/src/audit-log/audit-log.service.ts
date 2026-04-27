import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AuditLogRepository } from "./repositories/audit-log.repository";

export const AuditActions = {
  Login: "auth.login",
  Logout: "auth.logout",
  Refresh: "auth.refresh",
  TokenReuse: "auth.refresh_token_reuse",
  TenantCreate: "tenant.create",
  MembershipInvite: "membership.invite",
  MembershipRoleChange: "membership.role_change",
  CloudAccountCreate: "cloud_account.create",
  ScanJobCreate: "scan_job.create",
  FindingStatusUpdate: "finding.status_update",
  AiRemediationGenerate: "remediation.ai_generate"
} as const;

export interface RecordAuditLogInput extends RequestMetadata {
  tenantId?: string;
  actorUserId?: string;
  action: (typeof AuditActions)[keyof typeof AuditActions] | string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.auditLogRepository.create(input);
  }

  async listForTenant(principal: AuthenticatedPrincipal, requestedLimit = 50) {
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const logs = await this.auditLogRepository.listForTenant(principal.tenantId, limit);

    return logs.map((log) => ({
      id: log.id,
      tenantId: log.tenantId,
      actorUserId: log.actorUserId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }));
  }
}
