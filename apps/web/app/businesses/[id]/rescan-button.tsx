'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export function RescanButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function rescan() {
    setLoading(true);
    setMsg(null);
    try {
      const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
      const token = m ? decodeURIComponent(m[1]) : null;
      if (!token) throw new Error('Not signed in');
      const res = await fetch(`${API}/scans/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'PAYWALL_RESCAN' || res.status === 403) {
          setMsg(data.message || 'Upgrade required');
          setTimeout(() => router.push('/pricing'), 800);
          return;
        }
        throw new Error(data.message || data.error || `Scan failed (${res.status})`);
      }
      setMsg(
        `Score ${data.score} · ${data.scansCompleted} scans` +
          (data.live ? ` · ${data.live} live` : '') +
          (data.stub ? ` · ${data.stub} stub` : ''),
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Rescan failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={rescan}
        disabled={loading}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? 'Scanning…' : 'Re-run scan'}
      </button>
      {msg && <p className="max-w-xs text-right text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
