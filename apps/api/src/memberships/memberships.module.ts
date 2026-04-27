import { Module, forwardRef } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { UsersModule } from "../users/users.module";
import { MembershipsController } from "./memberships.controller";
import { MembershipsService } from "./memberships.service";
import { MembershipsRepository } from "./repositories/memberships.repository";

@Module({
  imports: [AuditLogModule, forwardRef(() => UsersModule)],
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipsRepository],
  exports: [MembershipsService, MembershipsRepository]
})
export class MembershipsModule {}

