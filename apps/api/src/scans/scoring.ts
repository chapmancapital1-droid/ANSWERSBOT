export type QuerySignal = {
  queryText: string;
  mentioned: boolean;
  rankPosition: number | null;
  competitors: string[];
  hasCitationsForYou: boolean;
  sentiment: string;
};

export type BusinessSignals = {
  businessName: string;
  category: string;
  city: string;
  queries: QuerySignal[];
};

const WEIGHTS = { w1: 0.4, w2: 0.3, w3: 0.15, w4: 0.15 };
export const WEIGHTS_VERSION = '2026-07-10';

function appearanceRate(s: BusinessSignals): number {
  if (!s.queries.length) return 0;
  return s.queries.filter((q) => q.mentioned).length / s.queries.length;
}

function rankScore(s: BusinessSignals): number {
  const ranks = s.queries.map((q) => q.rankPosition).filter((r): r is number => r != null);
  if (!ranks.length) return 0;
  return ranks.reduce((a, r) => a + Math.max(0, (6 - r) / 5), 0) / ranks.length;
}

function sentimentScore(s: BusinessSignals): number {
  const vals: Record<string, number> = {
    POSITIVE: 1,
    NEUTRAL: 0.5,
    NEGATIVE: 0,
  };
  const scored = s.queries
    .map((q) => vals[q.sentiment])
    .filter((v): v is number => v !== undefined);
  if (!scored.length) return 0.5;
  return scored.reduce((a, b) => a + b, 0) / scored.length;
}

function citationScore(s: BusinessSignals): number {
  const mentioned = s.queries.filter((q) => q.mentioned);
  if (!mentioned.length) return 0;
  return mentioned.filter((q) => q.hasCitationsForYou).length / mentioned.length;
}

export function computeScore(s: BusinessSignals) {
  const appearance = appearanceRate(s);
  const rank = rankScore(s);
  const sentiment = sentimentScore(s);
  const citation = citationScore(s);
  const raw =
    WEIGHTS.w1 * appearance +
    WEIGHTS.w2 * rank +
    WEIGHTS.w3 * sentiment +
    WEIGHTS.w4 * citation;
  return {
    score: Math.round(raw * 100),
    breakdown: {
      appearanceRate: Math.round(appearance * 1000) / 1000,
      rankScore: Math.round(rank * 1000) / 1000,
      sentimentScore: Math.round(sentiment * 1000) / 1000,
      citationScore: Math.round(citation * 1000) / 1000,
      weights: WEIGHTS,
      weightsVersion: WEIGHTS_VERSION,
    },
  };
}

export function missingQueries(s: BusinessSignals) {
  return s.queries.filter((q) => !q.mentioned);
}

export function topCompetitors(s: BusinessSignals): [string, number][] {
  const c = new Map<string, number>();
  for (const q of s.queries) {
    for (const name of q.competitors) {
      if (name === s.businessName) continue;
      c.set(name, (c.get(name) || 0) + 1);
    }
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]);
}
