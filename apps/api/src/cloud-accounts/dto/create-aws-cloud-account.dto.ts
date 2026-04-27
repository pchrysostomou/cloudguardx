import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const awsAccountIdPattern = /^\d{12}$/;
const awsRoleArnPattern = /^arn:aws(?:-[a-z]+)?:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,512}$/;
const externalIdPattern = /^[A-Za-z0-9+=,.@:/_-]+$/;
const awsRegionPattern = /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;

export class CreateAwsCloudAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(awsAccountIdPattern)
  externalAccountId!: string;

  @IsString()
  @Matches(awsRoleArnPattern)
  roleArn!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(1224)
  @Matches(externalIdPattern)
  externalId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @Matches(awsRegionPattern, { each: true })
  regions?: string[];
}
