import { Injectable, NotFoundException } from "@nestjs/common";
import { FindingSeverity as PrismaFindingSeverity } from "@prisma/client";
import { FindingSeverity } from "@cloudguardx/shared-types";
import type { AuthenticatedPrincipal, PolicySummary } from "@cloudguardx/shared-types";
import { PoliciesRepository } from "./repositories/policies.repository";

@Injectable()
export class PoliciesService {
  constructor(private readonly policiesRepository: PoliciesRepository) {}

  async listForTenant(principal: AuthenticatedPrincipal): Promise<PolicySummary[]> {
    const policies = await this.policiesRepository.listForTenant(principal.tenantId);

    return policies.map(toPolicySummary);
  }

  async getForTenant(principal: AuthenticatedPrincipal, policyId: string): Promise<PolicySummary> {
    const policy = await this.policiesRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      policyId
    });

    if (!policy) {
      throw new NotFoundException("Policy not found");
    }

    return toPolicySummary(policy);
  }
}

function toPolicySummary(policy: {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description: string;
  severity: PrismaFindingSeverity;
  enabled: boolean;
  implementation: string;
  parameters: unknown;
  createdAt: Date;
  updatedAt: Date;
}): PolicySummary {
  return {
    id: policy.id,
    tenantId: policy.tenantId,
    key: policy.key,
    name: policy.name,
    description: policy.description,
    severity: mapPrismaSeverity(policy.severity),
    enabled: policy.enabled,
    implementation: policy.implementation,
    parameters: recordOrNull(policy.parameters),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString()
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

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
