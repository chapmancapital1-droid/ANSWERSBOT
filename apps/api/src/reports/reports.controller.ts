import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), OrgScopeGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}
  @Get(':businessId') report(@Param('businessId') businessId: string, @Query('format') format?: string) {
    return this.svc.generate(businessId, format);
  }
}
