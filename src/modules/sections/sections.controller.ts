import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';

@Controller('sections')
@UseGuards(GuardService, RolesGuard)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  /** GET /sections */
  @Get()
  async getSections(@Req() req: any) {
    return this.sectionsService.getSections(req.user.sub);
  }

  /** GET /sections/:id */
  @Get(':id')
  async getSection(@Param('id') id: string, @Req() req: any) {
    return this.sectionsService.getSection(id, req.user.sub);
  }

  /** GET /sections/:id/lessons */
  @Get(':id/lessons')
  async getSectionLessons(@Param('id') id: string, @Req() req: any) {
    return this.sectionsService.getSectionLessons(id, req.user.sub);
  }
}
