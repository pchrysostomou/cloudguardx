import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import type { RequestWithPrincipal } from "./request-with-principal";

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    return request.user;
  }
);
