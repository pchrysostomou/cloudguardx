import { Injectable } from "@nestjs/common";
import { cisAwsFrameworkDefinition } from "@cloudguardx/policy-engine";
import type { ComplianceFrameworkDefinition } from "@cloudguardx/policy-engine";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class ComplianceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultControls(definition: ComplianceFrameworkDefinition = cisAwsFrameworkDefinition): Promise<void> {
    const framework = await this.prisma.complianceFramework.upsert({
      where: {
        key_version: {
          key: definition.key,
          version: definition.version
        }
      },
      create: {
        key: definition.key,
        name: definition.name,
        version: definition.version,
        description: definition.description
      },
      update: {
        name: definition.name,
        description: definition.description
      }
    });

    await Promise.all(
      definition.controls.map((control) =>
        this.prisma.complianceControl.upsert({
          where: {
            frameworkId_key: {
              frameworkId: framework.id,
              key: control.key
            }
          },
          create: {
            frameworkId: framework.id,
            key: control.key,
            title: control.title,
            description: control.description
          },
          update: {
            title: control.title,
            description: control.description
          }
        })
      )
    );
  }

  listControlsForTenant(tenantId: string) {
    return this.prisma.complianceControl.findMany({
      include: {
        framework: true,
        mappings: {
          where: { tenantId },
          include: {
            finding: true,
            policy: true
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ key: "asc" }]
    });
  }

  listMappingsForFinding(input: { tenantId: string; findingId: string }) {
    return this.prisma.complianceMapping.findMany({
      where: {
        tenantId: input.tenantId,
        findingId: input.findingId
      },
      include: {
        control: {
          include: {
            framework: true
          }
        },
        finding: true,
        policy: true
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
