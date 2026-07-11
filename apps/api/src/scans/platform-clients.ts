import { Logger } from '@nestjs/common';
import { simulateAnswer, type SimulatedAnswer } from './answer-simulator';
import { parseAnswer } from './answer-parser';

const log = new Logger('PlatformClients');

export type PlatformAnswer = SimulatedAnswer & { source: 'live' | 'stub' };

function hasKey(name: string) {
  const v = process.env[name];
  return Boolean(v && !v.includes('...') && v.length > 8);
}

export function scanMode(): 'stub' | 'live' | 'auto' {
  const m = (process.env.SCAN_MODE || 'auto').toLowerCase();
  if (m === 'stub' || m === 'live') return m;
  return 'auto';
}

export function aiOverviewEnabled() {
  return (
    process.env.ENABLE_AI_OVERVIEW === 'true' && hasKey('SERP_API_KEY')
  );
}

export function platformCapabilities() {
  return {
    mode: scanMode(),
    perplexity: hasKey('PERPLEXITY_API_KEY'),
    openai: hasKey('OPENAI_API_KEY'),
    gemini: hasKey('GEMINI_API_KEY'),
    aiOverview: aiOverviewEnabled(),
    serp: hasKey('SERP_API_KEY'),
  };
}

async function callPerplexity(queryText: string, location?: string | null): Promise<{
  text: string;
  citations: { url: string; title?: string }[];
}> {
  const key = process.env.PERPLEXITY_API_KEY!;
  const model = process.env.PERPLEXITY_MODEL || 'sonar';
  const prompt = location
    ? `${queryText} (focus on businesses in ${location})`
    : queryText;

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a local business research assistant. List the top local service businesses that answer the user query. Number them 1–5 with a short reason. Include real business names when possible.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Perplexity HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content || '';
  const citations = (data.citations || []).map((url: string) => ({ url }));
  return { text, citations };
}

async function callOpenAI(queryText: string, location?: string | null): Promise<string> {
  const key = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const prompt = location ? `${queryText} in ${location}` : queryText;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'List top local service businesses for the query as a numbered list 1-5 with short notes. Use realistic local business names.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 700,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callSerpAiOverview(
  queryText: string,
  location?: string | null,
): Promise<{ text: string; citations: { url: string; title?: string }[] }> {
  const key = process.env.SERP_API_KEY!;
  const q = location ? `${queryText} ${location}` : queryText;
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google');
  url.searchParams.set('q', q);
  url.searchParams.set('api_key', key);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'us');
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SerpAPI HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const lines: string[] = [];
  const citations: { url: string; title?: string }[] = [];
  const ai = data.ai_overview || data.answer_box || {};
  if (ai.title) lines.push(String(ai.title));
  if (ai.snippet) lines.push(String(ai.snippet));
  for (const block of ai.text_blocks || []) {
    if (block?.snippet) lines.push(String(block.snippet));
    if (Array.isArray(block?.list)) {
      block.list.forEach((item: any, i: number) => {
        const snip = item?.snippet || item?.title || String(item);
        lines.push(`${i + 1}. ${snip}`);
      });
    }
  }
  for (const row of (data.organic_results || []).slice(0, 5)) {
    lines.push(`${lines.filter((l) => /^\d+\./.test(l)).length + 1}. ${row.title || 'Result'} — ${row.snippet || ''}`);
    if (row.link) citations.push({ url: row.link, title: row.title });
  }
  return {
    text: lines.join('\n') || `No AI Overview for: ${q}`,
    citations,
  };
}

async function callGemini(queryText: string, location?: string | null): Promise<string> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = location ? `${queryText} in ${location}` : queryText;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                'List top local service businesses for this query as a numbered list 1-5 with short notes.\n\n' +
                prompt,
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Fetch one platform answer. Uses live APIs when keys + mode allow; else stub.
 */
export async function fetchPlatformAnswer(opts: {
  platformKey: string;
  queryText: string;
  businessName: string;
  category: string;
  city: string;
  location?: string | null;
  /** Force stub path (budget exhaustion mid-batch). */
  forceStub?: boolean;
}): Promise<PlatformAnswer> {
  const mode = scanMode();
  const caps = platformCapabilities();
  const wantLive =
    !opts.forceStub && (mode === 'live' || mode === 'auto');

  const toAnswer = (
    text: string,
    platformKey: string,
    extraCitations: { url: string; title?: string }[] = [],
    source: 'live' | 'stub',
  ): PlatformAnswer => {
    const parsed = parseAnswer({ text, businessName: opts.businessName });
    const citations = [...extraCitations, ...parsed.citations].slice(0, 10);
    return {
      platformKey,
      text,
      mentioned: parsed.mentioned,
      rankPosition: parsed.rankPosition,
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      citations,
      competitors: parsed.competitors,
      source,
    };
  };

  try {
    if (wantLive && opts.platformKey === 'PERPLEXITY' && caps.perplexity) {
      const { text, citations } = await callPerplexity(opts.queryText, opts.location);
      log.log(`live PERPLEXITY ok query="${opts.queryText.slice(0, 40)}"`);
      return toAnswer(text, 'PERPLEXITY', citations, 'live');
    }
    if (wantLive && opts.platformKey === 'CHATGPT' && caps.openai) {
      const text = await callOpenAI(opts.queryText, opts.location);
      log.log(`live CHATGPT/OpenAI ok query="${opts.queryText.slice(0, 40)}"`);
      return toAnswer(text, 'CHATGPT', [], 'live');
    }
    if (wantLive && opts.platformKey === 'GEMINI' && caps.gemini) {
      const text = await callGemini(opts.queryText, opts.location);
      log.log(`live GEMINI ok query="${opts.queryText.slice(0, 40)}"`);
      return toAnswer(text, 'GEMINI', [], 'live');
    }
    if (wantLive && opts.platformKey === 'AI_OVERVIEW' && caps.aiOverview) {
      const { text, citations } = await callSerpAiOverview(
        opts.queryText,
        opts.location,
      );
      log.log(`live AI_OVERVIEW ok query="${opts.queryText.slice(0, 40)}"`);
      return toAnswer(text, 'AI_OVERVIEW', citations, 'live');
    }
  } catch (err: any) {
    log.warn(
      `live ${opts.platformKey} failed, falling back to stub: ${err?.message || err}`,
    );
  }

  // Stub fallback (or forced SCAN_MODE=stub)
  const sim = simulateAnswer({
    platformKey: opts.platformKey,
    queryText: opts.queryText,
    businessName: opts.businessName,
    category: opts.category,
    city: opts.city,
  });
  return { ...sim, source: 'stub' };
}
