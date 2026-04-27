import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });
  app.enableShutdownHooks();

  const logger = new Logger("WorkerBootstrap");
  logger.log("CloudGuardX worker process started");
}

void bootstrap();

