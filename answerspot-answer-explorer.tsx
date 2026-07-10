import { useState } from "react";
import { Check, X, Minus, ChevronDown, ExternalLink, Search, Clock } from "lucide-react";

// ── Mock data shaped like GET /queries/:id/results ──
// One query, sampled across platforms. Each result carries the raw response,
// whether the business was mentioned, rank, sentiment, citations, competitors.

const YOU = "Demo Roofing Co";
const COMPETITOR_NAMES = ["Precision Roofing", "Lone Star Roofers", "Hill Country Roofing"];

const QUERIES = [
  { id: "q1", text: "best roofer in Austin", location: "Austin, TX", mentionRate: 2, platforms: 3 },
  { id: "q2", text: "emergency roof repair near me", location: "Austin, TX", mentionRate: 3, platforms: 3 },
  { id: "q3", text: "metal roofing Austin", location: "Austin, TX", mentionRate: 0, platforms: 3 },
  { id: "q4", text: "affordable roof replacement Round Rock", location: "Round Rock, TX", mentionRate: 1, platforms: 3 },
];

const RESULTS = {
  q1: [
    {
      platform: "ChatGPT",
      mentioned: true,
      rankPosition: 2,
      sentiment: "POSITIVE",
      confidence: 0.9,
      latencyMs: 3200,
      raw: "For roofing in Austin, a few well-regarded options stand out. Precision Roofing is frequently recommended for their fast turnaround and strong warranty. Demo Roofing Co is another solid choice, especially praised for transparent pricing and quality workmanship on both repairs and full replacements. Lone Star Roofers rounds out the top choices with competitive quotes.",
      citations: [
        { title: "Precision Roofing", url: "precisionroofing.com", source: "website" },
        { title: "Google Reviews", url: "google.com/maps", source: "reviews" },
      ],
    },
    {
      platform: "Perplexity",
      mentioned: true,
      rankPosition: 3,
      sentiment: "POSITIVE",
      confidence: 0.85,
      latencyMs: 2400,
      raw: "The top-rated roofers in Austin based on recent reviews are: 1) Precision Roofing, known for premium metal roofing, 2) Lone Star Roofers, with the most reviews overall, and 3) Demo Roofing Co, recognized for excellent customer service and storm-damage response.",
      citations: [
        { title: "Yelp — Austin Roofers", url: "yelp.com", source: "reviews" },
        { title: "Angi", url: "angi.com", source: "directory" },
      ],
    },
    {
      platform: "Gemini",
      mentioned: false,
      rankPosition: null,
      sentiment: "UNKNOWN",
      confidence: 0.8,
      latencyMs: 2900,
      raw: "Some of the highest-rated roofing companies in Austin include Precision Roofing, Lone Star Roofers, and Hill Country Roofing. Precision Roofing in particular is often cited for their comprehensive warranties and metal roofing expertise.",
      citations: [{ title: "Hill Country Roofing", url: "hillcountryroofing.com", source: "website" }],
    },
  ],
  q2: [
    {
      platform: "ChatGPT", mentioned: true, rankPosition: 1, sentiment: "POSITIVE", confidence: 0.92, latencyMs: 3100,
      raw: "For emergency roof repair in the Austin area, Demo Roofing Co is a strong first call — they advertise 24/7 emergency service and fast storm-damage response. Precision Roofing also offers emergency repairs during business hours.",
      citations: [{ title: "Demo Roofing Co", url: "example.com", source: "website" }],
    },
    {
      platform: "Perplexity", mentioned: true, rankPosition: 1, sentiment: "POSITIVE", confidence: 0.88, latencyMs: 2600,
      raw: "Demo Roofing Co appears to be the go-to for emergency roof repair near Austin, with 24/7 availability highlighted across multiple reviews. Customers mention quick response times after hail storms.",
      citations: [{ title: "Google Reviews", url: "google.com/maps", source: "reviews" }],
    },
    {
      platform: "Gemini", mentioned: true, rankPosition: 2, sentiment: "NEUTRAL", confidence: 0.79, latencyMs: 3000,
      raw: "For urgent roof repairs in Austin, options include Precision Roofing and Demo Roofing Co. Both handle storm damage, though availability may vary — it's best to call ahead to confirm emergency slots.",
      citations: [],
    },
  ],
  q3: [
    {
      platform: "ChatGPT", mentioned: false, rankPosition: null, sentiment: "UNKNOWN", confidence: 0.83, latencyMs: 2800,
      raw: "For metal roofing in Austin, Precision Roofing is the most frequently recommended, specializing in standing-seam metal roofs. Hill Country Roofing also offers metal options with a range of finishes.",
      citations: [{ title: "Precision Roofing", url: "precisionroofing.com", source: "website" }],
    },
    {
      platform: "Perplexity", mentioned: false, rankPosition: null, sentiment: "UNKNOWN", confidence: 0.81, latencyMs: 2500,
      raw: "Top metal roofing specialists in Austin include Precision Roofing and Hill Country Roofing. Precision is noted for premium standing-seam installations with long warranties.",
      citations: [{ title: "Angi — Metal Roofing", url: "angi.com", source: "directory" }],
    },
    {
      platform: "Gemini", mentioned: false, rankPosition: null, sentiment: "UNKNOWN", confidence: 0.78, latencyMs: 2700,
      raw: "Precision Roofing is the standout for metal roofing in the Austin area, with extensive experience in metal roof installation and repair.",
      citations: [],
    },
  ],
  q4: [
    {
      platform: "ChatGPT", mentioned: true, rankPosition: 3, sentiment: "POSITIVE", confidence: 0.86, latencyMs: 3050,
      raw: "For affordable roof replacement in Round Rock, consider Lone Star Roofers for budget-friendly quotes, Hill Country Roofing for financing options, and Demo Roofing Co, which is often mentioned for good value on full replacements.",
      citations: [{ title: "Google Reviews", url: "google.com/maps", source: "reviews" }],
    },
    {
      platform: "Perplexity", mentioned: false, rankPosition: null, sentiment: "UNKNOWN", confidence: 0.8, latencyMs: 2450,
      raw: "The most affordable roof replacement options in Round Rock appear to be Lone Star Roofers and Hill Country Roofing, both offering competitive pricing and financing plans.",
      citations: [{ title: "Yelp", url: "yelp.com", source: "reviews" }],
    },
    {
      platform: "Gemini", mentioned: false, rankPosition: null, sentiment: "UNKNOWN", confidence: 0.77, latencyMs: 2850,
      raw: "For budget roof replacement near Round Rock, Lone Star Roofers is frequently recommended for value, along with Hill Country Roofing.",
      citations: [],
    },
  ],
};

const PLATFORM_COLORS = {
  ChatGPT: "#10a37f",
  Perplexity: "#20808d",
  Gemini: "#4285f4",
};

const SENTIMENT_STYLES = {
  POSITIVE: { label: "Positive", cls: "bg-green-100 text-green-700" },
  NEUTRAL: { label: "Neutral", cls: "bg-slate-100 text-slate-600" },
  NEGATIVE: { label: "Negative", cls: "bg-red-100 text-red-700" },
  UNKNOWN: { label: "—", cls: "bg-slate-50 text-slate-400" },
};

// Highlight YOU (blue) and competitors (amber) inside the raw text.
function Highlighted({ text }) {
  const names = [YOU, ...COMPETITOR_NAMES];
  // Build a regex that matches any name; split while keeping delimiters.
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return (
    <p className="text-sm leading-relaxed text-slate-700">
      {parts.map((part, i) => {
        if (part === YOU)
          return <mark key={i} className="bg-blue-100 text-blue-800 font-semibold rounded px-1 py-0.5">{part}</mark>;
        if (COMPETITOR_NAMES.includes(part))
          return <mark key={i} className="bg-amber-100 text-amber-800 font-medium rounded px-1 py-0.5">{part}</mark>;
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function MentionBadge({ mentioned, rank }) {
  if (mentioned)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
        <Check size={13} /> Mentioned{rank ? ` · #${rank}` : ""}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
      <X size={13} /> Not mentioned
    </span>
  );
}

function ResultCard({ r }) {
  const [showCitations, setShowCitations] = useState(false);
  const color = PLATFORM_COLORS[r.platform];
  const sent = SENTIMENT_STYLES[r.sentiment];
  return (
    <div className={`rounded-2xl border bg-white overflow-hidden ${r.mentioned ? "border-slate-200" : "border-slate-200 opacity-95"}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-sm text-slate-800">{r.platform}</span>
        </div>
        <MentionBadge mentioned={r.mentioned} rank={r.rankPosition} />
      </div>

      <div className="p-4">
        <Highlighted text={r.raw} />

        <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
          <span className={`px-2 py-0.5 rounded-full font-medium ${sent.cls}`}>{sent.label}</span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Clock size={12} /> {(r.latencyMs / 1000).toFixed(1)}s
          </span>
          <span className="text-slate-400">confidence {Math.round(r.confidence * 100)}%</span>
          {r.citations.length > 0 && (
            <button onClick={() => setShowCitations(!showCitations)}
              className="inline-flex items-center gap-1 text-blue-600 font-semibold ml-auto">
              {r.citations.length} citation{r.citations.length > 1 ? "s" : ""}
              <ChevronDown size={13} className={`transition-transform ${showCitations ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>

        {showCitations && r.citations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            {r.citations.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 w-16">{c.source}</span>
                <ExternalLink size={12} className="text-slate-400" />
                <span className="text-slate-600">{c.title}</span>
                <span className="text-slate-400">· {c.url}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnswerExplorer() {
  const [activeQuery, setActiveQuery] = useState("q1");
  const query = QUERIES.find((q) => q.id === activeQuery);
  const results = RESULTS[activeQuery];
  const mentionedCount = results.filter((r) => r.mentioned).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Answer Explorer</h1>
          <p className="text-sm text-slate-500">See exactly what each AI platform says when customers ask for a business like yours.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Query list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-2 sticky top-6">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tracked queries</div>
              {QUERIES.map((q) => {
                const active = q.id === activeQuery;
                const none = q.mentionRate === 0;
                return (
                  <button key={q.id} onClick={() => setActiveQuery(q.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-colors ${active ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"}`}>
                    <div className="flex items-start gap-2">
                      <Search size={14} className={active ? "text-blue-500 mt-0.5" : "text-slate-400 mt-0.5"} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${active ? "text-blue-800" : "text-slate-700"}`}>{q.text}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {none ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                              <X size={10} /> 0/{q.platforms}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${q.mentionRate === q.platforms ? "text-green-600" : "text-amber-600"}`}>
                              {q.mentionRate === q.platforms ? <Check size={10} /> : <Minus size={10} />} {q.mentionRate}/{q.platforms}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {/* Query summary bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">Showing results for</div>
                <div className="font-semibold text-slate-800">"{query.text}" <span className="font-normal text-slate-400">· {query.location}</span></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${mentionedCount === 0 ? "text-red-600" : mentionedCount === results.length ? "text-green-600" : "text-amber-600"}`}>
                    {mentionedCount}/{results.length}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">platforms mention you</div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 px-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /> <span className="text-slate-500">You</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200" /> <span className="text-slate-500">Competitors</span>
              </span>
            </div>

            <div className="space-y-4">
              {results.map((r, i) => <ResultCard key={i} r={r} />)}
            </div>

            {mentionedCount === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-orange-50 border border-orange-100 text-sm text-orange-800">
                <strong>You don't appear in any platform for this query.</strong> Competitors are capturing all of these slots — check the recommendations to see what's closing the gap.
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-4 text-center">
              Responses are sampled and may vary between scans. AI answers are non-deterministic; each query is run multiple times per platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}