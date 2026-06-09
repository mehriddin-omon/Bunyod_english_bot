import { IsArray, IsString } from 'class-validator';

export class BulkImportDto {
  @IsArray()
  @IsString({ each: true })
  lines: string[];
}
