import type { AssetSummary, FindingSeverity, FindingStatus, FindingSummary } from "@cloudguardx/shared-types";

export type AppView = "overview" | "assets" | "findings" | "finding" | "cloud-accounts";

export interface AppRoute {
  view: AppView;
  findingId?: string;
}

export interface CloudAccountSummary {
  id: string;
  tenantId: string;
  provider: string;
  name: string;
  externalAccountId: string;
  status: string;
  lastSuccessfulScanAt: string | null;
  lastScanError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FindingFilters {
  severity?: FindingSeverity;
  status?: FindingStatus;
}

export interface PostureData {
  assets: AssetSummary[];
  findings: FindingSummary[];
  cloudAccounts: CloudAccountSummary[];
}

export interface ActivityEntry {
  id: string;
  status: FindingStatus;
  timestamp: string;
  label: string;
}

export interface ConnectAccountFormData {
  name: string;
  externalAccountId: string;
  roleArn: string;
  externalId: string;
}

// Re-export for convenience so App.tsx has one import source
export type { AssetSummary, FindingSeverity, FindingStatus, FindingSummary };
