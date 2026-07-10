import { useState } from "react";
import { Check, X, Crown, TrendingDown, Filter, Info } from "lucide-react";

// Competitor Radar: the full head-to-head matrix. You vs each rival across
// every tracked query. Data shape mirrors an aggregation over scan_results
// (GET /businesses/:id/competitors, expanded to per-query detail).

const YOU = "Demo Roofing Co";

const COMPETITORS = ["Precision Roofing", "Lone Star Roofers", "Hill Country Roofing"];

// For each query: who appears, and at what rank (null = not mentioned).
// rank 1 = top slot. Lower is better.
const MATRIX = [
  { query: "best roofer in Austin", you: 2, ranks: { "Precision Roofing": 1, "Lone Star Roofers": 3, "Hill Country Roofing": null } },
  { query: "emergency roof repair near me", you: 1, ranks: { "Precision Roofing": 3, "Lone Star Roofers": null, "Hill Country Roofing": null } },
  { query: "roof replacement cost Austin", you: 3, ranks: { "Precision Roofing": 1, "Lone Star Roofers": 2, "Hill Country Roofing": null } },
  { query: "metal roofing Austin", you: null, ranks: { "Precision Roofing": 1, "Lone Star Roofers": null, "Hill Country Roofing": 2 } },
  { query: "storm damage roof repair", you: 2, ranks: { "Precision Roofing": 1, "Lone Star Roofers": 3, "Hill Country Roofing": null } },
  { query: "affordable roofer Round Rock", you: null, ranks: { "Precision Roofing": null, "Lone Star Roofers": 1, "Hill Country Roofing": 2 } },
  { query: "roof inspections near me", you: 1, ranks: { "Precision Roofing": 2, "Lone Star Roofers": null, "Hill Country Roofing": 3 } },
  { query: "commercial roofing Austin", you: null, ranks: { "Precision Roofing": 1, "Lone Star Roofers": 2, "Hill Country Roofing": null } },
];

const ALL = [YOU, ...COMPETITORS];

function appearances(name) {
  if (name === YOU) return MATRIX.filter((r) => r.you !== null).length;
  return MATRIX.filter((r) => r.ranks[name] !== null).length;
}
function avgRank(name) {
  const ranks = MATRIX.map((r) => (name === YOU ? r.you : r.ranks[name])).filter((x) => x !== null);
  if (!ranks.length) return null;
  return (ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1);
}

function Cell({ rank, isYou }) {
  if (rank === null)
    return (
      <div className="flex items-center justify-center h-9">
        <X size={14} className="text-slate-300" />
      </div>
    );
  // Color by rank quality.
  const bg = rank === 1 ? (isYou ? "bg-blue-600" : "bg-slate-700")
    : rank === 2 ? (isYou ? "bg-blue-400" : "bg-slate-400")
    : (isYou ? "bg-blue-200" : "bg-slate-200");
  const text = rank <= 2 ? "text-white" : isYou ? "text-blue-800" : "text-slate-600";
  return (
    <div className="flex items-center justify-center h-9">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${bg} ${text}`}>
        #{rank}
      </span>
    </div>
  );
}

export default function CompetitorRadar() {
  const [sortBy, setSortBy] = useState("appearances");

  const leaderboard = [...ALL].sort((a, b) => {
    if (sortBy === "appearances") return appearances(b) - appearances(a);
    const ra = avgRank(a), rb = avgRank(b);
    if (ra === null) return 1;
    if (rb === null) return -1;
    return parseFloat(ra) - parseFloat(rb);
  });

  const topRival = COMPETITORS.map((c) => ({ name: c, a: appearances(c) })).sort((x, y) => y.a - x.a)[0];
  const yourAppears = appearances(YOU);
  const lostQueries = MATRIX.filter((r) => r.you === null);

  return (
    <div className="min-h-screen bg-slate-50 p-6" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Competitor Radar</h1>
          <p className="text-sm text-slate-500">Who's winning the AI slots you're competing for — query by query.</p>
        </div>

        {/* Tension banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <TrendingDown size={20} className="text-orange-600" />
          </div>
          <div className="text-sm text-orange-900">
            <strong>{topRival.name}</strong> appears in {topRival.a} of {MATRIX.length} queries — you appear in {yourAppears}.
            You're absent from {lostQueries.length} queries competitors are capturing.
          </div>
        </div>

        {/* Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {leaderboard.map((name, i) => {
            const isYou = name === YOU;
            const a = appearances(name);
            const ar = avgRank(name);
            return (
              <div key={name}
                className={`rounded-2xl border p-4 ${isYou ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  {i === 0 && <Crown size={14} className="text-amber-500" />}
                  <span className={`text-sm font-semibold truncate ${isYou ? "text-blue-800" : "text-slate-700"}`}>{name}</span>
                  {isYou && <span className="text-[9px] font-bold text-blue-600 bg-blue-100 rounded px-1.5 py-0.5">YOU</span>}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${isYou ? "text-blue-700" : "text-slate-800"}`}>{a}</span>
                  <span className="text-xs text-slate-400">/{MATRIX.length} queries</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">avg rank {ar ?? "—"}</div>
              </div>
            );
          })}
        </div>

        {/* Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Query-by-query</h2>
            <button onClick={() => setSortBy(sortBy === "appearances" ? "rank" : "appearances")}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <Filter size={13} /> Sort: {sortBy === "appearances" ? "appearances" : "avg rank"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase">Query</th>
                  {ALL.map((name) => (
                    <th key={name} className="px-2 py-2.5 text-center">
                      <span className={`text-[11px] font-semibold ${name === YOU ? "text-blue-700" : "text-slate-500"}`}>
                        {name === YOU ? "You" : name.split(" ")[0]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row, ri) => {
                  const youLose = row.you === null;
                  return (
                    <tr key={ri} className={`border-b border-slate-50 ${youLose ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-1.5">
                        <div className="flex items-center gap-2">
                          {youLose && <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="You're absent" />}
                          <span className="text-sm text-slate-700">{row.query}</span>
                        </div>
                      </td>
                      <td className="px-2"><Cell rank={row.you} isYou /></td>
                      {COMPETITORS.map((c) => (
                        <td key={c} className="px-2"><Cell rank={row.ranks[c]} isYou={false} /></td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-100 flex-wrap text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-600" /> You, #1</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-slate-700" /> Rival, #1</span>
            <span className="inline-flex items-center gap-1.5"><X size={13} className="text-slate-300" /> Not mentioned</span>
            <span className="inline-flex items-center gap-1.5 ml-auto"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> You're absent</span>
          </div>
        </div>

        {/* Where you're losing */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Biggest opportunities</h2>
          </div>
          <div className="space-y-2">
            {lostQueries.map((row, i) => {
              const winners = COMPETITORS.filter((c) => row.ranks[c] !== null);
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <span className="text-sm font-medium text-slate-700 flex-1">{row.query}</span>
                  <span className="text-xs text-slate-400">
                    {winners.length ? `${winners.length} competitor${winners.length > 1 ? "s" : ""} here` : "open slot"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2.5 py-1">
                    <X size={12} /> You're out
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-4 text-center">
          Rankings are directional estimates based on sampled AI responses and may vary between scans.
        </p>
      </div>
    </div>
  );
}