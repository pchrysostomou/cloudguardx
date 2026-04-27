import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { RequestMetadata } from "../common/auth/request-metadata";
import { AuditActions, AuditLogService } from "../audit-log/audit-log.service";
import { FieldEncryptionService } from "../common/security/field-encryption.service";
import { CloudAccountsRepository } from "./repositories/cloud-accounts.repository";

function accountIdFromRoleArn(roleArn: string): string | null {
  return roleArn.match(/^arn:aws(?:-[a-z]+)?:iam::(\d{12}):role\//)?.[1] ?? null;
}

@Injectable()
export class CloudAccountsService {
  constructor(
    private readonly cloudAccountsRepository: CloudAccountsRepository,
    private readonly fieldEncryptionService: FieldEncryptionService,
    private readonly auditLogService: AuditLogService
  ) {}

  async onboardAwsReadOnlyRole(
    principal: AuthenticatedPrincipal,
    input: {
      name: string;
      externalAccountId: string;
      roleArn: string;
      externalId: string;
      regions?: string[];
    },
    metadata: RequestMetadata
  ) {
    const accountIdFromArn = accountIdFromRoleArn(input.roleArn);

    if (accountIdFromArn !== input.externalAccountId) {
      throw new BadRequestException("Role ARN account ID must match the AWS account ID");
    }

    const existing = await this.cloudAccountsRepository.findByExternalAccountIdForTenant({
      tenantId: principal.tenantId,
      externalAccountId: input.externalAccountId
    });

    if (existing) {
      throw new ConflictException("Cloud account is already onboarded");
    }

    const account = await this.cloudAccountsRepository.createAwsAccount({
      tenantId: principal.tenantId,
      name: input.name.trim(),
      externalAccountId: input.externalAccountId,
      roleArn: input.roleArn,
      externalIdCiphertext: this.fieldEncryptionService.encrypt(input.externalId),
      metadata: {
        onboardingMode: "read_only_role",
        regions: input.regions?.length ? input.regions : ["us-east-1"],
        roleSessionName: "cloudguardx-readonly-scanner"
      }
    });

    await this.auditLogService.record({
      tenantId: principal.tenantId,
      actorUserId: principal.userId,
      action: AuditActions.CloudAccountCreate,
      targetType: "cloud_account",
      targetId: account.id,
      metadata: {
        provider: account.provider,
        externalAccountId: account.externalAccountId
      },
      ...metadata
    });

    return this.toResponse(account);
  }

  async listForTenant(principal: AuthenticatedPrincipal) {
    const accounts = await this.cloudAccountsRepository.listForTenant(principal.tenantId);

    return accounts.map((account) => this.toResponse(account));
  }

  async getForTenant(principal: AuthenticatedPrincipal, cloudAccountId: string) {
    const account = await this.cloudAccountsRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      cloudAccountId
    });

    if (!account) {
      throw new NotFoundException("Cloud account not found");
    }

    return this.toResponse(account);
  }

  private toResponse(account: {
    id: string;
    tenantId: string;
    provider: string;
    name: string;
    externalAccountId: string;
    roleArn: string;
    status: string;
    lastSuccessfulScanAt: Date | null;
    lastScanError: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: account.id,
      tenantId: account.tenantId,
      provider: account.provider.toLowerCase(),
      name: account.name,
      externalAccountId: account.externalAccountId,
      roleArn: account.roleArn,
      status: account.status.toLowerCase(),
      lastSuccessfulScanAt: account.lastSuccessfulScanAt?.toISOString() ?? null,
      lastScanError: account.lastScanError,
      metadata: account.metadata,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }
}
