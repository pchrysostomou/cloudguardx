import "reflect-metadata";
import helmet from "helmet";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import type { Environment } from "./config/env.schema";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const logger = new Logger("Bootstrap");
  const config = app.get(ConfigService<Environment, true>);
  const port = config.get("API_PORT", { infer: true });
  const corsOrigins = config
    .get("CORS_ORIGINS", { infer: true })
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: corsOrigins
  });
  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    })
  );

  const openApiConfig = new DocumentBuilder()
    .setTitle("CloudGuardX API")
    .setDescription("Cloud Security Posture Management API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  await app.listen(port);
  logger.log(`CloudGuardX API listening on port ${port}`);
}

void bootstrap();

