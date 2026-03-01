import { PartialType } from '@nestjs/mapped-types';
import { LoginDto } from './create-user.dto';
import { Role } from '@my/common';

export class UpdateUserDto extends PartialType(LoginDto) {
    username: string;
    fullName: string;
    role: Role;
    password: string;
    telegramId: string;
}
