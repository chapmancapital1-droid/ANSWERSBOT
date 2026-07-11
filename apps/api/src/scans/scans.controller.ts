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
  @Post('trigger') trigger(@Body() body: { trackedQueryId: string; platformKeys?: string[] }) {
    return this.svc.trigger(body);
  }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
}
