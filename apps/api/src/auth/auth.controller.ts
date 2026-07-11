import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Exchange IdP or dev token for app JWT.
   * body: { token, provider?: 'clerk' | 'authjs' | 'dev' }
   */
  @Post('session')
  session(@Body() body: { token: string; provider?: string }) {
    return this.auth.exchange(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('switch-org')
  switchOrg(
    @CurrentUser() user: AuthUser,
    @Body() body: { organizationId: string },
  ) {
    return this.auth.switchOrg(user.id, body.organizationId);
  }
}
