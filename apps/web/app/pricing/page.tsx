'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function token() {
  const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const PLANS = [
  {
    id: 'STARTER' as const,
    name: 'Starter',
    price: '$49',
    period: '/mo',
    blurb: '1 business · weekly scans · core dashboard',
    cta: 'Start 14-day trial',
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    price: '$99',
    period: '/mo',
    blurb: 'Daily scans · all platforms · full recs + alerts',
    cta: 'Start Pro trial',
    featured: true,
  },
  {
    id: 'AGENCY' as const,
    name: 'Agency',
    price: '$299',
    period: '/mo',
    blurb: 'Multi-location · white-label reports · API',
    cta: 'Start Agency trial',
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const t = token();
    if (!t) return;
    fetch(`${API}/billing/status`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function openPortal() {
    setLoading('portal');
    setError(null);
    try {
      const t = token();
      if (!t) {
        router.push('/login');
        return;
      }
      const res = await fetch(`${API}/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/pricing` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Portal failed');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal failed');
    } finally {
      setLoading(null);
    }
  }

  async function checkout(plan: 'STARTER' | 'PRO' | 'AGENCY') {
    setLoading(plan);
    setError(null);
    try {
      let t = token();
      if (!t) {
        // free-tier account for checkout flow demos
        const r = await fetch(`${API}/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'free' }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'Auth failed');
        document.cookie = `session=${d.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        t = d.accessToken;
      }

      const res = await fetch(`${API}/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      if (data.mode === 'mock') {
        // Local: activate trial without Stripe
        await fetch(`${API}/billing/mock-activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify({ plan }),
        });
        router.push('/billing/success?mock=1');
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Pricing
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Free first scan. Then stay ahead of competitors.
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
          Every plan starts with a 14-day trial. Cancel anytime. No credit card in local mock mode.
        </p>
        {status && (
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>
              Current: {status.plan} · {status.paid ? 'paid/trial active' : 'free tier'} · Stripe{' '}
              {status.stripeConfigured ? 'live' : 'mock'}
            </p>
            {status.paid && status.usage && (
              <p>
                Usage this month: {status.usage.scanJobsThisMonth}
                {status.usage.monthlyScanJobLimit != null
                  ? ` / ${status.usage.monthlyScanJobLimit} scan jobs`
                  : ' (unlimited)'}
              </p>
            )}
            {status.paid && (
              <button
                type="button"
                onClick={() => openPortal()}
                disabled={loading === 'portal'}
                className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60"
              >
                {loading === 'portal' ? 'Opening…' : 'Manage subscription →'}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-auto max-w-lg rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ${
              p.featured ? 'ring-2 ring-brand-500' : 'ring-slate-200'
            }`}
          >
            {p.featured && (
              <span className="text-xs font-semibold uppercase text-brand-600">Most popular</span>
            )}
            <h2 className="mt-1 text-lg font-bold text-slate-900">{p.name}</h2>
            <p className="mt-2">
              <span className="text-3xl font-bold text-slate-900">{p.price}</span>
              <span className="text-slate-500">{p.period}</span>
            </p>
            <p className="mt-3 text-sm text-slate-600">{p.blurb}</p>
            <button
              type="button"
              disabled={loading === p.id}
              onClick={() => checkout(p.id)}
              className={`mt-6 w-full rounded-lg py-2.5 text-sm font-semibold ${
                p.featured
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-slate-300 text-slate-800 hover:bg-slate-50'
              } disabled:opacity-60`}
            >
              {loading === p.id ? 'Starting…' : p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
