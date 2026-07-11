import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), OrgScopeGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get(':businessId')
  report(
    @CurrentUser() u: AuthUser,
    @Param('businessId') businessId: string,
    @Query('format') format?: string,
  ) {
    return this.svc.generate(businessId, format, u.organizationId);
  }

  @Get(':businessId/history')
  history(
    @CurrentUser() u: AuthUser,
    @Param('businessId') businessId: string,
  ) {
    return this.svc.list(businessId, u.organizationId);
  }
}
