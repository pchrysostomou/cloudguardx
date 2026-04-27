-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'INVITED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('owner', 'admin', 'security_analyst', 'read_only');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CloudProvider" AS ENUM ('aws');

-- CreateEnum
CREATE TYPE "CloudAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "ScanJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ScanEventLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('aws_s3_bucket', 'aws_ec2_instance', 'aws_iam_user', 'aws_iam_role', 'aws_iam_policy', 'aws_security_group', 'aws_rds_instance', 'aws_lambda_function', 'aws_cloudtrail_trail', 'aws_ecr_repository', 'aws_secretsmanager_secret', 'aws_kms_key');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('critical', 'high', 'medium', 'low', 'informational');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('open', 'triaged', 'resolved', 'risk_accepted');

-- CreateEnum
CREATE TYPE "AttackGraphNodeKind" AS ENUM ('resource', 'identity');

-- CreateEnum
CREATE TYPE "AttackGraphEdgeKind" AS ENUM ('permission', 'network_exposure', 'credential_exposure', 'data_access');

-- CreateEnum
CREATE TYPE "RemediationSource" AS ENUM ('human', 'ai');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('unread', 'read', 'archived');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefreshTokenStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'REUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MfaDeviceType" AS ENUM ('totp', 'webauthn');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID,
    "roleKey" "RoleKey" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "roleArn" TEXT NOT NULL,
    "externalIdCiphertext" TEXT NOT NULL,
    "status" "CloudAccountStatus" NOT NULL DEFAULT 'PENDING',
    "lastSuccessfulScanAt" TIMESTAMP(3),
    "lastScanError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_jobs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cloudAccountId" UUID NOT NULL,
    "requestedById" UUID,
    "status" "ScanJobStatus" NOT NULL DEFAULT 'QUEUED',
    "scanType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "scanJobId" UUID NOT NULL,
    "level" "ScanEventLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cloudAccountId" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "arn" TEXT,
    "region" TEXT,
    "name" TEXT NOT NULL,
    "tags" JSONB,
    "normalized" JSONB NOT NULL,
    "sensitivity" INTEGER NOT NULL DEFAULT 0,
    "criticality" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cloudAccountId" UUID,
    "assetId" UUID,
    "policyId" UUID,
    "scanJobId" UUID,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'open',
    "score" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "implementation" TEXT NOT NULL,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_results" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "scanJobId" UUID NOT NULL,
    "assetId" UUID,
    "findingId" UUID,
    "passed" BOOLEAN NOT NULL,
    "evidence" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "factors" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_frameworks" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_controls" (
    "id" UUID NOT NULL,
    "frameworkId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_mappings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "controlId" UUID NOT NULL,
    "policyId" UUID,
    "findingId" UUID,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attack_graph_nodes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "assetId" UUID,
    "kind" "AttackGraphNodeKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attack_graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attack_graph_edges" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sourceNodeId" UUID NOT NULL,
    "targetNodeId" UUID NOT NULL,
    "kind" "AttackGraphEdgeKind" NOT NULL,
    "label" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attack_graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediations" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "findingId" UUID NOT NULL,
    "source" "RemediationSource" NOT NULL,
    "guidanceMarkdown" TEXT NOT NULL,
    "terraformPatch" TEXT,
    "awsCliCommands" JSONB,
    "isDestructive" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remediations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'unread',
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdByUserId" UUID,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "parentTokenId" UUID,
    "status" "RefreshTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "reuseDetectedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID,
    "type" "MfaDeviceType" NOT NULL,
    "label" TEXT NOT NULL,
    "secretCiphertext" TEXT,
    "webauthnCredentialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "mfa_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RolePermissions" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_RolePermissions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "memberships_tenantId_roleKey_idx" ON "memberships"("tenantId", "roleKey");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenantId_userId_key" ON "memberships"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_key_key" ON "roles"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_id_key" ON "roles"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_action_key" ON "permissions"("action");

-- CreateIndex
CREATE INDEX "cloud_accounts_tenantId_status_idx" ON "cloud_accounts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_accounts_tenantId_provider_externalAccountId_key" ON "cloud_accounts"("tenantId", "provider", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "cloud_accounts_tenantId_id_key" ON "cloud_accounts"("tenantId", "id");

-- CreateIndex
CREATE INDEX "scan_jobs_tenantId_status_createdAt_idx" ON "scan_jobs"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "scan_jobs_tenantId_id_key" ON "scan_jobs"("tenantId", "id");

-- CreateIndex
CREATE INDEX "scan_events_tenantId_scanJobId_createdAt_idx" ON "scan_events"("tenantId", "scanJobId", "createdAt");

-- CreateIndex
CREATE INDEX "assets_tenantId_assetType_idx" ON "assets"("tenantId", "assetType");

-- CreateIndex
CREATE INDEX "assets_tenantId_region_idx" ON "assets"("tenantId", "region");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenantId_cloudAccountId_externalId_key" ON "assets"("tenantId", "cloudAccountId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenantId_id_key" ON "assets"("tenantId", "id");

-- CreateIndex
CREATE INDEX "findings_tenantId_severity_status_idx" ON "findings"("tenantId", "severity", "status");

-- CreateIndex
CREATE INDEX "findings_tenantId_score_idx" ON "findings"("tenantId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "findings_tenantId_dedupeKey_key" ON "findings"("tenantId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "findings_tenantId_id_key" ON "findings"("tenantId", "id");

-- CreateIndex
CREATE INDEX "policies_tenantId_enabled_idx" ON "policies"("tenantId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "policies_tenantId_key_key" ON "policies"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "policies_tenantId_id_key" ON "policies"("tenantId", "id");

-- CreateIndex
CREATE INDEX "policy_results_tenantId_policyId_evaluatedAt_idx" ON "policy_results"("tenantId", "policyId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "policy_results_tenantId_assetId_idx" ON "policy_results"("tenantId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_scores_findingId_key" ON "risk_scores"("findingId");

-- CreateIndex
CREATE INDEX "risk_scores_tenantId_score_idx" ON "risk_scores"("tenantId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "risk_scores_tenantId_findingId_key" ON "risk_scores"("tenantId", "findingId");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_frameworks_key_version_key" ON "compliance_frameworks"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_controls_frameworkId_key_key" ON "compliance_controls"("frameworkId", "key");

-- CreateIndex
CREATE INDEX "compliance_mappings_tenantId_controlId_idx" ON "compliance_mappings"("tenantId", "controlId");

-- CreateIndex
CREATE INDEX "compliance_mappings_tenantId_policyId_idx" ON "compliance_mappings"("tenantId", "policyId");

-- CreateIndex
CREATE INDEX "attack_graph_nodes_tenantId_kind_idx" ON "attack_graph_nodes"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "attack_graph_nodes_tenantId_externalId_key" ON "attack_graph_nodes"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "attack_graph_nodes_tenantId_id_key" ON "attack_graph_nodes"("tenantId", "id");

-- CreateIndex
CREATE INDEX "attack_graph_edges_tenantId_kind_idx" ON "attack_graph_edges"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "attack_graph_edges_sourceNodeId_idx" ON "attack_graph_edges"("sourceNodeId");

-- CreateIndex
CREATE INDEX "attack_graph_edges_targetNodeId_idx" ON "attack_graph_edges"("targetNodeId");

-- CreateIndex
CREATE INDEX "remediations_tenantId_findingId_createdAt_idx" ON "remediations"("tenantId", "findingId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_tenantId_status_createdAt_idx" ON "notifications"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_status_idx" ON "notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "api_keys_tenantId_status_idx" ON "api_keys"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_tenantId_keyPrefix_key" ON "api_keys"("tenantId", "keyPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_status_idx" ON "refresh_tokens"("userId", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenantId_createdAt_idx" ON "refresh_tokens"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "mfa_devices_userId_type_idx" ON "mfa_devices"("userId", "type");

-- CreateIndex
CREATE INDEX "mfa_devices_tenantId_idx" ON "mfa_devices"("tenantId");

-- CreateIndex
CREATE INDEX "_RolePermissions_B_index" ON "_RolePermissions"("B");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_roleId_fkey" FOREIGN KEY ("tenantId", "roleId") REFERENCES "roles"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_accounts" ADD CONSTRAINT "cloud_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_tenantId_cloudAccountId_fkey" FOREIGN KEY ("tenantId", "cloudAccountId") REFERENCES "cloud_accounts"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_tenantId_scanJobId_fkey" FOREIGN KEY ("tenantId", "scanJobId") REFERENCES "scan_jobs"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenantId_cloudAccountId_fkey" FOREIGN KEY ("tenantId", "cloudAccountId") REFERENCES "cloud_accounts"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenantId_cloudAccountId_fkey" FOREIGN KEY ("tenantId", "cloudAccountId") REFERENCES "cloud_accounts"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenantId_assetId_fkey" FOREIGN KEY ("tenantId", "assetId") REFERENCES "assets"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenantId_policyId_fkey" FOREIGN KEY ("tenantId", "policyId") REFERENCES "policies"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_tenantId_scanJobId_fkey" FOREIGN KEY ("tenantId", "scanJobId") REFERENCES "scan_jobs"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_tenantId_policyId_fkey" FOREIGN KEY ("tenantId", "policyId") REFERENCES "policies"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_tenantId_scanJobId_fkey" FOREIGN KEY ("tenantId", "scanJobId") REFERENCES "scan_jobs"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_tenantId_assetId_fkey" FOREIGN KEY ("tenantId", "assetId") REFERENCES "assets"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_results" ADD CONSTRAINT "policy_results_tenantId_findingId_fkey" FOREIGN KEY ("tenantId", "findingId") REFERENCES "findings"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_tenantId_findingId_fkey" FOREIGN KEY ("tenantId", "findingId") REFERENCES "findings"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "compliance_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_mappings" ADD CONSTRAINT "compliance_mappings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_mappings" ADD CONSTRAINT "compliance_mappings_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "compliance_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_mappings" ADD CONSTRAINT "compliance_mappings_tenantId_policyId_fkey" FOREIGN KEY ("tenantId", "policyId") REFERENCES "policies"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_mappings" ADD CONSTRAINT "compliance_mappings_tenantId_findingId_fkey" FOREIGN KEY ("tenantId", "findingId") REFERENCES "findings"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_graph_nodes" ADD CONSTRAINT "attack_graph_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_graph_nodes" ADD CONSTRAINT "attack_graph_nodes_tenantId_assetId_fkey" FOREIGN KEY ("tenantId", "assetId") REFERENCES "assets"("tenantId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_graph_edges" ADD CONSTRAINT "attack_graph_edges_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_graph_edges" ADD CONSTRAINT "attack_graph_edges_tenantId_sourceNodeId_fkey" FOREIGN KEY ("tenantId", "sourceNodeId") REFERENCES "attack_graph_nodes"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_graph_edges" ADD CONSTRAINT "attack_graph_edges_tenantId_targetNodeId_fkey" FOREIGN KEY ("tenantId", "targetNodeId") REFERENCES "attack_graph_nodes"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_tenantId_findingId_fkey" FOREIGN KEY ("tenantId", "findingId") REFERENCES "findings"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_parentTokenId_fkey" FOREIGN KEY ("parentTokenId") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_devices" ADD CONSTRAINT "mfa_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_devices" ADD CONSTRAINT "mfa_devices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolePermissions" ADD CONSTRAINT "_RolePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
