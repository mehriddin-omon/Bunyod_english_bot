import { PartialType } from '@nestjs/mapped-types';
import { LoginDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(LoginDto) {}
