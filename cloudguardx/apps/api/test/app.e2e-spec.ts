import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("CloudGuardX API smoke test", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://cloudguardx:cloudguardx_dev_password@localhost:5432/cloudguardx?schema=public";
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.JWT_ACCESS_TOKEN_SECRET ??= "local-access-secret-with-at-least-32-chars";
    process.env.JWT_REFRESH_TOKEN_SECRET ??= "local-refresh-secret-with-at-least-32-chars";
    process.env.FIELD_ENCRYPTION_KEY_BASE64 ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves service metadata", async () => {
    await request(app.getHttpServer()).get("/api").expect(200).expect({
      name: "CloudGuardX API",
      status: "ok"
    });
  });
});
