import type { FindingSeverity, FindingStatus } from "./findings";

export enum RemediationSource {
  Human = "human",
  Ai = "ai"
}

export interface RemediationSummary {
  id: string;
  tenantId: string;
  findingId: string;
  findingTitle: string;
  findingSeverity: FindingSeverity;
  findingStatus: FindingStatus;
  source: RemediationSource;
  guidanceMarkdown: string;
  terraformPatch: string | null;
  awsCliCommands: Record<string, unknown> | null;
  isDestructive: boolean;
  createdByUserId: string | null;
  createdAt: string;
}
