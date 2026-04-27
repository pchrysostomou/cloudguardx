import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { CloudProvider } from "@cloudguardx/shared-types";
import type { AwsReadOnlyScanner } from "@cloudguardx/aws-connectors";
import type { WorkerEnvironment } from "./env.schema";
import { AWS_SCANNER } from "./scanner/aws-scanner.provider";
import { ScannerWorkerRepository } from "./scanner/scanner-worker.repository";
import type { ClaimedScanJob } from "./scanner/scanner-worker.repository";

export interface WorkerRuntimeState {
  service: "scanner-worker";
  scannerRuntime: "idle" | "processing";
  workerId: string;
  pollIntervalMs: number;
  lastClaimedJobId: string | null;
}

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private processing = false;
  private lastClaimedJobId: string | null = null;

  constructor(
    private readonly scannerWorkerRepository: ScannerWorkerRepository,
    @Inject(AWS_SCANNER) private readonly awsScanner: AwsReadOnlyScanner,
    private readonly configService: ConfigService<WorkerEnvironment, true>
  ) {}

  onModuleInit(): void {
    const pollEnabled = this.configService.get("SCANNER_WORKER_POLL_ENABLED", { infer: true });

    if (!pollEnabled) {
      this.logger.log("Scanner worker polling is disabled");
      return;
    }

    const pollIntervalMs = this.pollIntervalMs();
    this.pollTimer = setInterval(() => {
      void this.processNextJob();
    }, pollIntervalMs);
    this.pollTimer.unref();
    this.logger.log(`Scanner worker polling every ${pollIntervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async processNextJob(): Promise<ClaimedScanJob | null> {
    if (this.processing) {
      return null;
    }

    this.processing = true;

    try {
      const job = await this.scannerWorkerRepository.claimNextJob(this.workerId());

      if (!job) {
        return null;
      }

      this.lastClaimedJobId = job.id;
      await this.runClaimedJob(job);

      return job;
    } finally {
      this.processing = false;
    }
  }

  getRuntimeState(): WorkerRuntimeState {
    return {
      service: "scanner-worker",
      scannerRuntime: this.processing ? "processing" : "idle",
      workerId: this.workerId(),
      pollIntervalMs: this.pollIntervalMs(),
      lastClaimedJobId: this.lastClaimedJobId
    };
  }

  private async runClaimedJob(job: ClaimedScanJob): Promise<void> {
    try {
      const scanResult = await this.awsScanner.scan({
        account: {
          id: job.cloudAccount.id,
          tenantId: job.cloudAccount.tenantId,
          provider: CloudProvider.Aws,
          externalAccountId: job.cloudAccount.externalAccountId,
          name: job.cloudAccount.name
        },
        roleArn: job.cloudAccount.roleArn,
        regions: this.regionsFromMetadata(job.cloudAccount.metadata),
        endpointUrl: this.configService.get("LOCALSTACK_ENDPOINT", { infer: true })
      });

      await this.scannerWorkerRepository.completeJob({
        tenantId: job.tenantId,
        scanJobId: job.id,
        cloudAccountId: job.cloudAccountId,
        resources: scanResult.resources,
        scannerMode: scanResult.scannerMode,
        scannedAt: scanResult.scannedAt,
        metadata: {
          readOnly: scanResult.metadata.readOnly,
          mutatingCallsAttempted: scanResult.metadata.mutatingCallsAttempted,
          resourceTypes: [...new Set(scanResult.resources.map((resource) => resource.resourceType))]
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown scanner failure";
      await this.scannerWorkerRepository.failJob({
        tenantId: job.tenantId,
        scanJobId: job.id,
        cloudAccountId: job.cloudAccountId,
        errorCode: "SCANNER_FAILED",
        errorMessage: errorMessage.slice(0, 512)
      });
    }
  }

  private regionsFromMetadata(metadata: unknown): string[] {
    if (
      metadata &&
      typeof metadata === "object" &&
      "regions" in metadata &&
      Array.isArray(metadata.regions) &&
      metadata.regions.every((region) => typeof region === "string")
    ) {
      return metadata.regions;
    }

    return [this.configService.get("AWS_REGION", { infer: true })];
  }

  private workerId(): string {
    return this.configService.get("WORKER_ID", { infer: true });
  }

  private pollIntervalMs(): number {
    return this.configService.get("SCANNER_WORKER_POLL_INTERVAL_MS", { infer: true });
  }
}
