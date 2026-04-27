import { Module } from "@nestjs/common";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";
import { PoliciesRepository } from "./repositories/policies.repository";

@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService, PoliciesRepository],
  exports: [PoliciesService, PoliciesRepository]
})
export class PoliciesModule {}
