import { Body, Controller, Param, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Role } from '@my/common';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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