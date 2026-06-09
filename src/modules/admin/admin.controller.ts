import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Role } from 'src/common/utils/enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('admin')
@UseGuards(GuardService, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @Roles(Role.admin, Role.superAdmin)
  async getOverview() {
    const data = await this.adminService.getOverview();
    return { statusCode: 200, message: 'OK', data };
  }

  @Roles(Role.admin)
  @Patch('user/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: Role,
  ) {
    const user = await this.adminService.updateUserRole(id, role);
    return {
      message: 'User role updated successfully',
      user,
    };
  }
}