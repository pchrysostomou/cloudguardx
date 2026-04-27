export const AI_PROVIDER = Symbol("AI_PROVIDER");

export type ConfidenceLevel = "low" | "medium" | "high";

export interface SanitizedFindingContext {
  finding: Record<string, unknown>;
  asset: Record<string, unknown> | null;
  cloudAccount: Record<string, unknown> | null;
  policy: Record<string, unknown> | null;
  riskScore: Record<string, unknown> | null;
  safetyNotes: string[];
}

export interface RemediationPrompt {
  safetyPolicyVersion: string;
  system: string;
  user: string;
  sanitizedContext: SanitizedFindingContext;
}

export interface AIProviderRequest {
  prompt: RemediationPrompt;
}

export interface AICommandSuggestion {
  command: string;
  purpose: string;
  manualReviewRequired?: boolean;
  destructive?: boolean;
  warning?: string;
}

export interface AIProviderRemediationResponse {
  plainEnglishExplanation: string;
  riskExplanation: string;
  attackerImpact: string;
  awsCliGuidance: AICommandSuggestion[];
  terraformGuidance: string;
  confidence: ConfidenceLevel;
  safetyWarnings: string[];
  isDestructive: boolean;
}

export interface AIProvider {
  readonly name: string;

  generateRemediation(request: AIProviderRequest): Promise<AIProviderRemediationResponse>;
}
