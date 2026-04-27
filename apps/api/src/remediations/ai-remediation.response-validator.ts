import { Injectable } from "@nestjs/common";
import type { AICommandSuggestion, AIProviderRemediationResponse, ConfidenceLevel } from "../ai/ai-provider.interface";
import { PromptSanitizer } from "./ai-remediation.prompt-sanitizer";

export interface ValidatedCommandSuggestion {
  command: string;
  purpose: string;
  manualReviewRequired: true;
  destructive: boolean;
  warning?: string;
}

export interface ValidatedAiRemediation {
  plainEnglishExplanation: string;
  riskExplanation: string;
  attackerImpact: string;
  awsCliGuidance: ValidatedCommandSuggestion[];
  terraformGuidance: string;
  confidence: ConfidenceLevel;
  safetyWarnings: string[];
  isDestructive: boolean;
}

const destructiveCommandPatterns = [
  /\baws\s+[a-z0-9-]+\s+delete-[a-z0-9-]+/i,
  /\baws\s+[a-z0-9-]+\s+terminate-[a-z0-9-]+/i,
  /\baws\s+[a-z0-9-]+\s+remove-[a-z0-9-]+/i,
  /\baws\s+[a-z0-9-]+\s+detach-[a-z0-9-]+/i,
  /\baws\s+[a-z0-9-]+\s+revoke-[a-z0-9-]+/i,
  /\baws\s+[a-z0-9-]+\s+disable-[a-z0-9-]+/i,
  /\bterraform\s+destroy\b/i,
  /\bterraform\s+apply\s+-destroy\b/i,
  /\bforce-destroy\b/i
];

@Injectable()
export class AiRemediationResponseValidator {
  constructor(private readonly promptSanitizer: PromptSanitizer) {}

  validate(response: AIProviderRemediationResponse): ValidatedAiRemediation {
    const awsCliGuidance = response.awsCliGuidance.map((suggestion) => this.validateCommandSuggestion(suggestion));
    const rawTerraformIsDestructive = this.containsDestructiveCommand(response.terraformGuidance);
    const terraformGuidance = this.ensureManualReview(this.promptSanitizer.sanitizeText(response.terraformGuidance));
    const terraformIsDestructive = rawTerraformIsDestructive || this.containsDestructiveCommand(terraformGuidance);
    const commandsAreDestructive = awsCliGuidance.some((suggestion) => suggestion.destructive);
    const isDestructive = response.isDestructive || terraformIsDestructive || commandsAreDestructive;
    const safetyWarnings = this.normalizeWarnings(response.safetyWarnings, isDestructive || terraformIsDestructive);

    return {
      plainEnglishExplanation: this.promptSanitizer.sanitizeText(response.plainEnglishExplanation),
      riskExplanation: this.promptSanitizer.sanitizeText(response.riskExplanation),
      attackerImpact: this.promptSanitizer.sanitizeText(response.attackerImpact),
      awsCliGuidance,
      terraformGuidance: terraformIsDestructive ? this.withDestructiveWarning(terraformGuidance) : terraformGuidance,
      confidence: this.normalizeConfidence(response.confidence),
      safetyWarnings,
      isDestructive
    };
  }

  private validateCommandSuggestion(suggestion: AICommandSuggestion): ValidatedCommandSuggestion {
    const rawCommandIsDestructive = this.containsDestructiveCommand(suggestion.command);
    const command = this.ensureManualReview(this.promptSanitizer.sanitizeText(suggestion.command));
    const purpose = this.promptSanitizer.sanitizeText(suggestion.purpose);
    const warning = suggestion.warning ? this.promptSanitizer.sanitizeText(suggestion.warning) : undefined;
    const destructive = suggestion.destructive === true || rawCommandIsDestructive || this.containsDestructiveCommand(command);

    return {
      command,
      purpose,
      manualReviewRequired: true,
      destructive,
      warning: destructive
        ? warning ?? "DESTRUCTIVE ACTION WARNING: This command can remove, disable, revoke, detach, or destroy access/resources. Use only after explicit approval."
        : warning
    };
  }

  private normalizeWarnings(warnings: string[], destructive: boolean): string[] {
    const normalized = warnings.map((warning) => this.promptSanitizer.sanitizeText(warning)).filter((warning) => warning.trim().length > 0);
    normalized.unshift("MANUAL REVIEW REQUIRED: Guidance is advisory and must be reviewed before use.");
    normalized.push("CloudGuardX did not execute commands, call AWS APIs for remediation, or apply Terraform.");

    if (destructive && !normalized.some((warning) => warning.toLowerCase().includes("destructive action warning"))) {
      normalized.unshift("DESTRUCTIVE ACTION WARNING: Review destructive or access-removing suggestions with extra approval before use.");
    }

    return [...new Set(normalized)];
  }

  private normalizeConfidence(confidence: ConfidenceLevel): ConfidenceLevel {
    return confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : "low";
  }

  private ensureManualReview(value: string): string {
    return value.toUpperCase().includes("MANUAL REVIEW REQUIRED") ? value : `MANUAL REVIEW REQUIRED: ${value}`;
  }

  private withDestructiveWarning(value: string): string {
    return value.toLowerCase().includes("destructive action warning")
      ? value
      : `DESTRUCTIVE ACTION WARNING: Review destructive guidance with extra approval before use.\n${value}`;
  }

  private containsDestructiveCommand(value: string): boolean {
    return destructiveCommandPatterns.some((pattern) => pattern.test(value));
  }
}
