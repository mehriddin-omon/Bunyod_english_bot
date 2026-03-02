import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { GuardService, Role, RolesGuard } from '@my/common';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('admin')
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