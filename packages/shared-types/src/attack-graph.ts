export enum AttackGraphNodeKind {
  Resource = "resource",
  Identity = "identity"
}

export enum AttackGraphEdgeKind {
  Permission = "permission",
  NetworkExposure = "network_exposure",
  CredentialExposure = "credential_exposure",
  DataAccess = "data_access"
}

export interface AttackGraphNodeSummary {
  id: string;
  tenantId: string;
  assetId: string | null;
  kind: AttackGraphNodeKind;
  externalId: string;
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AttackGraphEdgeSummary {
  id: string;
  tenantId: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: AttackGraphEdgeKind;
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface AttackGraphSummary {
  nodes: AttackGraphNodeSummary[];
  edges: AttackGraphEdgeSummary[];
}
