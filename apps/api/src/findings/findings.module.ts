import { Module } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { FindingsController } from "./findings.controller";
import { FindingsService } from "./findings.service";
import { FindingsRepository } from "./repositories/findings.repository";

@Module({
  imports: [AuditLogModule],
  controllers: [FindingsController],
  providers: [FindingsService, FindingsRepository],
  exports: [FindingsService, FindingsRepository]
})
export class FindingsModule {}
