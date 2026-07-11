'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type AlertRow = {
  id: string;
  type: string;
  channel: string;
  payload: any;
  sentAt: string | null;
  createdAt: string;
  business?: { id: string; name: string };
};

export function AlertsPanel({ businessId }: { businessId?: string }) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
    const token = m ? decodeURIComponent(m[1]) : null;
    if (!token) return;
    const path = businessId
      ? `${API}/alerts/business/${businessId}`
      : `${API}/alerts`;
    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`alerts ${r.status}`);
        return r.json();
      })
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [businessId]);

  if (error) {
    return <p className="text-xs text-slate-400">Alerts unavailable ({error})</p>;
  }
  if (!rows.length) {
    return (
      <p className="text-sm text-slate-500">
        No alerts yet. Re-scans that drop your score will notify owners by email.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.slice(0, 8).map((a) => (
        <li
          key={a.id}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-800">{a.type.replace(/_/g, ' ')}</span>
            <span className="text-xs text-slate-400">
              {new Date(a.createdAt).toLocaleString()}
              {a.sentAt ? ' · emailed' : ' · logged'}
            </span>
          </div>
          <p className="mt-1 text-slate-600">
            {a.payload?.businessName || a.business?.name || 'Business'}
            {a.type === 'SCORE_DROP' &&
              ` · ${a.payload?.previousScore} → ${a.payload?.newScore} (−${a.payload?.delta})`}
            {a.type === 'COMPETITOR_OVERTAKE' && a.payload?.title
              ? ` · ${a.payload.title}`
              : ''}
          </p>
          {(a.business?.id || businessId) && (
            <Link
              href={`/businesses/${a.business?.id || businessId}`}
              className="mt-1 inline-block text-xs font-semibold text-brand-600"
            >
              Open dashboard
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
