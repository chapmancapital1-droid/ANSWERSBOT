/**
 * Heuristic extraction from free-text AI answers.
 * No second LLM required for MVP; good enough for mention/rank/competitors.
 */

export type ParsedAnswer = {
  mentioned: boolean;
  rankPosition: number | null;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'UNKNOWN';
  confidence: number;
  citations: { url: string; title?: string }[];
  competitors: { name: string; rank_position?: number }[];
};

const POSITIVE =
  /\b(recommend|top[- ]rated|highly rated|excellent|trusted|reliable|best choice|great option|well known)\b/i;
const NEGATIVE =
  /\b(avoid|poor|scam|unreliable|complaints|lawsuit|worst|overpriced|do not hire)\b/i;

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseAnswer(opts: {
  text: string;
  businessName: string;
  knownCompetitors?: string[];
}): ParsedAnswer {
  const text = opts.text || '';
  const biz = opts.businessName.trim();
  const bizRe = new RegExp(escapeRe(biz), 'i');
  const mentioned = bizRe.test(text);

  // Rank: look for "1. Business" or "1) Business" or "#1 Business"
  let rankPosition: number | null = null;
  if (mentioned) {
    const numbered = [
      ...text.matchAll(
        /(?:^|\n)\s*(?:#)?(\d{1,2})[.):\-\s]+([^\n]{2,80})/g,
      ),
    ];
    for (const m of numbered) {
      if (new RegExp(escapeRe(biz), 'i').test(m[2])) {
        rankPosition = Number(m[1]);
        break;
      }
    }
    if (rankPosition == null) {
      // First mention earlier in text → assume better rank
      const idx = text.search(bizRe);
      rankPosition = idx < text.length * 0.25 ? 1 : idx < text.length * 0.5 ? 2 : 3;
    }
  }

  let sentiment: ParsedAnswer['sentiment'] = 'UNKNOWN';
  if (mentioned) {
    const windowStart = Math.max(0, text.search(bizRe) - 80);
    const window = text.slice(windowStart, windowStart + 200);
    if (NEGATIVE.test(window)) sentiment = 'NEGATIVE';
    else if (POSITIVE.test(window)) sentiment = 'POSITIVE';
    else sentiment = 'NEUTRAL';
  }

  // Competitors: numbered list lines that aren't the business
  const competitors: { name: string; rank_position?: number }[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/(?:^|\n)\s*(?:#)?(\d{1,2})[.):\-\s]+\*{0,2}([A-Z][^\n*•]{2,60})/g)) {
    const name = m[2].replace(/\*+/g, '').split(/[—\-–|:]/)[0].trim();
    const key = normalizeName(name);
    if (!key || key.includes(normalizeName(biz)) || seen.has(key)) continue;
    if (name.length < 3 || name.length > 60) continue;
    seen.add(key);
    competitors.push({ name, rank_position: Number(m[1]) });
  }

  // Known competitor hints
  for (const c of opts.knownCompetitors || []) {
    if (new RegExp(escapeRe(c), 'i').test(text) && !seen.has(normalizeName(c))) {
      competitors.push({ name: c });
      seen.add(normalizeName(c));
    }
  }

  // URLs as citations
  const citations: { url: string; title?: string }[] = [];
  for (const m of text.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
    citations.push({ url: m[0].replace(/[.,;]+$/, '') });
  }

  const confidence = mentioned
    ? rankPosition != null
      ? 0.78
      : 0.65
    : 0.55;

  return {
    mentioned,
    rankPosition,
    sentiment,
    confidence,
    citations: citations.slice(0, 8),
    competitors: competitors.slice(0, 8),
  };
}
