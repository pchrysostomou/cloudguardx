import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { FindingSeverity, FindingStatus } from "@cloudguardx/shared-types";

export class ListFindingsQuery {
  @IsOptional()
  @IsEnum(FindingStatus)
  status?: FindingStatus;

  @IsOptional()
  @IsEnum(FindingSeverity)
  severity?: FindingSeverity;

  @IsOptional()
  @IsUUID()
  cloudAccountId?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;
}
