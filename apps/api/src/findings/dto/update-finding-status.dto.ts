import { IsEnum } from "class-validator";
import { FindingStatus } from "@cloudguardx/shared-types";

export class UpdateFindingStatusDto {
  @IsEnum(FindingStatus)
  status!: FindingStatus;
}
