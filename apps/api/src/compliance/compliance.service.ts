import { Injectable } from "@nestjs/common";
import {
  FindingSeverity as PrismaFindingSeverity,
  FindingStatus as PrismaFindingStatus
} from "@prisma/client";
import { FindingSeverity, FindingStatus } from "@cloudguardx/shared-types";
import type {
  AuthenticatedPrincipal,
  ComplianceControlSummary,
  ComplianceMappingSummary
} from "@cloudguardx/shared-types";
import { ComplianceRepository } from "./repositories/compliance.repository";

@Injectable()
export class ComplianceService {
  constructor(private readonly complianceRepository: ComplianceRepository) {}

  async listControls(principal: AuthenticatedPrincipal): Promise<ComplianceControlSummary[]> {
    await this.complianceRepository.ensureDefaultControls();
    const controls = await this.complianceRepository.listControlsForTenant(principal.tenantId);

    return controls.map((control) => {
      const mappings = control.mappings.map(toMappingSummary);

      return {
        id: control.id,
        key: control.key,
        title: control.title,
        description: control.description,
        framework: {
          id: control.framework.id,
          key: control.framework.key,
          name: control.framework.name,
          version: control.framework.version,
          description: control.framework.description
        },
        mappedFindingCount: mappings.filter((mapping) => mapping.findingId).length,
        openFindingCount: mappings.filter((mapping) => mapping.findingStatus && mapping.findingStatus !== FindingStatus.Resolved).length,
        mappings
      };
    });
  }

  async listFindingMappings(
    principal: AuthenticatedPrincipal,
    findingId: string
  ): Promise<ComplianceMappingSummary[]> {
    const mappings = await this.complianceRepository.listMappingsForFinding({
      tenantId: principal.tenantId,
      findingId
    });

    return mappings.map((mapping) =>
      toMappingSummary({
        ...mapping,
        controlId: mapping.controlId
      })
    );
  }
}

function toMappingSummary(mapping: {
  id: string;
  controlId: string;
  policyId: string | null;
  findingId: string | null;
  rationale: string;
  createdAt: Date;
  finding?: {
    title: string;
    severity: PrismaFindingSeverity;
    status: PrismaFindingStatus;
  } | null;
}): ComplianceMappingSummary {
  return {
    id: mapping.id,
    controlId: mapping.controlId,
    policyId: mapping.policyId,
    findingId: mapping.findingId,
    findingTitle: mapping.finding?.title ?? null,
    findingSeverity: mapping.finding ? mapPrismaSeverity(mapping.finding.severity) : null,
    findingStatus: mapping.finding ? mapPrismaStatus(mapping.finding.status) : null,
    rationale: mapping.rationale,
    createdAt: mapping.createdAt.toISOString()
  };
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
