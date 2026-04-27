import { Injectable, NotFoundException } from "@nestjs/common";
import {
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus as PrismaFindingStatus,
  RemediationSource as PrismaRemediationSource
} from "@prisma/client";
import { FindingSeverity, FindingStatus, RemediationSource } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal, RemediationSummary } from "@cloudguardx/shared-types";
import { RemediationsRepository } from "./repositories/remediations.repository";

@Injectable()
export class RemediationsService {
  constructor(private readonly remediationsRepository: RemediationsRepository) {}

  async listForTenant(
    principal: AuthenticatedPrincipal,
    filters: { findingId?: string } = {}
  ): Promise<RemediationSummary[]> {
    const remediations = await this.remediationsRepository.listForTenant({
      tenantId: principal.tenantId,
      findingId: filters.findingId
    });

    return remediations.map(toRemediationSummary);
  }

  async getForTenant(principal: AuthenticatedPrincipal, remediationId: string): Promise<RemediationSummary> {
    const remediation = await this.remediationsRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      remediationId
    });

    if (!remediation) {
      throw new NotFoundException("Remediation not found");
    }

    return toRemediationSummary(remediation);
  }
}

export function toRemediationSummary(remediation: {
  id: string;
  tenantId: string;
  findingId: string;
  source: PrismaRemediationSource;
  guidanceMarkdown: string;
  terraformPatch: string | null;
  awsCliCommands: unknown;
  isDestructive: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  finding: {
    title: string;
    severity: PrismaFindingSeverity;
    status: PrismaFindingStatus;
  };
}): RemediationSummary {
  return {
    id: remediation.id,
    tenantId: remediation.tenantId,
    findingId: remediation.findingId,
    findingTitle: remediation.finding.title,
    findingSeverity: mapPrismaSeverity(remediation.finding.severity),
    findingStatus: mapPrismaStatus(remediation.finding.status),
    source: mapPrismaSource(remediation.source),
    guidanceMarkdown: remediation.guidanceMarkdown,
    terraformPatch: remediation.terraformPatch,
    awsCliCommands: recordOrNull(remediation.awsCliCommands),
    isDestructive: remediation.isDestructive,
    createdByUserId: remediation.createdByUserId,
    createdAt: remediation.createdAt.toISOString()
  };
}

function mapPrismaSource(source: PrismaRemediationSource): RemediationSource {
  switch (source) {
    case PrismaRemediationSource.HUMAN:
      return RemediationSource.Human;
    case PrismaRemediationSource.AI:
      return RemediationSource.Ai;
    default:
      throw new Error(`Unsupported remediation source: ${source satisfies never}`);
  }
}

function mapPrismaSeverity(severity: PrismaFindingSeverity): FindingSeverity {
  switch (severity) {
    case PrismaFindingSeverity.CRITICAL:
      return FindingSeverity.Critical;
    case PrismaFindingSeverity.HIGH:
      return FindingSeverity.High;
    case PrismaFindingSeverity.MEDIUM:
      return FindingSeverity.Medium;
    case PrismaFindingSeverity.LOW:
      return FindingSeverity.Low;
    case PrismaFindingSeverity.INFORMATIONAL:
      return FindingSeverity.Informational;
    default:
      throw new Error(`Unsupported finding severity: ${severity satisfies never}`);
  }
}

function mapPrismaStatus(status: PrismaFindingStatus): FindingStatus {
  switch (status) {
    case PrismaFindingStatus.OPEN:
      return FindingStatus.Open;
    case PrismaFindingStatus.TRIAGED:
      return FindingStatus.Triaged;
    case PrismaFindingStatus.RESOLVED:
      return FindingStatus.Resolved;
    case PrismaFindingStatus.RISK_ACCEPTED:
      return FindingStatus.RiskAccepted;
    default:
      throw new Error(`Unsupported finding status: ${status satisfies never}`);
  }
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
