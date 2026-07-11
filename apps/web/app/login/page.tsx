'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  acceptInvite,
  clerkPublishableKey,
  exchangeToken,
  loadClerk,
  setSessionCookie,
} from '@/lib/auth-client';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get('invite') || '';

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [idpToken, setIdpToken] = useState('');
  const [provider, setProvider] = useState<'clerk' | 'authjs'>('clerk');
  const [clerkReady, setClerkReady] = useState(false);
  const clerkKey = clerkPublishableKey();

  useEffect(() => {
    if (!clerkKey) return;
    loadClerk()
      .then((c) => setClerkReady(Boolean(c)))
      .catch(() => setClerkReady(false));
  }, [clerkKey]);

  async function afterLogin(accessToken: string, dest?: string) {
    setSessionCookie(accessToken);
    if (invite) {
      try {
        await acceptInvite(invite);
      } catch (e) {
        // still continue — user may re-accept from /invite
        console.warn(e);
      }
    }
    router.push(dest || (invite ? '/team' : '/dashboard'));
  }

  async function loginDev(token: 'demo' | 'free') {
    setLoading(token);
    setError(null);
    try {
      const data = await exchangeToken(token);
      await afterLogin(data.accessToken, token === 'free' ? '/onboard' : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(null);
    }
  }

  async function loginIdpToken() {
    setLoading('idp');
    setError(null);
    try {
      const data = await exchangeToken(idpToken.trim(), provider);
      await afterLogin(data.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'IdP exchange failed');
    } finally {
      setLoading(null);
    }
  }

  async function loginWithClerk() {
    setLoading('clerk');
    setError(null);
    try {
      const clerk = await loadClerk();
      if (!clerk) throw new Error('Clerk not configured');
      if (!clerk.user) {
        await clerk.openSignIn({});
        // User completes modal; poll session
        await new Promise<void>((resolve, reject) => {
          const t0 = Date.now();
          const iv = setInterval(async () => {
            if (clerk.session) {
              clearInterval(iv);
              resolve();
            } else if (Date.now() - t0 > 120_000) {
              clearInterval(iv);
              reject(new Error('Clerk sign-in timed out'));
            }
          }, 800);
        });
      }
      const tok = await clerk.session?.getToken();
      if (!tok) throw new Error('No Clerk session token');
      const data = await exchangeToken(tok, 'clerk');
      await afterLogin(data.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clerk login failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Production uses Clerk or Auth.js (ADR-0001). Dev tokens still work locally.
        </p>
        {invite && (
          <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            Team invite detected — you will join the workspace after sign-in.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {clerkKey && (
        <button
          type="button"
          onClick={loginWithClerk}
          disabled={loading !== null || !clerkReady}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading === 'clerk'
            ? 'Opening Clerk…'
            : clerkReady
              ? 'Continue with Clerk'
              : 'Loading Clerk…'}
        </button>
      )}

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Exchange IdP JWT
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Paste a Clerk session token or Auth.js JWT when SDK is not embedded.
        </p>
        <select
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value as 'clerk' | 'authjs')}
        >
          <option value="clerk">Clerk</option>
          <option value="authjs">Auth.js / NextAuth</option>
        </select>
        <textarea
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
          rows={3}
          placeholder="eyJhbGciOi..."
          value={idpToken}
          onChange={(e) => setIdpToken(e.target.value)}
        />
        <button
          type="button"
          onClick={loginIdpToken}
          disabled={loading !== null || !idpToken.trim()}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading === 'idp' ? 'Exchanging…' : 'Exchange token'}
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Development
        </p>
        <button
          type="button"
          onClick={() => loginDev('free')}
          disabled={loading !== null}
          className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading === 'free' ? 'Starting…' : 'Continue free (1 scan)'}
        </button>
        <button
          type="button"
          onClick={() => loginDev('demo')}
          disabled={loading !== null}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading === 'demo' ? 'Signing in…' : 'Continue as Demo Owner (paid)'}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
