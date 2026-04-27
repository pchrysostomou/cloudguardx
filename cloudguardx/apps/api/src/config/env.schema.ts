import { z } from "zod";

const postgresUrlPattern = /^postgres(ql)?:\/\/.+/;
const redisUrlPattern = /^redis(s)?:\/\/.+/;

function isBase64EncodedBytes(value: string, expectedByteLength: number): boolean {
  try {
    return Buffer.from(value, "base64").length === expectedByteLength;
  } catch {
    return false;
  }
}

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  WEB_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().regex(postgresUrlPattern, "DATABASE_URL must be a PostgreSQL URL"),
  REDIS_URL: z.string().regex(redisUrlPattern, "REDIS_URL must be a Redis URL"),
  JWT_ACCESS_TOKEN_SECRET: z.string().min(32),
  JWT_REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  FIELD_ENCRYPTION_KEY_BASE64: z
    .string()
    .refine((value) => isBase64EncodedBytes(value, 32), "FIELD_ENCRYPTION_KEY_BASE64 must decode to 32 bytes"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_STS_ENDPOINT: z.string().optional(),
  LOCALSTACK_ENDPOINT: z.string().url().optional()
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const parsed = environmentSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.errors
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}
