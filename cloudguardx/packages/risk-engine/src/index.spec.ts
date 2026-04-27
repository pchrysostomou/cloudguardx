import { describe, expect, it } from "vitest";
import { FindingSeverity } from "@cloudguardx/shared-types";
import { calculateRiskScore, normalizeRiskScoreFactors, severityForScore } from "./index";

describe("risk engine", () => {
  it("calculates deterministic weighted scores from normalized factors", () => {
    const result = calculateRiskScore({
      tenantId: "tenant-1",
      findingId: "finding-1",
      factors: {
        internetExposure: 10,
        privilegeLevel: 8,
        exploitability: 6,
        blastRadius: 5,
        assetSensitivity: 4,
        knownCves: 0,
        tenantCriticality: 7,
        complianceImpact: 6,
        credentialExposure: 0
      }
    });

    expect(result.score).toBe(60);
    expect(result.severity).toBe(FindingSeverity.Medium);
    expect(result.factors.internetExposure).toBe(10);
  });

  it("clamps invalid factors into the supported 0 to 10 range", () => {
    expect(
      normalizeRiskScoreFactors({
        internetExposure: 20,
        privilegeLevel: -1,
        exploitability: Number.NaN
      })
    ).toEqual(
      expect.objectContaining({
        internetExposure: 10,
        privilegeLevel: 0,
        exploitability: 0
      })
    );
  });

  it("maps score bands to severities", () => {
    expect(severityForScore(95)).toBe(FindingSeverity.Critical);
    expect(severityForScore(80)).toBe(FindingSeverity.High);
    expect(severityForScore(50)).toBe(FindingSeverity.Medium);
    expect(severityForScore(20)).toBe(FindingSeverity.Low);
    expect(severityForScore(5)).toBe(FindingSeverity.Informational);
  });
});
