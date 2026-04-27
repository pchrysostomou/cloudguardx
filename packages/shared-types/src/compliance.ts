import type { FindingSeverity, FindingStatus } from "./findings";

export interface ComplianceFrameworkSummary {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string | null;
}

export interface ComplianceMappingSummary {
  id: string;
  controlId: string;
  policyId: string | null;
  findingId: string | null;
  findingTitle: string | null;
  findingSeverity: FindingSeverity | null;
  findingStatus: FindingStatus | null;
  rationale: string;
  createdAt: string;
}

export interface ComplianceControlSummary {
  id: string;
  key: string;
  title: string;
  description: string;
  framework: ComplianceFrameworkSummary;
  mappedFindingCount: number;
  openFindingCount: number;
  mappings: ComplianceMappingSummary[];
}
