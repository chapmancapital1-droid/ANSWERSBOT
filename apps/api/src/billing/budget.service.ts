import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  budgetExceeded,
  estimateLiveCallCost,
  monthWindowUtc,
} from './entitlements.pure';

@Injectable()
export class BudgetService {
  private readonly log = new Logger(BudgetService.name);

  constructor(private prisma: PrismaService) {}

  monthlyBudgetUsd(): number {
    const n = Number(process.env.SCAN_MONTHLY_BUDGET_USD || 500);
    return Number.isFinite(n) && n > 0 ? n : 500;
  }

  private periodStart(now = new Date()) {
    return monthWindowUtc(now).start;
  }

  async getMeter(organizationId: string) {
    const periodStart = this.periodStart();
    let meter = await this.prisma.usageMeter.findUnique({
      where: {
        organizationId_periodStart: { organizationId, periodStart },
      },
    });
    if (!meter) {
      meter = await this.prisma.usageMeter.create({
        data: {
          organizationId,
          periodStart,
          liveCalls: 0,
          serpCalls: 0,
          estimatedCostUsd: 0,
        },
      });
    }
    const spent = Number(meter.estimatedCostUsd);
    const budget = this.monthlyBudgetUsd();
    return {
      periodStart,
      liveCalls: meter.liveCalls,
      serpCalls: meter.serpCalls,
      estimatedCostUsd: spent,
      budgetUsd: budget,
      remainingUsd: Math.max(0, budget - spent),
      exceeded: budgetExceeded(spent, budget),
    };
  }

  async assertWithinBudget(organizationId: string) {
    const meter = await this.getMeter(organizationId);
    if (meter.exceeded) {
      throw new ForbiddenException({
        code: 'BUDGET_MONTHLY',
        message: `Monthly live-API budget exhausted ($${meter.budgetUsd}). Wait until next month or raise SCAN_MONTHLY_BUDGET_USD.`,
        ...meter,
      });
    }
    return meter;
  }

  async recordLiveCalls(
    organizationId: string,
    calls: { platformKey: string; source: 'live' | 'stub' }[],
  ) {
    const live = calls.filter((c) => c.source === 'live');
    if (!live.length) return this.getMeter(organizationId);

    let cost = 0;
    let serp = 0;
    for (const c of live) {
      cost += estimateLiveCallCost(c.platformKey);
      if (c.platformKey === 'AI_OVERVIEW') serp++;
    }

    const periodStart = this.periodStart();
    try {
      await this.prisma.usageMeter.upsert({
        where: {
          organizationId_periodStart: { organizationId, periodStart },
        },
        create: {
          organizationId,
          periodStart,
          liveCalls: live.length,
          serpCalls: serp,
          estimatedCostUsd: cost,
        },
        update: {
          liveCalls: { increment: live.length },
          serpCalls: { increment: serp },
          estimatedCostUsd: { increment: cost },
        },
      });
    } catch (e: any) {
      this.log.warn(`usage meter update failed: ${e?.message}`);
    }
    return this.getMeter(organizationId);
  }
}
