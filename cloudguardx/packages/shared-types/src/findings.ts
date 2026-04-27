export enum FindingSeverity {
  Critical = "critical",
  High = "high",
  Medium = "medium",
  Low = "low",
  Informational = "informational"
}

export enum FindingStatus {
  Open = "open",
  Triaged = "triaged",
  Resolved = "resolved",
  RiskAccepted = "risk_accepted"
}

export interface FindingSummary {
  id: string;
  tenantId: string;
  cloudAccountId: string | null;
  assetId: string | null;
  policyId: string | null;
  title: string;
  description?: string;
  severity: FindingSeverity;
  status: FindingStatus;
  score: number;
  evidence?: Record<string, unknown>;
  riskScore?: {
    factors: Record<string, unknown>;
    calculatedAt: string;
  } | null;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolicySummary {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description: string;
  severity: FindingSeverity;
  enabled: boolean;
  implementation: string;
  parameters: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
