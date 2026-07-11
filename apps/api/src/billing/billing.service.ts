import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);
  constructor(private prisma: PrismaService) {}
  async handleWebhook(_rawBody: Buffer, _sig: string) {
    // TODO(M6): verify signature with STRIPE_WEBHOOK_SECRET, then upsert
    // Subscription rows on created/updated/deleted events.
    this.log.log('Stripe webhook received');
    return { received: true };
  }
}
