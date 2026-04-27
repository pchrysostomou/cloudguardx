import type { AssetSummary, FindingSeverity, FindingStatus, FindingSummary } from "@cloudguardx/shared-types";

export type AppView = "overview" | "assets" | "findings" | "finding";

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
