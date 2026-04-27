import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus as PrismaFindingStatus
} from "@prisma/client";
import { FindingSeverity, FindingStatus } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal, FindingSummary } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { FindingsRepository } from "./repositories/findings.repository";

@Injectable()
export class FindingsService {
  constructor(
    private readonly findingsRepository: FindingsRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async listForTenant(
    principal: AuthenticatedPrincipal,
    filters: {
      status?: FindingStatus;
      severity?: FindingSeverity;
      cloudAccountId?: string;
      assetId?: string;
    } = {}
  ): Promise<FindingSummary[]> {
    const findings = await this.findingsRepository.listForTenant({
      tenantId: principal.tenantId,
      status: filters.status ? mapSharedStatusToPrisma(filters.status) : undefined,
      severity: filters.severity ? mapSharedSeverityToPrisma(filters.severity) : undefined,
      cloudAccountId: filters.cloudAccountId,
      assetId: filters.assetId
    });

    return findings.map(toFindingSummary);
  }

  async getForTenant(principal: AuthenticatedPrincipal, findingId: string): Promise<FindingSummary> {
    const finding = await this.findingsRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      findingId
    });

    if (!finding) {
      throw new NotFoundException("Finding not found");
    }

    return toFindingSummary(finding);
  }

  async updateStatus(
    principal: AuthenticatedPrincipal,
    findingId: string,
    status: FindingStatus,
    metadata: RequestMetadata
  ): Promise<FindingSummary> {
    const updatedFinding = await this.findingsRepository.updateStatusForTenant({
      tenantId: principal.tenantId,
      findingId,
      status: mapSharedStatusToPrisma(status),
      resolvedAt: status === FindingStatus.Resolved ? new Date() : null
    });

    if (!updatedFinding) {
      throw new NotFoundException("Finding not found");
    }

    await this.auditLogService.record({
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      action: AuditActions.FindingStatusUpdate,
      targetType: "finding",
      targetId: findingId,
      metadata: {
        status
      },
      ...metadata
    });

    return toFindingSummary(updatedFinding);
  }
}

function toFindingSummary(finding: {
  id: string;
  tenantId: string;
  cloudAccountId: string | null;
  assetId: string | null;
  policyId: string | null;
  title: string;
  description: string;
  severity: PrismaFindingSeverity;
  status: PrismaFindingStatus;
  score: number;
  evidence: unknown;
  riskScore?: {
    factors: unknown;
    calculatedAt: Date;
  } | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): FindingSummary {
  return {
    id: finding.id,
    tenantId: finding.tenantId,
    cloudAccountId: finding.cloudAccountId,
    assetId: finding.assetId,
    policyId: finding.policyId,
    title: finding.title,
    description: finding.description,
    severity: mapPrismaSeverity(finding.severity),
    status: mapPrismaStatus(finding.status),
    score: finding.score,
    evidence: recordValue(finding.evidence),
    riskScore: finding.riskScore
      ? {
          factors: recordValue(finding.riskScore.factors),
          calculatedAt: finding.riskScore.calculatedAt.toISOString()
        }
      : null,
    firstSeenAt: finding.firstSeenAt.toISOString(),
    lastSeenAt: finding.lastSeenAt.toISOString(),
    resolvedAt: finding.resolvedAt?.toISOString() ?? null,
    createdAt: finding.createdAt.toISOString(),
    updatedAt: finding.updatedAt.toISOString()
  };
}

function mapSharedSeverityToPrisma(severity: FindingSeverity): PrismaFindingSeverity {
  switch (severity) {
    case FindingSeverity.Critical:
      return PrismaFindingSeverity.CRITICAL;
    case FindingSeverity.High:
      return PrismaFindingSeverity.HIGH;
    case FindingSeverity.Medium:
      return PrismaFindingSeverity.MEDIUM;
    case FindingSeverity.Low:
      return PrismaFindingSeverity.LOW;
    case FindingSeverity.Informational:
      return PrismaFindingSeverity.INFORMATIONAL;
    default:
      throw new BadRequestException("Unsupported finding severity");
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

function mapSharedStatusToPrisma(status: FindingStatus): PrismaFindingStatus {
  switch (status) {
    case FindingStatus.Open:
      return PrismaFindingStatus.OPEN;
    case FindingStatus.Triaged:
      return PrismaFindingStatus.TRIAGED;
    case FindingStatus.Resolved:
      return PrismaFindingStatus.RESOLVED;
    case FindingStatus.RiskAccepted:
      return PrismaFindingStatus.RISK_ACCEPTED;
    default:
      throw new BadRequestException("Unsupported finding status");
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
