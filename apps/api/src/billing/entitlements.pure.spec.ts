import { describe, it, expect } from 'vitest';
import {
  orgHasPaidAccess,
  freeTierBlocksBusinessCreate,
  freeTierBlocksRescan,
  monthlyQuotaExceeded,
  monthlyScanJobLimit,
  seatLimitExceeded,
  budgetExceeded,
  estimateLiveCallCost,
  PLAN_SEAT_LIMITS,
} from './entitlements.pure';

describe('orgHasPaidAccess', () => {
  it('allows demo org', () => {
    expect(
      orgHasPaidAccess({ stripeCustomerId: 'demo', subscriptions: [] }),
    ).toBe(true);
  });

  it('allows ACTIVE or TRIALING sub', () => {
    expect(
      orgHasPaidAccess({
        stripeCustomerId: 'cus_x',
        subscriptions: [{ status: 'TRIALING' }],
      }),
    ).toBe(true);
    expect(
      orgHasPaidAccess({
        stripeCustomerId: null,
        subscriptions: [{ status: 'ACTIVE' }],
      }),
    ).toBe(true);
  });

  it('denies canceled / no sub', () => {
    expect(
      orgHasPaidAccess({
        stripeCustomerId: null,
        subscriptions: [{ status: 'CANCELED' }],
      }),
    ).toBe(false);
    expect(orgHasPaidAccess({ subscriptions: [] })).toBe(false);
  });
});

describe('free tier gates', () => {
  it('blocks second business on free', () => {
    expect(freeTierBlocksBusinessCreate(false, 1)).toBe(true);
    expect(freeTierBlocksBusinessCreate(false, 0)).toBe(false);
    expect(freeTierBlocksBusinessCreate(true, 5)).toBe(false);
  });

  it('blocks rescan after first DONE scan on free', () => {
    expect(freeTierBlocksRescan(false, 1)).toBe(true);
    expect(freeTierBlocksRescan(false, 0)).toBe(false);
    expect(freeTierBlocksRescan(true, 10)).toBe(false);
  });
});

describe('monthly scan job quota', () => {
  it('sets plan limits', () => {
    expect(monthlyScanJobLimit('STARTER')).toBe(100);
    expect(monthlyScanJobLimit('PRO')).toBe(500);
    expect(monthlyScanJobLimit('AGENCY')).toBeNull();
    expect(monthlyScanJobLimit('STARTER', true)).toBeNull();
  });

  it('blocks when at or over limit', () => {
    expect(monthlyQuotaExceeded(100, 100)).toBe(true);
    expect(monthlyQuotaExceeded(99, 100)).toBe(false);
    expect(monthlyQuotaExceeded(999, null)).toBe(false);
  });
});

describe('agency seats', () => {
  it('limits seats by plan', () => {
    expect(PLAN_SEAT_LIMITS.STARTER).toBe(1);
    expect(PLAN_SEAT_LIMITS.PRO).toBe(3);
    expect(PLAN_SEAT_LIMITS.AGENCY).toBe(25);
    expect(seatLimitExceeded(1, 1)).toBe(true);
    expect(seatLimitExceeded(2, 3)).toBe(false);
    expect(seatLimitExceeded(100, null)).toBe(false);
  });
});

describe('budget', () => {
  it('tracks SERP costs higher than chat', () => {
    expect(estimateLiveCallCost('AI_OVERVIEW')).toBeGreaterThan(
      estimateLiveCallCost('CHATGPT'),
    );
    expect(budgetExceeded(500, 500)).toBe(true);
    expect(budgetExceeded(100, 500)).toBe(false);
    expect(budgetExceeded(9999, null)).toBe(false);
  });
});
