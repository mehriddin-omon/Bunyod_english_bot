import { PartialType } from '@nestjs/mapped-types';
import { CreateWordlistDto } from './create-wordlist.dto';

export class UpdateWordlistDto extends PartialType(CreateWordlistDto) {}
