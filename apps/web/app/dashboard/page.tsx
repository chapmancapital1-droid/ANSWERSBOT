import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Business = {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
};

export default async function DashboardPage() {
  const token = cookies().get('session')?.value;
  if (!token) redirect('/login');

  const headers = { Authorization: `Bearer ${token}` };
  let businesses: Business[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${API}/businesses`, { headers, cache: 'no-store' });
    if (res.status === 401) redirect('/login');
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    businesses = json.data ?? json ?? [];
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your businesses</h1>
          <p className="text-sm text-slate-600">Pick a location to open the visibility dashboard.</p>
        </div>
        <Link
          href="/onboard"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Add business
        </Link>
      </div>
      {error && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not reach API ({error}). Is the API running on :4000?
        </div>
      )}
      {!error && businesses.length === 0 && (
        <p className="text-sm text-slate-500">No businesses yet. Run seed, then refresh.</p>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {businesses.map((b) => (
          <li key={b.id}>
            <Link
              href={`/businesses/${b.id}`}
              className="block rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-500"
            >
              <div className="font-semibold text-slate-900">{b.name}</div>
              <div className="mt-1 text-sm text-slate-500">
                {b.category} · {b.city}, {b.state}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
