/** Pure entitlement helpers — unit-tested without Prisma. */

export const FREE_BUSINESS_LIMIT = 1;

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
