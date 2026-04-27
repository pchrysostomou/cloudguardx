import { Global, Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { TenantsModule } from "../tenants/tenants.module";
import { UsersModule } from "../users/users.module";
import { JwtAuthGuard } from "../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../common/rbac/permissions.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { RefreshTokenRepository } from "./repositories/refresh-token.repository";

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    AuditLogModule,
    TenantsModule,
    MembershipsModule,
    forwardRef(() => UsersModule)
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, RefreshTokenRepository, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, PasswordService, RefreshTokenRepository, JwtAuthGuard, PermissionsGuard, JwtModule]
})
export class AuthModule {}

