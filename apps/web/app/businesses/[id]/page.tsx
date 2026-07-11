import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { RecommendationList, type Recommendation } from './recommendation-list';
import { RescanButton } from './rescan-button';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type VisibilityScore = {
  score: number;
  breakdown: {
    appearanceRate: number;
    rankScore: number;
    sentimentScore: number;
    citationScore: number;
  };
  computedAt: string;
};
type ScoreResponse = { current: VisibilityScore | null; trend: { score: number; computedAt: string }[] };
type Business = { id: string; name: string; category: string; city: string; state: string };

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const token = cookies().get('session')?.value;
  if (!token) redirect('/login');
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) notFound();
  if (res.status === 401) redirect('/login');
  if (!res.ok) throw new ApiError(`Request failed: ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-green-600';
  if (s >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function scoreLabel(s: number) {
  if (s >= 70) return 'Strong';
  if (s >= 50) return 'Building';
  return 'At risk';
}

export default async function BusinessHomePage({ params }: { params: { id: string } }) {
  const id = params.id;
  let business: Business;
  let score: ScoreResponse;
  let recs: Recommendation[];

  try {
    [business, score, recs] = await Promise.all([
      apiGet<Business>(`/businesses/${id}`),
      apiGet<ScoreResponse>(`/businesses/${id}/visibility-score`),
      apiGet<Recommendation[]>(`/businesses/${id}/recommendations`),
    ]);
  } catch (e) {
    if (e instanceof ApiError) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-500">{e.message}</p>
        </div>
      );
    }
    throw e;
  }

  if (!score.current) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl">
          📡
        </div>
        <h2 className="text-xl font-bold text-slate-800">Your first scan is running</h2>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;re querying AI platforms for {business.name}. This page populates when results
          land.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block text-sm font-semibold text-brand-600">
          ← Back
        </Link>
      </div>
    );
  }

  const current = score.current;
  const b = current.breakdown;
  const drivers: [string, number, string][] = [
    ['Appearance rate', b.appearanceRate, 'how often you show up'],
    ['Avg rank position', b.rankScore, 'where you land when you do'],
    ['Sentiment', b.sentimentScore, 'how you are described'],
    ['Citation strength', b.citationScore, 'which sources back you'],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← Businesses
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{business.name}</h1>
          <p className="text-sm text-slate-500">
            {business.category} · {business.city}, {business.state}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/businesses/${id}/answers`} className="font-semibold text-brand-600">
            Answer Explorer
          </Link>
          <Link href={`/businesses/${id}/competitors`} className="font-semibold text-brand-600">
            Competitor Radar
          </Link>
          <RescanButton businessId={id} />
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Visibility Score
          </p>
          <div className={`mt-2 text-6xl font-bold tabular-nums ${scoreColor(current.score)}`}>
            {current.score}
          </div>
          <p className="mt-1 text-sm font-medium text-slate-600">{scoreLabel(current.score)}</p>
          <p className="mt-3 text-xs text-slate-400">
            Updated {new Date(current.computedAt).toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-slate-900">What drives your score</h2>
          <ul className="mt-4 space-y-3">
            {drivers.map(([label, value, hint]) => (
              <li key={label}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{label}</span>
                  <span className="tabular-nums text-slate-500">{Math.round(value * 100)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(100, Math.round(value * 100))}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-900">Top recommendations</h2>
        <p className="mt-1 text-sm text-slate-500">Ranked by impact. Expand for copyable fixes.</p>
        <div className="mt-4">
          <RecommendationList items={recs} />
        </div>
      </section>
    </div>
  );
}
