'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function sessionToken() {
  const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function pollJob(
  jobId: string,
  token: string,
  onTick: (status: string) => void,
  maxMs = 120_000,
) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${API}/scans/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Poll failed');
    onTick(data.status);
    if (data.status === 'DONE') return data;
    if (data.status === 'FAILED') {
      throw new Error(data.error || 'Scan job failed');
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error('Scan timed out — refresh the page to check status');
}

export function RescanButton({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function rescan() {
    setLoading(true);
    setMsg(null);
    try {
      const token = sessionToken();
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
        if (
          data?.code === 'PAYWALL_RESCAN' ||
          data?.code === 'QUOTA_SCANS_MONTHLY' ||
          res.status === 403
        ) {
          setMsg(data.message || 'Upgrade required');
          setTimeout(() => router.push('/pricing'), 800);
          return;
        }
        throw new Error(data.message || data.error || `Scan failed (${res.status})`);
      }

      let result = data;
      if (data.mode === 'async' && data.jobId) {
        setMsg('Scan queued…');
        const job = await pollJob(data.jobId, token, (s) =>
          setMsg(s === 'RUNNING' ? 'Scanning platforms…' : `Status: ${s}`),
        );
        result = { ...(job.result as object), mode: 'async', jobId: data.jobId };
      }

      setMsg(
        `Score ${result.score ?? '—'} · ${result.scansCompleted ?? 0} scans` +
          (result.live ? ` · ${result.live} live` : '') +
          (result.stub ? ` · ${result.stub} stub` : ''),
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
