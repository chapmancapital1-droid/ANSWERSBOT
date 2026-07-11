import { describe, it, expect } from 'vitest';
import { computeScore, type BusinessSignals } from './scoring';

function signals(partial: Partial<BusinessSignals['queries'][0]>[] = []): BusinessSignals {
  return {
    businessName: 'Acme Roofing',
    category: 'roofing',
    city: 'Austin',
    queries: partial.map((q) => ({
      queryText: 'best roofing Austin',
      mentioned: false,
      rankPosition: null,
      competitors: [],
      hasCitationsForYou: false,
      sentiment: 'NEUTRAL',
      ...q,
    })),
  };
}

describe('computeScore', () => {
  it('scores near-zero when no queries (neutral sentiment baseline only)', () => {
    const r = computeScore(signals());
    // appearance/rank/citation = 0; sentiment defaults to 0.5 → ~8 overall
    expect(r.score).toBeLessThan(15);
    expect(r.breakdown.appearanceRate).toBe(0);
  });

  it('scores high when always mentioned at rank 1 with citations', () => {
    const r = computeScore(
      signals([
        {
          mentioned: true,
          rankPosition: 1,
          hasCitationsForYou: true,
          sentiment: 'POSITIVE',
          competitors: ['Other Co'],
        },
        {
          mentioned: true,
          rankPosition: 1,
          hasCitationsForYou: true,
          sentiment: 'POSITIVE',
          competitors: [],
        },
      ]),
    );
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.breakdown.appearanceRate).toBe(1);
  });

  it('scores lower when never mentioned', () => {
    const r = computeScore(
      signals([
        { mentioned: false, competitors: ['Rival A'] },
        { mentioned: false, competitors: ['Rival B'] },
      ]),
    );
    expect(r.score).toBeLessThan(30);
    expect(r.breakdown.appearanceRate).toBe(0);
  });
});
