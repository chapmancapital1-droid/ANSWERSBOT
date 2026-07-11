import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';
import { sendAlertEmail } from '../alerts/mailer';

type PlanKey = 'STARTER' | 'PRO' | 'AGENCY';

@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
  ) {}

  private stripeConfigured() {
    const k = process.env.STRIPE_SECRET_KEY;
    return Boolean(k && !k.includes('...') && k.startsWith('sk_'));
  }

  private priceId(plan: PlanKey) {
    const map: Record<PlanKey, string | undefined> = {
      STARTER: process.env.STRIPE_PRICE_STARTER,
      PRO: process.env.STRIPE_PRICE_PRO,
      AGENCY: process.env.STRIPE_PRICE_AGENCY,
    };
    return map[plan];
  }

  async createCheckout(opts: {
    organizationId: string;
    email: string;
    plan?: PlanKey;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    const plan: PlanKey = opts.plan || 'STARTER';
    const base =
      process.env.WEB_ORIGIN?.split(',')[0] ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3001';
    const successUrl =
      opts.successUrl ||
      `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = opts.cancelUrl || `${base}/pricing`;

    // Dev mock when Stripe not configured
    if (!this.stripeConfigured()) {
      this.log.warn('Stripe not configured — returning mock checkout URL');
      return {
        mode: 'mock' as const,
        url: `${base}/billing/mock-checkout?plan=${plan}&org=${opts.organizationId}`,
        plan,
      };
    }

    const price = this.priceId(plan);
    if (!price || price.includes('...')) {
      throw new BadRequestException(
        `Missing STRIPE_PRICE_${plan} in environment`,
      );
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: opts.organizationId },
    });

    let customerId = org.stripeCustomerId;
    if (!customerId || customerId === 'demo') {
      const customer = await this.stripePost('/v1/customers', {
        email: opts.email,
        name: org.name,
        'metadata[organizationId]': org.id,
      });
      customerId = customer.id;
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      });
    }

    if (!customerId) {
      throw new BadRequestException('Stripe customer missing');
    }

    const session = await this.stripePost('/v1/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'subscription_data[trial_period_days]':
        process.env.STRIPE_TRIAL_DAYS || '14',
      'metadata[organizationId]': org.id,
      'metadata[plan]': plan,
      'subscription_data[metadata][organizationId]': org.id,
      'subscription_data[metadata][plan]': plan,
    });

    return { mode: 'stripe' as const, url: session.url as string, plan, id: session.id };
  }

  /** Stripe Customer Billing Portal (cancel / payment method / invoices). */
  async createPortal(opts: { organizationId: string; returnUrl?: string }) {
    const base =
      process.env.WEB_ORIGIN?.split(',')[0] ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3001';
    const returnUrl = opts.returnUrl || `${base}/pricing`;

    if (!this.stripeConfigured()) {
      this.log.warn('Stripe not configured — returning mock portal URL');
      return {
        mode: 'mock' as const,
        url: `${base}/billing/success?portal=mock`,
      };
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: opts.organizationId },
    });
    if (!org.stripeCustomerId || org.stripeCustomerId === 'demo') {
      throw new BadRequestException(
        'No Stripe customer on this organization. Complete checkout first.',
      );
    }

    const session = await this.stripePost('/v1/billing_portal/sessions', {
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return {
      mode: 'stripe' as const,
      url: session.url as string,
    };
  }

  /** Local-only activation when Stripe keys are absent. */
  async mockActivate(organizationId: string, plan: PlanKey = 'STARTER') {
    // Fail closed: never allow mock paid access in production.
    // Outside production, require ALLOW_MOCK_BILLING=true (default true in non-prod for DX).
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Mock activate is disabled in production');
    }
    if (process.env.ALLOW_MOCK_BILLING === 'false') {
      throw new BadRequestException(
        'Mock activate disabled. Set ALLOW_MOCK_BILLING=true for local billing tests.',
      );
    }
    const fakeSubId = `sub_mock_${organizationId.slice(0, 8)}_${Date.now()}`;
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan, status: 'TRIALING' },
    });
    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: fakeSubId },
      update: { plan, status: 'TRIALING' },
      create: {
        organizationId,
        stripeSubscriptionId: fakeSubId,
        plan,
        status: 'TRIALING',
        currentPeriodEnd: new Date(Date.now() + 14 * 864e5),
      },
    });
    return this.entitlements.status(organizationId);
  }

  async handleWebhook(rawBody: Buffer, sig: string | undefined) {
    if (!this.stripeConfigured()) {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('Stripe is not configured');
      }
      this.log.warn('Webhook ignored — Stripe not configured');
      return { received: true, ignored: true };
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const secretOk = Boolean(secret && !secret.includes('...'));
    if (process.env.NODE_ENV === 'production' && !secretOk) {
      throw new BadRequestException(
        'STRIPE_WEBHOOK_SECRET is required in production',
      );
    }
    if (secretOk) {
      this.verifyStripeSignature(rawBody, sig || '', secret!);
    } else {
      this.log.warn(
        'STRIPE_WEBHOOK_SECRET unset — accepting unsigned webhook (dev only)',
      );
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    // Avoid logging full payloads (may contain email / customer PII)
    this.log.log(`Stripe event ${event.type} id=${event.id ?? 'unknown'}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.metadata?.organizationId as string | undefined;
        const plan = (session.metadata?.plan as PlanKey) || 'STARTER';
        if (orgId && session.subscription) {
          await this.applySubscription(orgId, String(session.subscription), plan, 'TRIALING');
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const orgId = sub.metadata?.organizationId as string | undefined;
        const plan = (sub.metadata?.plan as PlanKey) || 'STARTER';
        const status = this.mapStripeStatus(sub.status);
        if (orgId) {
          await this.applySubscription(orgId, sub.id, plan, status, sub.current_period_end);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const orgId = sub.metadata?.organizationId as string | undefined;
        if (orgId) {
          await this.prisma.organization.update({
            where: { id: orgId },
            data: { status: 'CANCELED', plan: 'STARTER' },
          });
          await this.prisma.subscription.updateMany({
            where: { stripeSubscriptionId: sub.id },
            data: { status: 'CANCELED' },
          });
        }
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object;
        const orgId = sub.metadata?.organizationId as string | undefined;
        if (orgId) {
          await this.notifyTrialEnding(orgId, sub);
        }
        break;
      }
      default:
        break;
    }
    return { received: true };
  }

  /** Stripe fires ~3 days before trial ends. */
  private async notifyTrialEnding(organizationId: string, sub: any) {
    const users = await this.prisma.user.findMany({
      where: { organizationId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { email: true, name: true },
    });
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, plan: true },
    });
    const trialEnd = sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10)
      : 'soon';
    const base =
      process.env.WEB_ORIGIN?.split(',')[0] ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3001';
    const recipients = users.map((u) => u.email).filter(Boolean);
    if (!recipients.length) {
      this.log.warn(`trial_will_end: no recipients for org ${organizationId}`);
      return;
    }
    const subject = `Your Answerspot trial ends ${trialEnd}`;
    const text = [
      `Hi${users[0]?.name ? ` ${users[0].name}` : ''},`,
      ``,
      `Your ${org?.plan || 'Answerspot'} trial for ${org?.name || 'your workspace'} ends on ${trialEnd}.`,
      ``,
      `Add a payment method or upgrade to keep scans, scores, and competitor tracking:`,
      `${base}/pricing`,
      ``,
      `Manage billing anytime: ${base}/pricing (Manage subscription)`,
      ``,
      `— Answerspot`,
    ].join('\n');

    const result = await sendAlertEmail({ to: recipients, subject, text });
    this.log.log(
      `trial_will_end email org=${organizationId} mode=${result.mode} ok=${result.ok}`,
    );

    // Best-effort audit row on first business if present
    const biz = await this.prisma.business.findFirst({
      where: { organizationId, deletedAt: null },
      select: { id: true },
    });
    if (biz) {
      await this.prisma.alert.create({
        data: {
          businessId: biz.id,
          type: 'TRIAL_WILL_END',
          channel: 'EMAIL',
          payload: {
            kind: 'TRIAL_WILL_END',
            trialEnd,
            emailOk: result.ok,
            mode: result.mode,
          },
          sentAt: result.ok ? new Date() : null,
        },
      });
    }
  }

  private async applySubscription(
    organizationId: string,
    stripeSubscriptionId: string,
    plan: PlanKey,
    status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE',
    periodEndUnix?: number,
  ) {
    const orgStatus =
      status === 'ACTIVE' || status === 'TRIALING'
        ? status
        : status === 'PAST_DUE'
          ? 'PAST_DUE'
          : 'CANCELED';

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan, status: orgStatus },
    });

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId },
      update: {
        plan,
        status,
        currentPeriodEnd: periodEndUnix
          ? new Date(periodEndUnix * 1000)
          : undefined,
      },
      create: {
        organizationId,
        stripeSubscriptionId,
        plan,
        status,
        currentPeriodEnd: periodEndUnix
          ? new Date(periodEndUnix * 1000)
          : new Date(Date.now() + 14 * 864e5),
      },
    });
  }

  private mapStripeStatus(
    s: string,
  ): 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' {
    switch (s) {
      case 'active':
        return 'ACTIVE';
      case 'trialing':
        return 'TRIALING';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
      case 'unpaid':
        return 'CANCELED';
      default:
        return 'INCOMPLETE';
    }
  }

  private verifyStripeSignature(raw: Buffer, header: string, secret: string) {
    // Stripe-Signature: t=timestamp,v1=signature
    const parts = Object.fromEntries(
      header.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k.trim(), v];
      }),
    );
    const t = parts['t'];
    const v1 = parts['v1'];
    if (!t || !v1) throw new BadRequestException('Invalid Stripe signature header');

    const payload = `${t}.${raw.toString('utf8')}`;
    const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const a = Buffer.from(v1);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException('Stripe signature mismatch');
    }
    // Reject stale timestamps (>5 min)
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) {
      throw new BadRequestException('Stripe signature timestamp too old');
    }
  }

  private async stripePost(path: string, fields: Record<string, string>) {
    const key = process.env.STRIPE_SECRET_KEY!;
    const body = new URLSearchParams(fields);
    const res = await fetch(`https://api.stripe.com${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await res.json();
    if (!res.ok) {
      this.log.error(`Stripe ${path} failed: ${JSON.stringify(data)}`);
      throw new ServiceUnavailableException(
        data?.error?.message || `Stripe error ${res.status}`,
      );
    }
    return data;
  }
}
