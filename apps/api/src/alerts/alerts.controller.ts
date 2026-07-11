import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  listOrg(@CurrentUser() u: AuthUser) {
    return this.alerts.listForOrg(u.organizationId);
  }

  @Get('business/:businessId')
  listBusiness(
    @CurrentUser() u: AuthUser,
    @Param('businessId') businessId: string,
  ) {
    return this.alerts.listForBusiness(businessId, u.organizationId);
  }
}
