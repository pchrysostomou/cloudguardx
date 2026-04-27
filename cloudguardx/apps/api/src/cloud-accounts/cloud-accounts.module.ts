import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { FieldEncryptionService } from "../common/security/field-encryption.service";
import { CloudAccountsController } from "./cloud-accounts.controller";
import { CloudAccountsService } from "./cloud-accounts.service";
import { CloudAccountsRepository } from "./repositories/cloud-accounts.repository";

@Module({
  imports: [AuditLogModule],
  controllers: [CloudAccountsController],
  providers: [CloudAccountsService, CloudAccountsRepository, FieldEncryptionService],
  exports: [CloudAccountsService, CloudAccountsRepository]
})
export class CloudAccountsModule {}
