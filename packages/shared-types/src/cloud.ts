export enum CloudProvider {
  Aws = "aws"
}

export enum AwsResourceType {
  S3Bucket = "aws_s3_bucket",
  Ec2Instance = "aws_ec2_instance",
  IamUser = "aws_iam_user",
  IamRole = "aws_iam_role",
  IamPolicy = "aws_iam_policy",
  SecurityGroup = "aws_security_group",
  RdsInstance = "aws_rds_instance",
  LambdaFunction = "aws_lambda_function",
  CloudTrailTrail = "aws_cloudtrail_trail",
  EcrRepository = "aws_ecr_repository",
  SecretsManagerSecret = "aws_secretsmanager_secret",
  KmsKey = "aws_kms_key"
}

export interface CloudAccountRef {
  id: string;
  tenantId: string;
  provider: CloudProvider;
  externalAccountId: string;
  name: string;
}

export interface CloudAssetRef {
  id: string;
  tenantId: string;
  cloudAccountId: string;
  provider: CloudProvider;
  resourceType: AwsResourceType | string;
  externalId: string;
  region: string | null;
  name: string;
}

export interface AssetSummary extends CloudAssetRef {
  arn: string | null;
  tags: Record<string, unknown> | null;
  sensitivity: number;
  criticality: number;
  firstSeenAt: string;
  lastSeenAt: string;
  deletedAt: string | null;
}

export enum ScanJobState {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
  Failed = "failed"
}

export interface ScanJobRef {
  id: string;
  tenantId: string;
  cloudAccountId: string;
  state: ScanJobState;
  scanType: string;
}
