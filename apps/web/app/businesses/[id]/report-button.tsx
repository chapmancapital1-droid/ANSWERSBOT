'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function token() {
  const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function ReportButton({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function generate(format: 'pdf' | 'html') {
    setLoading(true);
    setMsg(null);
    try {
      const t = token();
      if (!t) throw new Error('Not signed in');
      const res = await fetch(
        `${API}/reports/${businessId}?format=${format}`,
        { headers: { Authorization: `Bearer ${t}` } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Report failed');
      setMsg(`${format.toUpperCase()} ready · ${data.branding?.brandName || 'Answerspot'}`);
      if (data.url && !String(data.url).startsWith('file:')) {
        window.open(data.url, '_blank');
      } else if (data.url) {
        setMsg(`Saved locally: ${data.url}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => generate('pdf')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? '…' : 'PDF report'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => generate('html')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          HTML report
        </button>
      </div>
      {msg && <p className="max-w-xs text-right text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
