import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MembershipsRepository } from "../../memberships/repositories/memberships.repository";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, PermissionsGuard, MembershipsRepository],
  exports: [JwtAuthGuard, PermissionsGuard, JwtModule, MembershipsRepository]
})
export class AuthSupportModule {}
