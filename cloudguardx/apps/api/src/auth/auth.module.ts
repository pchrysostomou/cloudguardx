import { Module, forwardRef } from "@nestjs/common";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthSupportModule } from "../common/auth/auth-support.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { TenantsModule } from "../tenants/tenants.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";

@Module({
  imports: [
    AuthSupportModule,
    AuditLogModule,
    TenantsModule,
    MembershipsModule,
    forwardRef(() => UsersModule)
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, RefreshTokenRepository],
  exports: [AuthService, PasswordService, RefreshTokenRepository]
})
export class AuthModule {}
