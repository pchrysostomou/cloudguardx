import { Module } from "@nestjs/common";
import { PasswordService } from "../auth/password.service";
import { UsersRepository } from "./repositories/users.repository";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, PasswordService],
  exports: [UsersService, UsersRepository]
})
export class UsersModule {}
