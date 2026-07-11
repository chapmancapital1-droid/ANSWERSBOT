import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default async function CompetitorsPage({ params }: { params: { id: string } }) {
  const token = cookies().get('session')?.value;
  if (!token) redirect('/login');
  const headers = { Authorization: `Bearer ${token}` };

  const [bizRes, compRes] = await Promise.all([
    fetch(`${API}/businesses/${params.id}`, { headers, cache: 'no-store' }),
    fetch(`${API}/businesses/${params.id}/competitors`, { headers, cache: 'no-store' }),
  ]);
  if (bizRes.status === 404) notFound();
  if (bizRes.status === 401) redirect('/login');

  const business = await bizRes.json();
  const rows: { name: string; appears: number; total: number; you: boolean }[] = compRes.ok
    ? await compRes.json()
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/businesses/${params.id}`} className="text-sm text-slate-500 hover:text-slate-800">
          ← {business.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Competitor Radar</h1>
        <p className="text-sm text-slate-600">
          Who shows up in the same AI answers as you — and how often.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Appearances</th>
              <th className="px-4 py-3">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.total ? Math.round((r.appears / r.total) * 100) : 0;
              return (
                <tr
                  key={r.name}
                  className={`border-t border-slate-100 ${r.you ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.name}
                    {r.you && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                        you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {r.appears}/{r.total}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${r.you ? 'bg-brand-500' : 'bg-slate-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-slate-500">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6 text-sm text-slate-500">No competitor data yet. Run a scan first.</p>
        )}
      </div>
    </div>
  );
}
