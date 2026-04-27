import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedPrincipal, RemediationSummary } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AI_PROVIDER, type AIProvider } from "../ai/ai-provider.interface";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { AiRemediationPromptBuilder } from "./ai-remediation.prompt-builder";
import { AiRemediationRateLimitService } from "./ai-remediation.rate-limit";
import { AiRemediationResponseValidator, type ValidatedAiRemediation } from "./ai-remediation.response-validator";
import { RemediationsRepository } from "./repositories/remediations.repository";
import { toRemediationSummary } from "./remediations.service";

@Injectable()
export class AiRemediationService {
  constructor(
    private readonly remediationsRepository: RemediationsRepository,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
    private readonly promptBuilder: AiRemediationPromptBuilder,
    private readonly responseValidator: AiRemediationResponseValidator,
    private readonly rateLimitService: AiRemediationRateLimitService,
    private readonly auditLogService: AuditLogService
  ) {}

  async generateForFinding(
    principal: AuthenticatedPrincipal,
    findingId: string,
    metadata: RequestMetadata
  ): Promise<RemediationSummary> {
    const rateLimitDecision = await this.rateLimitService.assertAllowed(principal);
    const findingContext = await this.remediationsRepository.findFindingContextByIdForTenant({
      tenantId: principal.tenantId,
      findingId
    });

    if (!findingContext) {
      throw new NotFoundException("Finding not found");
    }

    const prompt = this.promptBuilder.build({
      finding: {
        id: findingContext.id,
        title: findingContext.title,
        description: findingContext.description,
        severity: findingContext.severity,
        status: findingContext.status,
        score: findingContext.score,
        evidence: findingContext.evidence,
        firstSeenAt: findingContext.firstSeenAt,
        lastSeenAt: findingContext.lastSeenAt
      },
      asset: findingContext.asset,
      cloudAccount: findingContext.cloudAccount,
      policy: findingContext.policy,
      riskScore: findingContext.riskScore
    });

    const providerResponse = await this.aiProvider.generateRemediation({ prompt });
    const validated = this.responseValidator.validate(providerResponse);
    const remediation = await this.remediationsRepository.createAiGuidance({
      tenantId: principal.tenantId,
      findingId: findingContext.id,
      guidanceMarkdown: this.renderGuidanceMarkdown(validated),
      terraformPatch: validated.terraformGuidance,
      awsCliCommands: {
        commands: validated.awsCliGuidance,
        confidence: validated.confidence,
        safetyWarnings: validated.safetyWarnings,
        provider: this.aiProvider.name,
        safetyPolicyVersion: prompt.safetyPolicyVersion
      },
      isDestructive: validated.isDestructive,
      createdByUserId: principal.userId
    });

    await this.auditLogService.record({
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      action: AuditActions.AiRemediationGenerate,
      targetType: "remediation",
      targetId: remediation.id,
      metadata: {
        findingId: findingContext.id,
        provider: this.aiProvider.name,
        confidence: validated.confidence,
        isDestructive: validated.isDestructive,
        safetyPolicyVersion: prompt.safetyPolicyVersion,
        rateLimitPolicy: rateLimitDecision.policy
      },
      ...metadata
    });

    return toRemediationSummary(remediation);
  }

  private renderGuidanceMarkdown(remediation: ValidatedAiRemediation): string {
    const awsCliGuidance = remediation.awsCliGuidance
      .map((suggestion) =>
        [
          `- \`${suggestion.command}\``,
          `  Purpose: ${suggestion.purpose}`,
          suggestion.warning ? `  Warning: ${suggestion.warning}` : null
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n");

    return [
      "# AI remediation guidance",
      "",
      "MANUAL REVIEW REQUIRED: This guidance is advisory only. CloudGuardX did not execute commands, call AWS APIs for remediation, or apply Terraform.",
      "",
      "## Plain English explanation",
      remediation.plainEnglishExplanation,
      "",
      "## Risk",
      remediation.riskExplanation,
      "",
      "## Possible attacker impact",
      remediation.attackerImpact,
      "",
      "## Safe manual AWS CLI guidance",
      awsCliGuidance,
      "",
      "## Safe manual Terraform guidance",
      remediation.terraformGuidance,
      "",
      "## Confidence",
      remediation.confidence,
      "",
      "## Safety warnings",
      remediation.safetyWarnings.map((warning) => `- ${warning}`).join("\n")
    ].join("\n");
  }
}
