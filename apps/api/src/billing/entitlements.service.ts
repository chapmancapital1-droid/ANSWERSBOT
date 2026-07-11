import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FREE_BUSINESS_LIMIT,
  freeTierBlocksBusinessCreate,
  freeTierBlocksRescan,
  monthWindowUtc,
  monthlyQuotaExceeded,
  monthlyScanJobLimit,
  orgHasPaidAccess,
  PLAN_MONTHLY_SCAN_JOB_LIMITS,
  PLAN_SEAT_LIMITS,
} from './entitlements.pure';
import { BudgetService } from './budget.service';

export { FREE_BUSINESS_LIMIT, PLAN_MONTHLY_SCAN_JOB_LIMITS, PLAN_SEAT_LIMITS };

@Injectable()
export class EntitlementsService {
  constructor(
    private prisma: PrismaService,
    private budget: BudgetService,
  ) {}

  async getOrg(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      include: {
        subscriptions: { orderBy: { updatedAt: 'desc' }, take: 3 },
        _count: { select: { businesses: true, memberships: true } },
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
    const org = await this.getOrg(organizationId);
    const paid = orgHasPaidAccess(org);
    const isDemo = org.stripeCustomerId === 'demo';

    // Free tier: one successful scan batch (prior DONE rows) per business
    if (!paid) {
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
      return;
    }

    // Paid / trial: monthly scan-job quota by plan (demo unlimited)
    const limit = monthlyScanJobLimit(org.plan, isDemo);
    const usage = await this.scanJobsThisMonth(organizationId);
    if (monthlyQuotaExceeded(usage, limit)) {
      throw new ForbiddenException({
        code: 'QUOTA_SCANS_MONTHLY',
        message: `Monthly scan limit reached (${limit} scan jobs on ${org.plan}). Upgrade plan or wait until next month.`,
        upgradeRequired: true,
        limit,
        used: usage,
        plan: org.plan,
      });
    }
  }

  async scanJobsThisMonth(organizationId: string) {
    const { start, end } = monthWindowUtc();
    return this.prisma.scanJob.count({
      where: {
        organizationId,
        createdAt: { gte: start, lt: end },
        status: { in: ['QUEUED', 'RUNNING', 'DONE'] },
      },
    });
  }

  async status(organizationId: string) {
    const org = await this.getOrg(organizationId);
    const paid = await this.hasPaidAccess(organizationId);
    const isDemo = org.stripeCustomerId === 'demo';
    const monthlyLimit = monthlyScanJobLimit(org.plan, isDemo || !paid);
    // Free shows free-scan semantics; paid shows job quota
    const jobsThisMonth = paid
      ? await this.scanJobsThisMonth(organizationId)
      : 0;

    const budget = await this.budget.getMeter(organizationId);
    const seatLimit = PLAN_SEAT_LIMITS[org.plan] ?? 1;

    return {
      plan: org.plan,
      status: org.status,
      paid,
      freeBusinessLimit: FREE_BUSINESS_LIMIT,
      businessCount: org._count.businesses,
      seats: {
        used: org._count.memberships,
        limit: seatLimit,
      },
      usage: {
        scanJobsThisMonth: jobsThisMonth,
        monthlyScanJobLimit: paid ? monthlyLimit : null,
        budget,
      },
      limits: {
        scanJobs: PLAN_MONTHLY_SCAN_JOB_LIMITS,
        seats: PLAN_SEAT_LIMITS,
      },
      subscription:
        org.subscriptions.find((s) =>
          ['ACTIVE', 'TRIALING'].includes(s.status),
        ) ||
        org.subscriptions[0] ||
        null,
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
