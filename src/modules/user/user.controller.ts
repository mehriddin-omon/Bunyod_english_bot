import {
  Controller,
  Post, Get, Put, Delete,
  Param, Body, Query,
  UseGuards, Request,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/utils/enum';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserByAdminDto,
  UserListQueryDto,
} from './dto/user-management.dto';

@Controller('users')
@UseGuards(GuardService, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(Role.admin, Role.teacher)
  async createUser(@Body() dto: CreateUserDto, @Request() req) {
    const data = await this.userService.createUser(dto, req.user.sub, req.user.role);
    return { statusCode: 201, message: 'Foydalanuvchi yaratildi', data };
  }

  @Get()
  @Roles(Role.admin, Role.teacher)
  async findAll(@Query() query: UserListQueryDto, @Request() req) {
    const data = await this.userService.findAll(query, req.user.sub, req.user.role);
    return { statusCode: 200, message: "Foydalanuvchilar ro'yxati", ...data };
  }

  @Get(':id')
  @Roles(Role.admin, Role.teacher)
  async findById(@Param('id') id: string, @Request() req) {
    const data = await this.userService.findById(id, req.user.sub, req.user.role);
    return { statusCode: 200, message: "Foydalanuvchi ma'lumoti", data };
  }

  @Put(':id')
  @Roles(Role.admin)
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserByAdminDto, @Request() req) {
    const data = await this.userService.updateUser(id, dto, req.user.sub, req.user.role);
    return { statusCode: 200, message: 'Foydalanuvchi yangilandi', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.admin)
  async deleteUser(@Param('id') id: string, @Request() req) {
    const data = await this.userService.deleteUser(id, req.user.sub, req.user.role);
    return { statusCode: 200, message: "Foydalanuvchi o'chirildi", data };
  }
}
