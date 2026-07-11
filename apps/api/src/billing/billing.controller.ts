import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post('webhooks/stripe')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
    return this.billing.handleWebhook(raw, sig);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('billing/status')
  status(@CurrentUser() u: AuthUser) {
    return this.entitlements.status(u.organizationId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('billing/checkout')
  checkout(
    @CurrentUser() u: AuthUser,
    @Body() body: { plan?: 'STARTER' | 'PRO' | 'AGENCY'; successUrl?: string; cancelUrl?: string },
  ) {
    return this.billing.createCheckout({
      organizationId: u.organizationId,
      email: u.email,
      plan: body.plan || 'STARTER',
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  /** Dev mock when Stripe keys are missing */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('billing/mock-activate')
  mockActivate(
    @CurrentUser() u: AuthUser,
    @Body() body: { plan?: 'STARTER' | 'PRO' | 'AGENCY' },
  ) {
    return this.billing.mockActivate(u.organizationId, body.plan || 'STARTER');
  }
}
