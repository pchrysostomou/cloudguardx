import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { CloudAccountsModule } from "../cloud-accounts/cloud-accounts.module";
import { ScanJobsRepository } from "./repositories/scan-jobs.repository";
import { ScanJobsController } from "./scan-jobs.controller";
import { ScanJobsService } from "./scan-jobs.service";

@Module({
  imports: [AuditLogModule, CloudAccountsModule],
  controllers: [ScanJobsController],
  providers: [ScanJobsService, ScanJobsRepository],
  exports: [ScanJobsService, ScanJobsRepository]
})
export class ScannerModule {}
