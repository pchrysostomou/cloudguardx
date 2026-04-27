import { MockAIProvider } from "./mock-ai.provider";

describe("MockAIProvider", () => {
  it("generates deterministic remediation guidance without an external API key", async () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const provider = new MockAIProvider();
    const result = await provider.generateRemediation({
      prompt: {
        safetyPolicyVersion: "test",
        system: "system",
        user: "user",
        sanitizedContext: {
          finding: {
            title: "S3 bucket allows public access",
            severity: "high"
          },
          asset: {
            assetType: "AWS_S3_BUCKET"
          },
          cloudAccount: null,
          policy: null,
          riskScore: null,
          safetyNotes: []
        }
      }
    });

    expect(result.confidence).toBe("medium");
    expect(result.awsCliGuidance[0].command).toContain("MANUAL REVIEW REQUIRED");
    expect(result.safetyWarnings.join(" ")).toContain("did not execute commands");

    if (previousApiKey) {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
  });
});
