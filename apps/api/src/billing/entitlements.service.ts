import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FREE_BUSINESS_LIMIT,
  freeTierBlocksBusinessCreate,
  freeTierBlocksRescan,
  orgHasPaidAccess,
} from './entitlements.pure';

export { FREE_BUSINESS_LIMIT };

@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  async getOrg(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        subscriptions: { orderBy: { updatedAt: 'desc' }, take: 3 },
        _count: { select: { businesses: true } },
      },
    });
  }

  async hasPaidAccess(organizationId: string): Promise<boolean> {
    const org = await this.getOrg(organizationId);
    return orgHasPaidAccess(org);
  }

  async assertCanCreateBusiness(organizationId: string) {
    const org = await this.getOrg(organizationId);
    const paid = orgHasPaidAccess(org);
    if (freeTierBlocksBusinessCreate(paid, org._count.businesses)) {
      throw new ForbiddenException({
        code: 'PAYWALL_BUSINESS_LIMIT',
        message:
          'Free tier includes 1 business. Start a Starter trial to add more locations.',
        upgradeRequired: true,
      });
    }
  }

  async assertCanScan(organizationId: string, businessId: string) {
    if (await this.hasPaidAccess(organizationId)) return;

    const prior = await this.prisma.scan.count({
      where: {
        status: 'DONE',
        trackedQuery: { businessId },
      },
    });
    if (freeTierBlocksRescan(false, prior)) {
      throw new ForbiddenException({
        code: 'PAYWALL_RESCAN',
        message:
          'Your free scan is used. Start a Starter trial to re-scan and track changes over time.',
        upgradeRequired: true,
      });
    }
  }

  async status(organizationId: string) {
    const org = await this.getOrg(organizationId);
    const paid = await this.hasPaidAccess(organizationId);
    return {
      plan: org.plan,
      status: org.status,
      paid,
      freeBusinessLimit: FREE_BUSINESS_LIMIT,
      businessCount: org._count.businesses,
      subscription: org.subscriptions.find((s) =>
        ['ACTIVE', 'TRIALING'].includes(s.status),
      ) || org.subscriptions[0] || null,
      prices: {
        starter: process.env.STRIPE_PRICE_STARTER || null,
        pro: process.env.STRIPE_PRICE_PRO || null,
        agency: process.env.STRIPE_PRICE_AGENCY || null,
      },
      stripeConfigured: Boolean(
        process.env.STRIPE_SECRET_KEY &&
          !process.env.STRIPE_SECRET_KEY.includes('...') &&
          process.env.STRIPE_SECRET_KEY.startsWith('sk_'),
      ),
    };
  }
}
