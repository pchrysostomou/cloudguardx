import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get("live")
  @ApiOkResponse({ schema: { example: { status: "ok" } } })
  liveness(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOkResponse({ schema: { example: { status: "ok", database: "ok" } } })
  async readiness(): Promise<{ status: "ok"; database: "ok" }> {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "ok"
    };
  }
}
