/** Pure entitlement helpers — unit-tested without Prisma. */

export const FREE_BUSINESS_LIMIT = 1;

/** Monthly scan-job limits by plan. null = unlimited. Demo org bypasses. */
export const PLAN_MONTHLY_SCAN_JOB_LIMITS: Record<string, number | null> = {
  STARTER: 100,
  PRO: 500,
  AGENCY: null,
};

export type SubStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';

export function orgHasPaidAccess(org: {
  stripeCustomerId?: string | null;
  subscriptions: { status: string }[];
}): boolean {
  // Seeded demo org — unlimited for product demos
  if (org.stripeCustomerId === 'demo') return true;
  return org.subscriptions.some((s) =>
    ['ACTIVE', 'TRIALING'].includes(s.status),
  );
}

export function freeTierBlocksBusinessCreate(
  paid: boolean,
  businessCount: number,
  limit = FREE_BUSINESS_LIMIT,
): boolean {
  if (paid) return false;
  return businessCount >= limit;
}

export function freeTierBlocksRescan(
  paid: boolean,
  priorDoneScans: number,
): boolean {
  if (paid) return false;
  return priorDoneScans > 0;
}

export function monthlyScanJobLimit(
  plan: string,
  isDemo = false,
): number | null {
  if (isDemo) return null;
  if (Object.prototype.hasOwnProperty.call(PLAN_MONTHLY_SCAN_JOB_LIMITS, plan)) {
    return PLAN_MONTHLY_SCAN_JOB_LIMITS[plan];
  }
  return PLAN_MONTHLY_SCAN_JOB_LIMITS.STARTER ?? 100;
}

/** Returns true if another scan job would exceed the plan monthly cap. */
export function monthlyQuotaExceeded(
  jobsThisMonth: number,
  limit: number | null,
): boolean {
  if (limit == null) return false;
  return jobsThisMonth >= limit;
}

export function monthWindowUtc(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
