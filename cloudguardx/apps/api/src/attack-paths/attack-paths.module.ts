import { Module } from "@nestjs/common";
import { AttackPathsController } from "./attack-paths.controller";
import { AttackPathsService } from "./attack-paths.service";
import { AttackPathsRepository } from "./repositories/attack-paths.repository";

@Module({
  controllers: [AttackPathsController],
  providers: [AttackPathsService, AttackPathsRepository],
  exports: [AttackPathsService, AttackPathsRepository]
})
export class AttackPathsModule {}
