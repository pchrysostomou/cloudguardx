import { FindingSeverity } from "./findings";

export interface RiskScoreFactors {
  internetExposure: number;
  privilegeLevel: number;
  exploitability: number;
  blastRadius: number;
  assetSensitivity: number;
  knownCves: number;
  tenantCriticality: number;
  complianceImpact: number;
  credentialExposure: number;
}

export interface RiskScoreResult {
  score: number;
  severity: FindingSeverity;
  factors: RiskScoreFactors;
}

export type PartialRiskScoreFactors = Partial<RiskScoreFactors>;

export const severityScoreBands: ReadonlyArray<{
  severity: FindingSeverity;
  minInclusive: number;
  maxInclusive: number;
}> = [
  { severity: FindingSeverity.Critical, minInclusive: 90, maxInclusive: 100 },
  { severity: FindingSeverity.High, minInclusive: 70, maxInclusive: 89 },
  { severity: FindingSeverity.Medium, minInclusive: 40, maxInclusive: 69 },
  { severity: FindingSeverity.Low, minInclusive: 10, maxInclusive: 39 },
  { severity: FindingSeverity.Informational, minInclusive: 0, maxInclusive: 9 }
];
