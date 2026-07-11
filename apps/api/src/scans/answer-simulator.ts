import { createHash } from 'crypto';

/**
 * Deterministic stub "AI answers" for local demos without platform API keys.
 * Hash of (business, query, platform) controls mention/rank so the product loop
 * is stable across reloads but still shows realistic gaps.
 */

const GENERIC_COMPETITORS = [
  'Precision Pros',
  'Cityline Services',
  'Summit Local Co',
  'Harbor & Sons',
  'Apex Neighborhood',
];

function hashInt(s: string): number {
  const h = createHash('sha256').update(s).digest();
  return h.readUInt32BE(0);
}

export type SimulatedAnswer = {
  platformKey: string;
  text: string;
  mentioned: boolean;
  rankPosition: number | null;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'UNKNOWN';
  confidence: number;
  citations: { url: string; title: string }[];
  competitors: { name: string; rank_position: number }[];
};

export function simulateAnswer(opts: {
  platformKey: string;
  queryText: string;
  businessName: string;
  category: string;
  city: string;
}): SimulatedAnswer {
  const seed = `${opts.platformKey}|${opts.queryText}|${opts.businessName}`;
  const n = hashInt(seed);
  const mentionRoll = n % 100;
  // ~55% mention rate overall — enough "wins" and "gaps"
  const mentioned = mentionRoll < 55;

  const comps = GENERIC_COMPETITORS.map((base, i) => ({
    name: `${base} ${opts.category}`.replace(/\s+/g, ' ').trim(),
    rank_position: i + 1,
  })).slice(0, 2 + (n % 3));

  let rankPosition: number | null = null;
  let sentiment: SimulatedAnswer['sentiment'] = 'NEUTRAL';
  const competitors = comps.map((c) => ({ ...c }));

  if (mentioned) {
    rankPosition = 1 + (n % 4);
    // Shift competitor ranks around the business
    competitors.forEach((c, i) => {
      c.rank_position = i + 1 >= rankPosition! ? i + 2 : i + 1;
    });
    sentiment = n % 11 === 0 ? 'NEGATIVE' : n % 3 === 0 ? 'NEUTRAL' : 'POSITIVE';
  }

  const lines: string[] = [];
  lines.push(
    `When looking for ${opts.queryText}, here are options people often consider in ${opts.city}:`,
  );

  const ordered: { name: string; note: string }[] = [];
  if (mentioned && rankPosition) {
    const note =
      sentiment === 'POSITIVE'
        ? 'frequently praised for reliability and clear pricing'
        : sentiment === 'NEGATIVE'
          ? 'mixed recent feedback — response times have been a concern'
          : 'a local option with solid coverage of the area';
    ordered.push({ name: opts.businessName, note });
  }
  for (const c of competitors) {
    ordered.push({
      name: c.name,
      note: 'appears often in local directories and review sites',
    });
  }
  ordered.sort((a, b) => {
    const ra =
      a.name === opts.businessName
        ? rankPosition ?? 99
        : competitors.find((c) => c.name === a.name)?.rank_position ?? 99;
    const rb =
      b.name === opts.businessName
        ? rankPosition ?? 99
        : competitors.find((c) => c.name === b.name)?.rank_position ?? 99;
    return ra - rb;
  });

  ordered.forEach((o, i) => {
    lines.push(`${i + 1}. **${o.name}** — ${o.note}.`);
  });

  if (!mentioned) {
    lines.push(
      `I did not find a strong match for "${opts.businessName}" in the top local results for this query.`,
    );
  }

  lines.push(
    `Sources typically include Google Business profiles, Angi/Yelp-style review sites, and local directories for ${opts.city}.`,
  );

  const citations = [
    {
      url: `https://www.google.com/maps/search/${encodeURIComponent(opts.category + ' ' + opts.city)}`,
      title: `${opts.category} near ${opts.city} — Maps`,
    },
    {
      url: `https://www.yelp.com/search?find_desc=${encodeURIComponent(opts.category)}&find_loc=${encodeURIComponent(opts.city)}`,
      title: `Yelp ${opts.category} ${opts.city}`,
    },
  ];
  if (mentioned) {
    citations.unshift({
      url: `https://example.com/${opts.businessName.toLowerCase().replace(/\s+/g, '-')}`,
      title: opts.businessName,
    });
  }

  return {
    platformKey: opts.platformKey,
    text: lines.join('\n'),
    mentioned,
    rankPosition,
    sentiment,
    confidence: mentioned ? 0.72 + (n % 20) / 100 : 0.55 + (n % 15) / 100,
    citations,
    competitors: competitors.map((c) => ({
      name: c.name,
      rank_position: c.rank_position,
    })),
  };
}
