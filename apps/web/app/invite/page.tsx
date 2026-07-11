'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  acceptInvite,
  exchangeToken,
  getSessionToken,
  setSessionCookie,
} from '@/lib/auth-client';
import Link from 'next/link';

function InviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || params.get('invite') || '';
  const [manual, setManual] = useState(token);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      let session = getSessionToken();
      if (!session) {
        // create free session so invite email can join
        const data = await exchangeToken('free');
        setSessionCookie(data.accessToken);
        session = data.accessToken;
      }
      await acceptInvite(manual.trim());
      setOk('Invite accepted. Opening team…');
      setTimeout(() => router.push('/team'), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-bold text-slate-900">Accept team invite</h1>
      <p className="mt-2 text-sm text-slate-600">
        Paste the invite code from your email, or open the link with{' '}
        <code className="text-xs">?token=</code>.
      </p>
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {ok}
        </p>
      )}
      <input
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="Invite token"
      />
      <button
        type="button"
        disabled={loading || !manual.trim()}
        onClick={accept}
        className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Accepting…' : 'Accept invite'}
      </button>
      <p className="mt-4 text-center text-xs text-slate-500">
        Prefer production IdP?{' '}
        <Link className="font-semibold text-brand-600" href={`/login?invite=${encodeURIComponent(manual)}`}>
          Sign in first
        </Link>
      </p>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <InviteInner />
    </Suspense>
  );
}
