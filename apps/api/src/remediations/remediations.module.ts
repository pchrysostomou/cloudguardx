import { Module } from "@nestjs/common";
import { AI_PROVIDER } from "../ai/ai-provider.interface";
import { MockAIProvider } from "../ai/mock-ai.provider";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AiRemediationController } from "./ai-remediation.controller";
import { AiRemediationPromptBuilder } from "./ai-remediation.prompt-builder";
import { PromptSanitizer } from "./ai-remediation.prompt-sanitizer";
import { AiRemediationRateLimitService } from "./ai-remediation.rate-limit";
import { AiRemediationResponseValidator } from "./ai-remediation.response-validator";
import { AiRemediationService } from "./ai-remediation.service";
import { RemediationsRepository } from "./repositories/remediations.repository";
import { RemediationsController } from "./remediations.controller";
import { RemediationsService } from "./remediations.service";

@Module({
  imports: [AuditLogModule],
  controllers: [RemediationsController, AiRemediationController],
  providers: [
    RemediationsService,
    AiRemediationService,
    RemediationsRepository,
    PromptSanitizer,
    AiRemediationPromptBuilder,
    AiRemediationResponseValidator,
    AiRemediationRateLimitService,
    {
      provide: AI_PROVIDER,
      useClass: MockAIProvider
    }
  ],
  exports: [RemediationsService, AiRemediationService, RemediationsRepository]
})
export class RemediationsModule {}
