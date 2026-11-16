import { IsString, IsUUID, Length } from 'class-validator';

export class TelegramPollDto {
  @IsUUID()
  requestId: string;

  @IsString()
  @Length(32, 128)
  pollSecret: string;
}
