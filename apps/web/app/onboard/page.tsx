'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Step = 1 | 2 | 3 | 4;

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('roofer');
  const [city, setCity] = useState('');
  const [state, setState] = useState('TX');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState<string[]>([]);

  const canStep1 = name.trim().length >= 2 && city.trim().length >= 2;

  const previewQueries = useMemo(() => {
    if (!city.trim()) return [];
    const c = category.toLowerCase();
    return [
      `best ${c} in ${city}`,
      `emergency ${c} ${city}`,
      `${c} near ${city}`,
      `top rated ${c} ${city}`,
      `affordable ${c} ${city}`,
      `${c} reviews ${city}`,
    ];
  }, [category, city]);

  function token() {
    const m = document.cookie.match(/(?:^|; )session=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function ensureAuth() {
    let t = token();
    if (t) return t;
    const res = await fetch(`${API}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'demo' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Auth failed');
    document.cookie = `session=${data.accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    return data.accessToken as string;
  }

  async function runOnboard() {
    setLoading(true);
    setError(null);
    setProgress(['Creating workspace…', 'Detecting category signals…']);
    try {
      const t = await ensureAuth();
      setStep(4);
      setProgress((p) => [...p, 'Generating customer queries…', 'Scanning AI platforms…']);

      const res = await fetch(`${API}/businesses/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          city: city.trim(),
          state: state.trim(),
          website: website.trim() || undefined,
          runScan: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Onboard failed (${res.status})`);
      setProgress((p) => [...p, 'Computing Visibility Score…', 'Building recommendations…', 'Done.']);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onboard failed');
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Onboarding · free first scan
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Get your AI visibility in under a minute</h1>
        <p className="mt-1 text-sm text-slate-600">
          No credit card. We generate the queries customers actually type and scan the AI platforms for you.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full ${step >= n ? 'bg-brand-500' : 'bg-slate-200'}`}
          />
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Your business</h2>
          <label className="block text-sm">
            <span className="text-slate-600">Business name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Demo Roofing Co"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Category</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                'roofer',
                'hvac',
                'plumber',
                'electrician',
                'dentist',
                'auto repair',
                'landscaper',
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600">City</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">State</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="TX"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!canStep1}
            onClick={() => setStep(2)}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">We found this</h2>
          <p className="text-sm text-slate-600">
            Confirm details. Optional website helps later recommendations.
          </p>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-900">{name}</div>
            <div className="text-slate-500">
              {category} · {city}, {state}
            </div>
            <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
              auto-detected
            </span>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">Website (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white"
            >
              Looks good
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">Queries we will track</h2>
          <p className="text-sm text-slate-600">
            Real customer language. We&apos;ll generate the full set and scan immediately.
          </p>
          <ul className="space-y-2">
            {previewQueries.map((q) => (
              <li
                key={q}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                {q}
              </li>
            ))}
            <li className="text-xs text-slate-400">+ more high-intent variants…</li>
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold"
            >
              Back
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={runOnboard}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? 'Scanning…' : 'Run free scan'}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">
            {result ? 'Your first scan is ready' : 'Scanning AI platforms…'}
          </h2>
          <ul className="space-y-2 text-sm text-slate-600">
            {progress.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-600">✓</span> {p}
              </li>
            ))}
          </ul>
          {result && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Visibility Score</p>
              <p className="text-4xl font-bold tabular-nums text-brand-600">
                {result.scan?.score ?? '—'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Tracked {result.queries?.length ?? 0} queries across{' '}
                {result.scan?.platforms?.length ?? 0} platforms ·{' '}
                {result.scan?.recommendations ?? 0} recommendations
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white"
                onClick={() => router.push(`/businesses/${result.business.id}`)}
              >
                Open dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
