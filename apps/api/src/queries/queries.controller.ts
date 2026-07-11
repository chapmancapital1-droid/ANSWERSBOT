import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QueriesService } from './queries.service';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';

@ApiTags('queries')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), OrgScopeGuard)
@Controller()
export class QueriesController {
  constructor(private readonly svc: QueriesService) {}
  @Post('businesses/:businessId/queries')
  create(@Param('businessId') businessId: string, @Body() body: { queryText: string; location?: string }) {
    return this.svc.create(businessId, body);
  }
  @Get('businesses/:businessId/queries')
  list(@Param('businessId') businessId: string) { return this.svc.list(businessId); }
  @Patch('queries/:id')
  update(@Param('id') id: string, @Body() body: { isActive?: boolean; queryText?: string }) {
    return this.svc.update(id, body);
  }
  @Get('queries/:id/results')
  results(@Param('id') id: string, @Query('platform') platform?: string, @Query('range') range?: string) {
    return this.svc.results(id, { platform, range });
  }
}
