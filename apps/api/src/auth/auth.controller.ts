import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { requestMetadataFrom } from "../common/auth/request-metadata";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(
      {
        email: dto.email,
        password: dto.password,
        displayName: dto.displayName,
        organizationName: dto.organizationName,
        organizationSlug: dto.organizationSlug
      },
      requestMetadataFrom(request)
    );
  }

  @Post("login")
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(
      {
        email: dto.email,
        password: dto.password,
        tenantId: dto.tenantId
      },
      requestMetadataFrom(request)
    );
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, requestMetadataFrom(request));
  }

  @Post("logout")
  logout(@Body() dto: LogoutDto, @Req() request: Request) {
    return this.authService.logout(dto.refreshToken, requestMetadataFrom(request));
  }
}

