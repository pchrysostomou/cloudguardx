import { WorkerService } from "./worker.service";

describe("WorkerService", () => {
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number | boolean | undefined> = {
        WORKER_ID: "worker-test",
        SCANNER_WORKER_POLL_INTERVAL_MS: 5000,
        SCANNER_WORKER_POLL_ENABLED: false,
        AWS_REGION: "us-east-1",
        LOCALSTACK_ENDPOINT: "http://localhost:4566"
      };

      return values[key];
    })
  };

  it("reports idle scanner state for phase three", () => {
    const service = new WorkerService({} as never, {} as never, configService as never);

    expect(service.getRuntimeState()).toMatchObject({
      service: "scanner-worker",
      scannerRuntime: "idle",
      workerId: "worker-test",
      pollIntervalMs: 5000,
      lastClaimedJobId: null
    });
  });

  it("claims a job, runs the mocked scanner, and completes the job", async () => {
    const scannerWorkerRepository = {
      claimNextJob: jest.fn().mockResolvedValue({
        id: "scan-job-1",
        tenantId: "tenant-1",
        cloudAccountId: "account-1",
        cloudAccount: {
          id: "account-1",
          tenantId: "tenant-1",
          externalAccountId: "123456789012",
          name: "Production",
          roleArn: "arn:aws:iam::123456789012:role/CloudGuardXReadOnly",
          metadata: { regions: ["us-east-1"] }
        }
      }),
      completeJob: jest.fn(),
      failJob: jest.fn()
    };
    const awsScanner = {
      scan: jest.fn().mockResolvedValue({
        scannerMode: "mock",
        scannedAt: "2026-04-26T00:00:00.000Z",
        resources: [{ resourceType: "aws_s3_bucket" }],
        metadata: {
          readOnly: true,
          mutatingCallsAttempted: false
        }
      })
    };
    const service = new WorkerService(scannerWorkerRepository as never, awsScanner as never, configService as never);

    const job = await service.processNextJob();

    expect(job?.id).toBe("scan-job-1");
    expect(scannerWorkerRepository.claimNextJob).toHaveBeenCalledWith("worker-test");
    expect(awsScanner.scan).toHaveBeenCalledWith(
      expect.objectContaining({
        roleArn: "arn:aws:iam::123456789012:role/CloudGuardXReadOnly",
        regions: ["us-east-1"]
      })
    );
    expect(scannerWorkerRepository.completeJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        scanJobId: "scan-job-1",
        resources: [{ resourceType: "aws_s3_bucket" }],
        scannerMode: "mock"
      })
    );
  });
});
