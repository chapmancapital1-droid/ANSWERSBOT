import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScansService } from './scans.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';

@ApiTags('scans')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('scans')
export class ScansController {
  constructor(private readonly svc: ScansService) {}

  @Post('trigger')
  trigger(
    @CurrentUser() u: AuthUser,
    @Body()
    body: {
      trackedQueryId?: string;
      businessId?: string;
      platformKeys?: string[];
      /** Force sync run (also enabled when SCAN_SYNC=true). */
      sync?: boolean;
    },
  ) {
    return this.svc.trigger(u.organizationId, body);
  }

  @Get('jobs/:jobId')
  getJob(@CurrentUser() u: AuthUser, @Param('jobId') jobId: string) {
    return this.svc.getJob(u.organizationId, jobId);
  }

  /** businessId is org-scoped via OrgScopeGuard + service join. */
  @UseGuards(OrgScopeGuard)
  @Get('business/:businessId')
  listForBusiness(
    @CurrentUser() u: AuthUser,
    @Param('businessId') businessId: string,
  ) {
    return this.svc.listForBusiness(u.organizationId, businessId);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.get(u.organizationId, id);
  }
}
