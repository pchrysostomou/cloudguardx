import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";

describe("AppController", () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController]
    }).compile();

    controller = module.get(AppController);
  });

  it("returns service metadata", () => {
    expect(controller.metadata()).toEqual({
      name: "CloudGuardX API",
      status: "ok"
    });
  });
});
