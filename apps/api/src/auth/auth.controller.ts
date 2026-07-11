import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('session') session(@Body() body: { token: string }) { return this.auth.exchange(body.token); }
  @UseGuards(AuthGuard('jwt'))
  @Get('/me') me(@CurrentUser() user: AuthUser) { return this.auth.me(user); }
}
