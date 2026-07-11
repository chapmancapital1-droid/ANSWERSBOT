import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { OrgScopeGuard } from '../common/guards/org-scope.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('businesses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), OrgScopeGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly svc: BusinessesService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.svc.create(u.organizationId, dto);
  }

  /** M1: create business + auto queries + first scan */
  @Post('onboard')
  onboard(
    @CurrentUser() u: AuthUser,
    @Body() dto: CreateBusinessDto & { runScan?: boolean },
  ) {
    return this.svc.onboard(u.organizationId, dto);
  }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() page: PaginationDto) {
    return this.svc.list(u.organizationId, page);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Get(':id/visibility-score')
  visibilityScore(@Param('id') id: string) {
    return this.svc.visibilityScore(id);
  }

  @Get(':id/competitors')
  competitors(@Param('id') id: string) {
    return this.svc.competitors(id);
  }

  @Get(':id/recommendations')
  recommendations(@Param('id') id: string) {
    return this.svc.recommendations(id);
  }
}
