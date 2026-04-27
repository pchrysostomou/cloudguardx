import { IsOptional, IsUUID } from "class-validator";

export class ListRemediationsQuery {
  @IsOptional()
  @IsUUID()
  findingId?: string;
}
