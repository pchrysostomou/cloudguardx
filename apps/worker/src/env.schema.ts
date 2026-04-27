import { z } from "zod";

export const workerEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/),
  REDIS_URL: z.string().regex(/^redis(s)?:\/\/.+/),
  AWS_REGION: z.string().default("us-east-1"),
  LOCALSTACK_ENDPOINT: z.string().url().optional(),
  WORKER_ID: z.string().min(1).default("cloudguardx-worker-local"),
  SCANNER_WORKER_POLL_ENABLED: z.coerce.boolean().default(true),
  SCANNER_WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).default(5_000)
});

export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function validateWorkerEnvironment(config: Record<string, unknown>): WorkerEnvironment {
  const parsed = workerEnvironmentSchema.safeParse(config);

  if (!parsed.success) {
    const details = parsed.error.errors
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid worker environment configuration: ${details}`);
  }

  return parsed.data;
}
