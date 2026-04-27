import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

export class ListAssetsQuery {
  @IsOptional()
  @IsUUID()
  cloudAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^aws_[a-z0-9_]+$/)
  assetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  region?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeDeleted?: boolean;
}
