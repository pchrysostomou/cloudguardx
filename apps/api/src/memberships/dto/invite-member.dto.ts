import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { RoleKey } from "@cloudguardx/shared-types";

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsEnum(RoleKey)
  role!: RoleKey.Admin | RoleKey.SecurityAnalyst | RoleKey.ReadOnly;
}

