import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AttackPathsModule } from "./attack-paths/attack-paths.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { AuthModule } from "./auth/auth.module";
import { AssetsModule } from "./assets/assets.module";
import { CloudAccountsModule } from "./cloud-accounts/cloud-accounts.module";
import { AuthSupportModule } from "./common/auth/auth-support.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { validateEnvironment } from "./config/env.schema";
import { PrismaModule } from "./database/prisma.module";
import { FindingsModule } from "./findings/findings.module";
import { HealthModule } from "./health/health.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { PoliciesModule } from "./policies/policies.module";
import { RemediationsModule } from "./remediations/remediations.module";
import { ScannerModule } from "./scanner/scanner.module";
import { TenantsModule } from "./tenants/tenants.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [".env", "../../.env"],
      isGlobal: true,
      validate: validateEnvironment
    }),
    PrismaModule,
    AuthSupportModule,
    HealthModule,
    AuditLogModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    AuthModule,
    CloudAccountsModule,
    ScannerModule,
    AssetsModule,
    PoliciesModule,
    FindingsModule,
    ComplianceModule,
    AttackPathsModule,
    RemediationsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
