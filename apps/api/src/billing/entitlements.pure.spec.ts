import { describe, it, expect } from 'vitest';
import {
  orgHasPaidAccess,
  freeTierBlocksBusinessCreate,
  freeTierBlocksRescan,
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
