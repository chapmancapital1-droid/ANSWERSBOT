'use client';

import { useState } from 'react';

export type Recommendation = {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  artifact: { kind: string; content: string } | null;
  status?: string;
};

const severityColor: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-slate-100 text-slate-700',
};

export function RecommendationList({ items }: { items: Recommendation[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!items?.length) {
    return <p className="text-sm text-slate-500">No open recommendations yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((r) => {
        const expanded = open === r.id;
        return (
          <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${severityColor[r.severity] || severityColor.LOW}`}
                >
                  {r.severity}
                </span>
                <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{r.message}</p>
              </div>
              {r.artifact && (
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  onClick={() => setOpen(expanded ? null : r.id)}
                >
                  {expanded ? 'Hide fix' : 'Show me the fix'}
                </button>
              )}
            </div>
            {expanded && r.artifact && (
              <div className="mt-3 rounded-lg bg-slate-900 p-3">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-300 hover:text-white"
                    onClick={async () => {
                      await navigator.clipboard.writeText(r.artifact!.content);
                      setCopied(r.id);
                      setTimeout(() => setCopied(null), 1500);
                    }}
                  >
                    {copied === r.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-100">
                  {r.artifact.content}
                </pre>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
