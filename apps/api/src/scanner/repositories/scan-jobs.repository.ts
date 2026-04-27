import { Injectable } from "@nestjs/common";
import { ScanJobStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ScanJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createPendingJob(input: {
    tenantId: string;
    cloudAccountId: string;
    requestedById: string;
    scanType: string;
  }) {
    return this.prisma.scanJob.create({
      data: {
        tenantId: input.tenantId,
        cloudAccountId: input.cloudAccountId,
        requestedById: input.requestedById,
        scanType: input.scanType,
        status: ScanJobStatus.QUEUED
      }
    });
  }

  listForTenant(tenantId: string) {
    return this.prisma.scanJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }

  findByIdForTenant(input: { tenantId: string; scanJobId: string }) {
    return this.prisma.scanJob.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.scanJobId
      }
    });
  }
}
