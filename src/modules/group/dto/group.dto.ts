import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  memberIds?: string[];

  @IsOptional()
  @IsArray()
  lessonIds?: string[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  memberIds?: string[];

  @IsOptional()
  @IsArray()
  lessonIds?: string[];
}

export class AddMembersDto {
  @IsArray()
  memberIds: string[];
}

export class AddLessonsDto {
  @IsArray()
  lessonIds: string[];
}
