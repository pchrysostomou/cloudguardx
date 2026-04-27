import { Module } from "@nestjs/common";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { ComplianceRepository } from "./repositories/compliance.repository";

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceRepository],
  exports: [ComplianceService, ComplianceRepository]
})
export class ComplianceModule {}
