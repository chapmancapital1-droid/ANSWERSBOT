import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default async function AnswersPage({ params }: { params: { id: string } }) {
  const token = cookies().get('session')?.value;
  if (!token) redirect('/login');
  const headers = { Authorization: `Bearer ${token}` };

  const [bizRes, scansRes] = await Promise.all([
    fetch(`${API}/businesses/${params.id}`, { headers, cache: 'no-store' }),
    fetch(`${API}/scans/business/${params.id}`, { headers, cache: 'no-store' }),
  ]);
  if (bizRes.status === 404) notFound();
  if (bizRes.status === 401 || scansRes.status === 401) redirect('/login');
  if (!bizRes.ok) throw new Error('Failed to load business');

  const business = await bizRes.json();
  const scans = scansRes.ok ? await scansRes.json() : [];

  // Group by query
  const byQuery = new Map<string, any[]>();
  for (const s of scans) {
    const qt = s.trackedQuery?.queryText || 'Unknown';
    if (!byQuery.has(qt)) byQuery.set(qt, []);
    byQuery.get(qt)!.push(s);
  }

  const highlight = (text: string, name: string) => {
    if (!text) return text;
    const parts = text.split(new RegExp(`(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === name.toLowerCase() ? (
        <mark key={i} className="rounded bg-blue-100 px-0.5 text-blue-900">
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/businesses/${params.id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← {business.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Answer Explorer</h1>
        <p className="text-sm text-slate-600">
          Raw AI responses with your name highlighted. Gaps are where competitors win.
        </p>
      </div>

      {[...byQuery.entries()].map(([query, items]) => {
        const mentionCount = items.filter((s) => s.results?.[0]?.mentioned).length;
        return (
          <section
            key={query}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-slate-900">&ldquo;{query}&rdquo;</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  mentionCount === 0
                    ? 'bg-red-100 text-red-800'
                    : mentionCount === items.length
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {mentionCount}/{items.length} platforms
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {items.map((s: any) => {
                const r = s.results?.[0];
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {s.platform?.displayName || s.platform?.key}
                      </span>
                      <span className="text-xs text-slate-500">
                        {r?.mentioned ? `Rank #${r.rankPosition ?? '—'}` : 'Not mentioned'}
                      </span>
                    </div>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs text-slate-700">
                      {r?.rawResponse
                        ? highlight(r.rawResponse, business.name)
                        : 'No result'}
                    </pre>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!byQuery.size && (
        <p className="text-sm text-slate-500">No scans yet. Run onboarding or trigger a scan.</p>
      )}
    </div>
  );
}
