import type { RiskScoreFactors, RiskScoreResult } from "@cloudguardx/shared-types";
import { FindingSeverity, severityScoreBands } from "@cloudguardx/shared-types";

export interface RiskScoringInput {
  tenantId: string;
  findingId: string;
  factors: Partial<RiskScoreFactors>;
}

export type RiskScoringOutput = RiskScoreResult;

const factorWeights: RiskScoreFactors = {
  internetExposure: 20,
  privilegeLevel: 15,
  exploitability: 15,
  blastRadius: 10,
  assetSensitivity: 10,
  knownCves: 10,
  tenantCriticality: 10,
  complianceImpact: 5,
  credentialExposure: 5
};

export const zeroRiskScoreFactors: RiskScoreFactors = {
  internetExposure: 0,
  privilegeLevel: 0,
  exploitability: 0,
  blastRadius: 0,
  assetSensitivity: 0,
  knownCves: 0,
  tenantCriticality: 0,
  complianceImpact: 0,
  credentialExposure: 0
};

export function normalizeRiskScoreFactors(input: Partial<RiskScoreFactors>): RiskScoreFactors {
  return {
    internetExposure: normalizeFactor(input.internetExposure),
    privilegeLevel: normalizeFactor(input.privilegeLevel),
    exploitability: normalizeFactor(input.exploitability),
    blastRadius: normalizeFactor(input.blastRadius),
    assetSensitivity: normalizeFactor(input.assetSensitivity),
    knownCves: normalizeFactor(input.knownCves),
    tenantCriticality: normalizeFactor(input.tenantCriticality),
    complianceImpact: normalizeFactor(input.complianceImpact),
    credentialExposure: normalizeFactor(input.credentialExposure)
  };
}

export function calculateRiskScore(input: RiskScoringInput): RiskScoringOutput {
  const factors = normalizeRiskScoreFactors(input.factors);
  const weightedScore = Object.entries(factors).reduce((score, [factor, value]) => {
    const weight = factorWeights[factor as keyof RiskScoreFactors];

    return score + (value / 10) * weight;
  }, 0);
  const score = Math.round(Math.min(Math.max(weightedScore, 0), 100) * 10) / 10;

  return {
    score,
    severity: severityForScore(score),
    factors
  };
}

export function severityForScore(score: number): FindingSeverity {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const band = severityScoreBands.find(
    (candidate) => normalizedScore >= candidate.minInclusive && normalizedScore <= candidate.maxInclusive
  );

  return band?.severity ?? FindingSeverity.Informational;
}

function normalizeFactor(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 10);
}
