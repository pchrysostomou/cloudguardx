import type { AIProviderRemediationResponse } from "../ai/ai-provider.interface";
import { PromptSanitizer } from "./ai-remediation.prompt-sanitizer";
import { AiRemediationResponseValidator } from "./ai-remediation.response-validator";

describe("AiRemediationResponseValidator", () => {
  it("marks all generated commands as manual review required", () => {
    const validator = new AiRemediationResponseValidator(new PromptSanitizer());

    const result = validator.validate({
      plainEnglishExplanation: "Plain explanation",
      riskExplanation: "Risk explanation",
      attackerImpact: "Attacker impact",
      awsCliGuidance: [
        {
          command: "aws s3api get-public-access-block --bucket <bucket>",
          purpose: "Inspect settings"
        }
      ],
      terraformGuidance: "resource example only",
      confidence: "medium",
      safetyWarnings: [],
      isDestructive: false
    });

    expect(result.awsCliGuidance[0].command).toMatch(/^MANUAL REVIEW REQUIRED:/);
    expect(result.terraformGuidance).toMatch(/^MANUAL REVIEW REQUIRED:/);
    expect(result.safetyWarnings).toEqual(expect.arrayContaining([expect.stringContaining("did not execute commands")]));
  });

  it("blocks or clearly warns on destructive command suggestions", () => {
    const validator = new AiRemediationResponseValidator(new PromptSanitizer());
    const response: AIProviderRemediationResponse = {
      plainEnglishExplanation: "Plain explanation",
      riskExplanation: "Risk explanation",
      attackerImpact: "Attacker impact",
      awsCliGuidance: [
        {
          command: "aws s3api delete-bucket --bucket production",
          purpose: "Remove bucket"
        }
      ],
      terraformGuidance: "terraform destroy",
      confidence: "low",
      safetyWarnings: [],
      isDestructive: false
    };

    const result = validator.validate(response);
    const serialized = JSON.stringify(result).toLowerCase();

    expect(result.isDestructive).toBe(true);
    expect(result.awsCliGuidance[0].destructive).toBe(true);
    expect(serialized).toContain("destructive action warning");
    expect(result.awsCliGuidance[0].command).not.toContain("delete-bucket");
    expect(result.terraformGuidance).not.toContain("terraform destroy");
  });
});
