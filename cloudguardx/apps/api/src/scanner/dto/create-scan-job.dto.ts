import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

export class CreateScanJobDto {
  @IsUUID()
  cloudAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9_:-]+$/)
  scanType?: string;
}
