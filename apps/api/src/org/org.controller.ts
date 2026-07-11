import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrgService } from './org.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('org')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('org')
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get('branding')
  branding(@CurrentUser() u: AuthUser) {
    return this.org.getBranding(u.organizationId);
  }

  @Patch('branding')
  updateBranding(
    @CurrentUser() u: AuthUser,
    @Body()
    body: {
      brandName?: string | null;
      brandPrimaryColor?: string | null;
      brandLogoUrl?: string | null;
      brandFooter?: string | null;
    },
  ) {
    return this.org.updateBranding(u.organizationId, u.role, body);
  }

  @Get('members')
  members(@CurrentUser() u: AuthUser) {
    return this.org.listMembers(u.organizationId);
  }

  @Post('invites')
  invite(
    @CurrentUser() u: AuthUser,
    @Body() body: { email: string; role?: 'ADMIN' | 'MEMBER' },
  ) {
    return this.org.invite(u.organizationId, u, body);
  }

  @Post('invites/accept')
  accept(
    @CurrentUser() u: AuthUser,
    @Body() body: { token: string },
  ) {
    return this.org.acceptInvite(u.id, u.email, body.token);
  }

  @Delete('members/:userId')
  remove(
    @CurrentUser() u: AuthUser,
    @Param('userId') userId: string,
  ) {
    return this.org.removeMember(
      u.organizationId,
      u.role,
      userId,
      u.id,
    );
  }
}
