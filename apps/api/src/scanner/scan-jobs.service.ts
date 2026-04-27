import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { CloudAccountsRepository } from "../cloud-accounts/repositories/cloud-accounts.repository";
import { mapScanJobStatus } from "./scan-job-state";
import { ScanJobsRepository } from "./repositories/scan-jobs.repository";

@Injectable()
export class ScanJobsService {
  constructor(
    private readonly scanJobsRepository: ScanJobsRepository,
    private readonly cloudAccountsRepository: CloudAccountsRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async create(
    principal: AuthenticatedPrincipal,
    input: { cloudAccountId: string; scanType?: string },
    metadata: RequestMetadata
  ) {
    const cloudAccount = await this.cloudAccountsRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      cloudAccountId: input.cloudAccountId
    });

    if (!cloudAccount) {
      throw new NotFoundException("Cloud account not found");
    }

    const scanJob = await this.scanJobsRepository.createPendingJob({
      tenantId: principal.tenantId,
      cloudAccountId: cloudAccount.id,
      requestedById: principal.userId,
      scanType: input.scanType ?? "asset_inventory"
    });

    await this.auditLogService.record({
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      action: AuditActions.ScanJobCreate,
      targetType: "scan_job",
      targetId: scanJob.id,
      metadata: {
        cloudAccountId: cloudAccount.id,
        scanType: scanJob.scanType
      },
      ...metadata
    });

    return this.toResponse(scanJob);
  }

  async listForTenant(principal: AuthenticatedPrincipal) {
    const scanJobs = await this.scanJobsRepository.listForTenant(principal.tenantId);

    return scanJobs.map((scanJob) => this.toResponse(scanJob));
  }

  async getForTenant(principal: AuthenticatedPrincipal, scanJobId: string) {
    const scanJob = await this.scanJobsRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      scanJobId
    });

    if (!scanJob) {
      throw new NotFoundException("Scan job not found");
    }

    return this.toResponse(scanJob);
  }

  private toResponse(scanJob: {
    id: string;
    tenantId: string;
    cloudAccountId: string;
    requestedById: string | null;
    status: Parameters<typeof mapScanJobStatus>[0];
    scanType: string;
    startedAt: Date | null;
    completedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: scanJob.id,
      tenantId: scanJob.tenantId,
      cloudAccountId: scanJob.cloudAccountId,
      requestedById: scanJob.requestedById,
      state: mapScanJobStatus(scanJob.status),
      scanType: scanJob.scanType,
      startedAt: scanJob.startedAt?.toISOString() ?? null,
      completedAt: scanJob.completedAt?.toISOString() ?? null,
      errorCode: scanJob.errorCode,
      errorMessage: scanJob.errorMessage,
      createdAt: scanJob.createdAt.toISOString(),
      updatedAt: scanJob.updatedAt.toISOString()
    };
  }
}
