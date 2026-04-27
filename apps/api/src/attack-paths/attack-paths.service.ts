import { Injectable } from "@nestjs/common";
import {
  AttackGraphEdgeKind as PrismaAttackGraphEdgeKind,
  AttackGraphNodeKind as PrismaAttackGraphNodeKind
} from "@prisma/client";
import { AttackGraphEdgeKind, AttackGraphNodeKind } from "@cloudguardx/shared-types";
import type {
  AttackGraphEdgeSummary,
  AttackGraphNodeSummary,
  AttackGraphSummary,
  AuthenticatedPrincipal
} from "@cloudguardx/shared-types";
import { AttackPathsRepository } from "./repositories/attack-paths.repository";

@Injectable()
export class AttackPathsService {
  constructor(private readonly attackPathsRepository: AttackPathsRepository) {}

  async getGraph(principal: AuthenticatedPrincipal): Promise<AttackGraphSummary> {
    const graph = await this.attackPathsRepository.getGraphForTenant(principal.tenantId);

    return {
      nodes: graph.nodes.map(toNodeSummary),
      edges: graph.edges.map(toEdgeSummary)
    };
  }
}

function toNodeSummary(node: {
  id: string;
  tenantId: string;
  assetId: string | null;
  kind: PrismaAttackGraphNodeKind;
  externalId: string;
  label: string;
  properties: unknown;
  createdAt: Date;
  updatedAt: Date;
}): AttackGraphNodeSummary {
  return {
    id: node.id,
    tenantId: node.tenantId,
    assetId: node.assetId,
    kind: mapNodeKind(node.kind),
    externalId: node.externalId,
    label: node.label,
    properties: recordValue(node.properties),
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString()
  };
}

function toEdgeSummary(edge: {
  id: string;
  tenantId: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: PrismaAttackGraphEdgeKind;
  label: string;
  properties: unknown;
  createdAt: Date;
}): AttackGraphEdgeSummary {
  return {
    id: edge.id,
    tenantId: edge.tenantId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    kind: mapEdgeKind(edge.kind),
    label: edge.label,
    properties: recordValue(edge.properties),
    createdAt: edge.createdAt.toISOString()
  };
}

function mapNodeKind(kind: PrismaAttackGraphNodeKind): AttackGraphNodeKind {
  switch (kind) {
    case PrismaAttackGraphNodeKind.RESOURCE:
      return AttackGraphNodeKind.Resource;
    case PrismaAttackGraphNodeKind.IDENTITY:
      return AttackGraphNodeKind.Identity;
    default:
      throw new Error(`Unsupported attack graph node kind: ${kind satisfies never}`);
  }
}

function mapEdgeKind(kind: PrismaAttackGraphEdgeKind): AttackGraphEdgeKind {
  switch (kind) {
    case PrismaAttackGraphEdgeKind.PERMISSION:
      return AttackGraphEdgeKind.Permission;
    case PrismaAttackGraphEdgeKind.NETWORK_EXPOSURE:
      return AttackGraphEdgeKind.NetworkExposure;
    case PrismaAttackGraphEdgeKind.CREDENTIAL_EXPOSURE:
      return AttackGraphEdgeKind.CredentialExposure;
    case PrismaAttackGraphEdgeKind.DATA_ACCESS:
      return AttackGraphEdgeKind.DataAccess;
    default:
      throw new Error(`Unsupported attack graph edge kind: ${kind satisfies never}`);
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
