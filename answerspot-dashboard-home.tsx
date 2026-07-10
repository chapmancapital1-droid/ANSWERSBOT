import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Sparkles, ChevronRight, ArrowUpRight, ArrowDownRight, Copy, Check } from "lucide-react";

// ── Mock data shaped like the API responses in DESIGN_SPEC §6 ──
// GET /businesses/:id/visibility-score  → { current, trend }
const TREND = [
  { computedAt: "May 12", score: 41 },
  { computedAt: "May 19", score: 44 },
  { computedAt: "May 26", score: 43 },
  { computedAt: "Jun 02", score: 48 },
  { computedAt: "Jun 09", score: 52 },
  { computedAt: "Jun 16", score: 51 },
  { computedAt: "Jun 23", score: 57 },
  { computedAt: "Jun 30", score: 61 },
  { computedAt: "Jul 07", score: 64 },
];

const SCORE = {
  score: 64,
  prev: 61,
  breakdown: {
    appearanceRate: 0.58, // appears in 7 of 12 queries
    rankScore: 0.62,
    sentimentScore: 0.81,
    citationScore: 0.44,
    weights: { w1: 0.4, w2: 0.3, w3: 0.15, w4: 0.15 },
  },
};

// GET /businesses/:id/recommendations
const RECOMMENDATIONS = [
  {
    id: "r1",
    type: "CITATION_GAP",
    severity: "HIGH",
    title: "Add FAQ schema to your homepage",
    message:
      "Precision Roofing appears with rich FAQ answers in 6 queries where you don't. Adding FAQ structured data helps AI assistants quote you directly.",
    artifact: {
      kind: "code",
      content:
        '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "Do you offer emergency roof repair?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "Yes — 24/7 emergency roof repair across Austin, TX."\n    }\n  }]\n}\n</script>',
    },
  },
  {
    id: "r2",
    type: "REVIEW_SIGNAL",
    severity: "MEDIUM",
    title: "Respond to 12 unanswered reviews",
    message:
      "You have 47 reviews but only respond to 26%. AI assistants weight response rate as a trust signal. Replying lifts perceived engagement.",
    artifact: {
      kind: "text",
      content:
        "Thanks so much for the kind words, [Name]! It was a pleasure getting your roof sorted before the storm season. — The Demo Roofing Co team",
    },
  },
  {
    id: "r3",
    type: "KEYWORD_GAP",
    severity: "MEDIUM",
    title: 'Add "metal roofing" to your services page',
    message:
      'You appear in 0 of 3 "metal roofing" queries. Two competitors list it explicitly. Add a dedicated section to become eligible.',
    artifact: null,
  },
];

// GET /businesses/:id/competitors (aggregated)
const COMPETITORS = [
  { name: "Demo Roofing Co", appears: 7, total: 12, you: true },
  { name: "Precision Roofing", appears: 10, total: 12, you: false },
  { name: "Lone Star Roofers", appears: 8, total: 12, you: false },
  { name: "Hill Country Roofing", appears: 5, total: 12, you: false },
];

const SEVERITY_STYLES = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border-slate-200",
};

function scoreColor(s) {
  if (s >= 70) return "#16a34a";
  if (s >= 50) return "#ca8a04";
  return "#dc2626";
}
function scoreLabel(s) {
  if (s >= 70) return "Strong";
  if (s >= 50) return "Building";
  return "Low visibility";
}

function ScoreRing({ score }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = scoreColor(score);
  return (
    <div className="relative" style={{ width: 200, height: 200 }}>
      <svg width="200" height="200" className="-rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <circle
          cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs font-medium text-slate-400">out of 100</span>
        <span className="mt-1 text-sm font-semibold" style={{ color }}>{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

function Delta({ value }) {
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {up ? "+" : ""}{value} pts
    </span>
  );
}

function BreakdownBar({ label, value, hint }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-400">{hint}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%`, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

function RecCard({ rec }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(rec.artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors bg-white">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {rec.severity === "HIGH" || rec.severity === "CRITICAL"
            ? <AlertTriangle size={18} className="text-orange-500" />
            : <Sparkles size={18} className="text-amber-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-slate-800 text-sm">{rec.title}</h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[rec.severity]}`}>
              {rec.severity}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{rec.message}</p>
          {rec.artifact && (
            <button onClick={() => setOpen(!open)}
              className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
              {open ? "Hide the fix" : "Show me the fix"}
              <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
            </button>
          )}
          {open && rec.artifact && (
            <div className="mt-2 relative">
              <pre className="text-[11px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                {rec.artifact.content}
              </pre>
              <button onClick={copy}
                className="absolute top-2 right-2 text-slate-300 hover:text-white bg-slate-700/70 rounded p-1.5">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const b = SCORE.breakdown;
  const delta = SCORE.score - SCORE.prev;
  const you = COMPETITORS.find((c) => c.you);
  const topRival = COMPETITORS.filter((c) => !c.you).sort((a, z) => z.appears - a.appears)[0];

  return (
    <div className="min-h-screen bg-slate-50 p-6" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Demo Roofing Co</h1>
            <p className="text-sm text-slate-500">Roofer · Austin, TX · Last scan Jul 7, 2026</p>
          </div>
          <div className="flex gap-2">
            {["ChatGPT", "Perplexity", "Gemini"].map((p) => (
              <span key={p} className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Hero row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Score */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-3 self-start">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Visibility Score</h2>
            </div>
            <ScoreRing score={SCORE.score} />
            <div className="mt-3"><Delta value={delta} /> <span className="text-xs text-slate-400">vs last scan</span></div>
          </div>

          {/* Trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Trend</h2>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                <TrendingUp size={14} /> Up 23 pts over 8 weeks
              </span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="computedAt" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <ReferenceLine y={50} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v) => [`${v}`, "Score"]}
                />
                <Line type="monotone" dataKey="score" stroke={scoreColor(SCORE.score)} strokeWidth={3}
                  dot={{ r: 3, fill: scoreColor(SCORE.score) }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown + competitor snapshot */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">What drives your score</h2>
            <div className="space-y-3.5">
              <BreakdownBar label="Appearance rate" value={b.appearanceRate} hint="7 of 12 queries" />
              <BreakdownBar label="Avg rank position" value={b.rankScore} hint="usually #2–3" />
              <BreakdownBar label="Sentiment" value={b.sentimentScore} hint="mostly positive" />
              <BreakdownBar label="Citation strength" value={b.citationScore} hint="needs work" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Competitor snapshot</h2>
              <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                Full radar <ChevronRight size={14} />
              </button>
            </div>
            <div className="mb-4 p-3 rounded-lg bg-orange-50 border border-orange-100 text-sm text-orange-800 flex items-center gap-2">
              <TrendingDown size={16} />
              <span><strong>{topRival.name}</strong> appears in {topRival.appears} of {topRival.total} queries — you appear in {you.appears}.</span>
            </div>
            <div className="space-y-2.5">
              {COMPETITORS.sort((a, z) => z.appears - a.appears).map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className={`text-sm w-40 truncate ${c.you ? "font-bold text-slate-800" : "text-slate-600"}`}>
                    {c.name}{c.you && <span className="text-[10px] ml-1 text-blue-600">YOU</span>}
                  </span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div className={`h-full rounded-md flex items-center justify-end px-2 ${c.you ? "bg-blue-500" : "bg-slate-400"}`}
                      style={{ width: `${(c.appears / c.total) * 100}%`, transition: "width 0.8s ease" }}>
                      <span className="text-[10px] font-bold text-white">{c.appears}/{c.total}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Top fixes to raise your score</h2>
            </div>
            <span className="text-xs text-slate-400">{RECOMMENDATIONS.length} open</span>
          </div>
          <div className="space-y-3">
            {RECOMMENDATIONS.map((r) => <RecCard key={r.id} rec={r} />)}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-4 text-center max-w-2xl mx-auto">
          Scores are directional estimates based on sampled AI responses and may vary between scans.
          AI answers are non-deterministic; each query is sampled multiple times.
        </p>
      </div>
    </div>
  );
}