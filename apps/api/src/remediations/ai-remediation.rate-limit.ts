import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";

export interface AiRemediationRateLimitDecision {
  allowed: true;
  policy: "placeholder";
  subject: string;
}

@Injectable()
export class AiRemediationRateLimitService {
  async assertAllowed(principal: AuthenticatedPrincipal): Promise<AiRemediationRateLimitDecision> {
    return {
      allowed: true,
      policy: "placeholder",
      subject: `${principal.tenantId}:${principal.userId}`
    };
  }
}
