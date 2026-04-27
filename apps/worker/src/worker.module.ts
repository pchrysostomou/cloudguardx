import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./database/prisma.module";
import { validateWorkerEnvironment } from "./env.schema";
import { AWS_SCANNER, awsScannerFactory } from "./scanner/aws-scanner.provider";
import { ScannerWorkerRepository } from "./scanner/scanner-worker.repository";
import { WorkerService } from "./worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateWorkerEnvironment
    }),
    PrismaModule
  ],
  providers: [
    WorkerService,
    ScannerWorkerRepository,
    {
      provide: AWS_SCANNER,
      useFactory: awsScannerFactory
    }
  ]
})
export class WorkerModule {}
