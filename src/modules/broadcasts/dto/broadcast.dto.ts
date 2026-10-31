import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AudienceDto {
  @IsIn(['all', 'groups', 'users'])
  mode: 'all' | 'groups' | 'users';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsUUID('all', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsBoolean()
  includeGuests?: boolean;
}

export class NotificationActionDto {
  @IsIn(['list', 'lesson', 'online_lesson', 'recording', 'chat', 'url'])
  type: 'list' | 'lesson' | 'online_lesson' | 'recording' | 'chat' | 'url';

  @IsOptional()
  @IsUUID('all')
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^https:\/\/\S+$/, { message: "Havola https:// bilan boshlanishi kerak" })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class CreateBroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body: string;

  @ValidateNested()
  @Type(() => AudienceDto)
  audience: AudienceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationActionDto)
  action?: NotificationActionDto;

  /** Bo'sh — hozir yuboriladi */
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  /** true — qoralama sifatida saqlanadi, yuborilmaydi */
  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}

export class UpdateBroadcastDto extends PartialType(CreateBroadcastDto) {}

export class PreviewAudienceDto {
  @ValidateNested()
  @Type(() => AudienceDto)
  audience: AudienceDto;
}
