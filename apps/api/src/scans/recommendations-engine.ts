import {
  BusinessSignals,
  missingQueries,
  topCompetitors,
  computeScore,
} from './scoring';

export type DraftRec = {
  type:
    | 'KEYWORD_GAP'
    | 'SCHEMA_MARKUP'
    | 'REVIEW_SIGNAL'
    | 'CITATION_GAP'
    | 'SENTIMENT_ISSUE'
    | 'COMPETITOR_OVERTAKE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  impact: number;
  artifact: { kind: 'code' | 'text'; content: string } | null;
};

function keywordSection(queryText: string, category: string, city: string) {
  return {
    kind: 'text' as const,
    content:
      `## ${queryText.replace(/\b\w/g, (c) => c.toUpperCase())}\n\n` +
      `Looking for ${queryText}? Our ${city}-based team specializes in exactly this. ` +
      `We provide professional ${category.toLowerCase()} services with transparent pricing and fast response times.\n`,
  };
}

function faqSchema(category: string, city: string) {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Do you offer emergency ${category.toLowerCase()} service?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes — we offer reliable ${category.toLowerCase()} service across ${city}.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What areas do you serve?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `We serve ${city} and the surrounding area.`,
        },
      },
    ],
  };
  return {
    kind: 'code' as const,
    content:
      '<script type="application/ld+json">\n' +
      JSON.stringify(payload, null, 2) +
      '\n</script>',
  };
}

export function generateRecommendations(s: BusinessSignals): {
  score: ReturnType<typeof computeScore>;
  recommendations: DraftRec[];
} {
  const drafts: DraftRec[] = [];

  const missing = missingQueries(s);
  if (missing.length) {
    const hottest = [...missing].sort(
      (a, b) => b.competitors.length - a.competitors.length,
    )[0];
    const n = hottest.competitors.length;
    drafts.push({
      type: 'KEYWORD_GAP',
      severity: n >= 2 ? 'HIGH' : 'MEDIUM',
      title: `Get listed for "${hottest.queryText}"`,
      message:
        `You don't appear when customers search "${hottest.queryText}"` +
        (n
          ? `, but ${n} competitor${n > 1 ? 's' : ''} do.`
          : '.') +
        ` Add a clear section about this service to your site so AI assistants can find it.`,
      impact: 0.6 + 0.1 * Math.min(n, 3),
      artifact: keywordSection(hottest.queryText, s.category, s.city),
    });
  }

  const citationGaps = s.queries.filter((q) => q.mentioned && !q.hasCitationsForYou);
  if (citationGaps.length >= 2) {
    drafts.push({
      type: 'CITATION_GAP',
      severity: 'HIGH',
      title: 'Add FAQ structured data to your website',
      message: `You're mentioned in ${citationGaps.length} queries but sources rarely back you up. FAQ structured data helps AI assistants quote you directly.`,
      impact: 0.7,
      artifact: faqSchema(s.category, s.city),
    });
  }

  const neg = s.queries.filter((q) => q.sentiment === 'NEGATIVE');
  if (neg.length) {
    drafts.push({
      type: 'SENTIMENT_ISSUE',
      severity: 'CRITICAL',
      title: 'AI is describing you negatively',
      message: `In ${neg.length} quer${neg.length > 1 ? 'ies' : 'y'}, assistants describe your business in a negative light. Investigate review and reputation signals first.`,
      impact: 0.95,
      artifact: null,
    });
  }

  const top = topCompetitors(s);
  if (top.length) {
    const [name, count] = top[0];
    const beats = s.queries.filter(
      (q) => q.competitors.includes(name) && !q.mentioned,
    );
    if (beats.length >= 2) {
      drafts.push({
        type: 'COMPETITOR_OVERTAKE',
        severity: 'HIGH',
        title: `${name} is winning your slots`,
        message: `${name} appears in ${count} of your queries and beats you in ${beats.length} of them. Focus improvements where they're pulling ahead.`,
        impact: 0.65,
        artifact: null,
      });
    }
  }

  // Always offer a review-response nudge when appearance is weak
  if (appearanceWeak(s)) {
    drafts.push({
      type: 'REVIEW_SIGNAL',
      severity: 'MEDIUM',
      title: 'Reply to your unanswered reviews',
      message:
        'AI assistants treat response rate as a trust signal. A few thoughtful replies can lift how you are described.',
      impact: 0.45,
      artifact: {
        kind: 'text',
        content: `Thank you for the kind words! It was a pleasure helping you. — The ${s.businessName} team`,
      },
    });
  }

  const bestByType = new Map<string, DraftRec>();
  for (const d of drafts) {
    const cur = bestByType.get(d.type);
    if (!cur || d.impact > cur.impact) bestByType.set(d.type, d);
  }
  const ranked = [...bestByType.values()]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5);

  return { score: computeScore(s), recommendations: ranked };
}

function appearanceWeak(s: BusinessSignals): boolean {
  if (!s.queries.length) return true;
  return s.queries.filter((q) => q.mentioned).length / s.queries.length < 0.6;
}
