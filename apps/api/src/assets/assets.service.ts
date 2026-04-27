import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetType } from "@prisma/client";
import { AwsResourceType, CloudProvider } from "@cloudguardx/shared-types";
import type { AssetSummary, AuthenticatedPrincipal } from "@cloudguardx/shared-types";
import { AssetsRepository } from "./repositories/assets.repository";

@Injectable()
export class AssetsService {
  constructor(private readonly assetsRepository: AssetsRepository) {}

  async listForTenant(
    principal: AuthenticatedPrincipal,
    filters: {
      cloudAccountId?: string;
      assetType?: string;
      region?: string;
      includeDeleted?: boolean;
    } = {}
  ): Promise<AssetSummary[]> {
    const assets = await this.assetsRepository.listForTenant({
      tenantId: principal.tenantId,
      cloudAccountId: filters.cloudAccountId,
      assetType: filters.assetType ? mapSharedAssetTypeToPrisma(filters.assetType) : undefined,
      region: filters.region,
      includeDeleted: filters.includeDeleted
    });

    return assets.map(toAssetSummary);
  }

  async getForTenant(principal: AuthenticatedPrincipal, assetId: string): Promise<AssetSummary> {
    const asset = await this.assetsRepository.findByIdForTenant({
      tenantId: principal.tenantId,
      assetId
    });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    return toAssetSummary(asset);
  }
}

const sharedAssetTypeToPrisma: Record<AwsResourceType, AssetType> = {
  [AwsResourceType.S3Bucket]: AssetType.AWS_S3_BUCKET,
  [AwsResourceType.Ec2Instance]: AssetType.AWS_EC2_INSTANCE,
  [AwsResourceType.IamUser]: AssetType.AWS_IAM_USER,
  [AwsResourceType.IamRole]: AssetType.AWS_IAM_ROLE,
  [AwsResourceType.IamPolicy]: AssetType.AWS_IAM_POLICY,
  [AwsResourceType.SecurityGroup]: AssetType.AWS_SECURITY_GROUP,
  [AwsResourceType.RdsInstance]: AssetType.AWS_RDS_INSTANCE,
  [AwsResourceType.LambdaFunction]: AssetType.AWS_LAMBDA_FUNCTION,
  [AwsResourceType.CloudTrailTrail]: AssetType.AWS_CLOUDTRAIL_TRAIL,
  [AwsResourceType.EcrRepository]: AssetType.AWS_ECR_REPOSITORY,
  [AwsResourceType.SecretsManagerSecret]: AssetType.AWS_SECRETS_MANAGER_SECRET,
  [AwsResourceType.KmsKey]: AssetType.AWS_KMS_KEY
};

const prismaAssetTypeToShared: Record<AssetType, AwsResourceType> = {
  [AssetType.AWS_S3_BUCKET]: AwsResourceType.S3Bucket,
  [AssetType.AWS_EC2_INSTANCE]: AwsResourceType.Ec2Instance,
  [AssetType.AWS_IAM_USER]: AwsResourceType.IamUser,
  [AssetType.AWS_IAM_ROLE]: AwsResourceType.IamRole,
  [AssetType.AWS_IAM_POLICY]: AwsResourceType.IamPolicy,
  [AssetType.AWS_SECURITY_GROUP]: AwsResourceType.SecurityGroup,
  [AssetType.AWS_RDS_INSTANCE]: AwsResourceType.RdsInstance,
  [AssetType.AWS_LAMBDA_FUNCTION]: AwsResourceType.LambdaFunction,
  [AssetType.AWS_CLOUDTRAIL_TRAIL]: AwsResourceType.CloudTrailTrail,
  [AssetType.AWS_ECR_REPOSITORY]: AwsResourceType.EcrRepository,
  [AssetType.AWS_SECRETS_MANAGER_SECRET]: AwsResourceType.SecretsManagerSecret,
  [AssetType.AWS_KMS_KEY]: AwsResourceType.KmsKey
};

function mapSharedAssetTypeToPrisma(assetType: string): AssetType {
  const mapped = sharedAssetTypeToPrisma[assetType as AwsResourceType];

  if (!mapped) {
    throw new BadRequestException("Unsupported asset type");
  }

  return mapped;
}

function toAssetSummary(asset: {
  id: string;
  tenantId: string;
  cloudAccountId: string;
  provider: string;
  assetType: AssetType;
  externalId: string;
  arn: string | null;
  region: string | null;
  name: string;
  tags: unknown;
  sensitivity: number;
  criticality: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  deletedAt: Date | null;
}): AssetSummary {
  return {
    id: asset.id,
    tenantId: asset.tenantId,
    cloudAccountId: asset.cloudAccountId,
    provider: CloudProvider.Aws,
    resourceType: prismaAssetTypeToShared[asset.assetType],
    externalId: asset.externalId,
    arn: asset.arn,
    region: asset.region,
    name: asset.name,
    tags: recordOrNull(asset.tags),
    sensitivity: asset.sensitivity,
    criticality: asset.criticality,
    firstSeenAt: asset.firstSeenAt.toISOString(),
    lastSeenAt: asset.lastSeenAt.toISOString(),
    deletedAt: asset.deletedAt?.toISOString() ?? null
  };
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
