import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ScansService } from './scans.service';

@ApiTags('scans')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('scans')
export class ScansController {
  constructor(private readonly svc: ScansService) {}

  @Post('trigger')
  trigger(
    @Body()
    body: {
      trackedQueryId?: string;
      businessId?: string;
      platformKeys?: string[];
    },
  ) {
    return this.svc.trigger(body);
  }

  @Get('business/:businessId')
  listForBusiness(@Param('businessId') businessId: string) {
    return this.svc.listForBusiness(businessId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }
}
