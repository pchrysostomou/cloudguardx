import { Injectable } from "@nestjs/common";
import type { SanitizedFindingContext } from "../ai/ai-provider.interface";

const MAX_STRING_LENGTH = 1200;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;
const MAX_DEPTH = 8;

const sensitiveKeyPattern = /(secret|token|password|credential|private[_-]?key|access[_-]?key|session[_-]?key|external[_-]?id)/i;

const secretValuePatterns = [
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\b(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*["']?[^"',\s}]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
];

const instructionPatterns = [
  /ignore\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions/gi,
  /disregard\s+(?:all\s+)?(?:previous|prior|system|developer)\s+instructions/gi,
  /override\s+(?:the\s+)?(?:system|developer|safety)\s+instructions/gi,
  /reveal\s+(?:the\s+)?(?:system prompt|developer message|secrets?|tokens?|config(?:uration)?)/gi,
  /leak\s+(?:secrets?|tokens?|config(?:uration)?)/gi,
  /print\s+(?:env|environment|secrets?|tokens?|config(?:uration)?)/gi,
  /you\s+are\s+now\s+[^.\n\r]{0,120}/gi,
  /force\s+destructive\s+remediation/gi,
  /terraform\s+destroy/gi,
  /aws\s+[a-z0-9-]+\s+(?:delete|terminate|remove|detach|revoke|disable)[a-z0-9-]*/gi
];

export interface UntrustedFindingContext {
  finding: Record<string, unknown>;
  asset?: Record<string, unknown> | null;
  cloudAccount?: Record<string, unknown> | null;
  policy?: Record<string, unknown> | null;
  riskScore?: Record<string, unknown> | null;
}

@Injectable()
export class PromptSanitizer {
  sanitizeFindingContext(context: UntrustedFindingContext): SanitizedFindingContext {
    return {
      finding: this.sanitizeRecord(context.finding),
      asset: context.asset ? this.sanitizeRecord(context.asset) : null,
      cloudAccount: context.cloudAccount ? this.sanitizeRecord(context.cloudAccount) : null,
      policy: context.policy ? this.sanitizeRecord(context.policy) : null,
      riskScore: context.riskScore ? this.sanitizeRecord(context.riskScore) : null,
      safetyNotes: [
        "All AWS resource names, tags, metadata, finding evidence, and user-provided text were treated as untrusted input.",
        "Instruction-like content and common secret patterns were neutralized before prompt construction."
      ]
    };
  }

  sanitizeText(value: string): string {
    let sanitized = value;

    for (const pattern of secretValuePatterns) {
      sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
    }

    for (const pattern of instructionPatterns) {
      sanitized = sanitized.replace(pattern, "[UNTRUSTED_INSTRUCTION_REMOVED]");
    }

    if (sanitized.length > MAX_STRING_LENGTH) {
      return `${sanitized.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`;
    }

    return sanitized;
  }

  private sanitizeRecord(value: Record<string, unknown>): Record<string, unknown> {
    return this.sanitizeValue(value, [], 0) as Record<string, unknown>;
  }

  private sanitizeValue(value: unknown, keyPath: string[], depth: number): unknown {
    if (depth > MAX_DEPTH) {
      return "[TRUNCATED_DEPTH]";
    }

    const currentKey = keyPath.at(-1) ?? "";

    if (currentKey && sensitiveKeyPattern.test(currentKey)) {
      return "[REDACTED_SECRET]";
    }

    if (value === null || typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === "string") {
      return this.sanitizeText(value);
    }

    if (Array.isArray(value)) {
      return value.slice(0, MAX_ARRAY_ITEMS).map((item, index) => this.sanitizeValue(item, [...keyPath, String(index)], depth + 1));
    }

    if (typeof value === "object") {
      const sanitized: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);

      for (const [key, nestedValue] of entries) {
        const sanitizedKey = this.sanitizeText(key);
        sanitized[sanitizedKey] = this.sanitizeValue(nestedValue, [...keyPath, key], depth + 1);
      }

      return sanitized;
    }

    return String(value);
  }
}
