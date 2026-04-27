import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("service")
@Controller()
export class AppController {
  @Get()
  @ApiOkResponse({
    schema: {
      example: {
        name: "CloudGuardX API",
        status: "ok"
      }
    }
  })
  metadata(): { name: string; status: "ok" } {
    return {
      name: "CloudGuardX API",
      status: "ok"
    };
  }
}

