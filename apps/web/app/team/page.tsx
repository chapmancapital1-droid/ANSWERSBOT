'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionToken } from '@/lib/auth-client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type MembersRes = {
  plan: string;
  seatLimit: number | null;
  seatUsed: number;
  members: {
    userId: string;
    email: string;
    name: string | null;
    role: string;
  }[];
  pendingInvites: { id: string; email: string; role: string; expiresAt: string }[];
};

type Branding = {
  brandName: string | null;
  brandPrimaryColor: string | null;
  brandLogoUrl: string | null;
  brandFooter: string | null;
  whiteLabelEnabled: boolean;
  plan: string;
  name: string;
};

export default function TeamPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MembersRes | null>(null);
  const [brand, setBrand] = useState<Branding | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function api(path: string, opts?: RequestInit) {
    const t = getSessionToken();
    if (!t) {
      router.push('/login');
      throw new Error('login');
    }
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
        ...(opts?.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  async function refresh() {
    const [m, b] = await Promise.all([
      api('/org/members'),
      api('/org/branding'),
    ]);
    setMembers(m);
    setBrand(b);
  }

  useEffect(() => {
    refresh().catch((e) => {
      if (e.message !== 'login') setError(e.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function invite() {
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const r = await api('/org/invites', {
        method: 'POST',
        body: JSON.stringify({ email, role: 'MEMBER' }),
      });
      setMsg(
        r.token
          ? `Invited ${email}. Dev token: ${r.token}`
          : `Invite sent to ${email}`,
      );
      setEmail('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setLoading(false);
    }
  }

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setLoading(true);
    setError(null);
    setMsg(null);
    try {
      const b = await api('/org/branding', {
        method: 'PATCH',
        body: JSON.stringify({
          brandName: brand.brandName,
          brandPrimaryColor: brand.brandPrimaryColor,
          brandLogoUrl: brand.brandLogoUrl,
          brandFooter: brand.brandFooter,
        }),
      });
      setBrand({ ...brand, ...b });
      setMsg('Branding saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  if (!members) {
    return <p className="text-sm text-slate-500">Loading team…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team & branding</h1>
        <p className="mt-1 text-sm text-slate-600">
          Plan {members.plan} · seats {members.seatUsed}
          {members.seatLimit != null ? ` / ${members.seatLimit}` : ' (unlimited)'}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {msg && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {members.members.map((m) => (
            <li key={m.userId} className="flex justify-between py-2 text-sm">
              <span>
                {m.name || m.email}{' '}
                <span className="text-slate-400">({m.email})</span>
              </span>
              <span className="font-medium text-slate-600">{m.role}</span>
            </li>
          ))}
        </ul>
        {members.pendingInvites.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Pending invites
            </p>
            <ul className="mt-2 text-sm text-slate-600">
              {members.pendingInvites.map((i) => (
                <li key={i.id}>
                  {i.email} · {i.role}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <input
            type="email"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || !email}
            onClick={invite}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Invite
          </button>
        </div>
      </section>

      {brand && (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">White-label reports</h2>
          <p className="mt-1 text-sm text-slate-600">
            {brand.whiteLabelEnabled
              ? 'Pro/Agency: customize client-facing report brand.'
              : 'Upgrade to Pro or Agency to enable white-label branding.'}
          </p>
          <form onSubmit={saveBrand} className="mt-4 grid gap-3">
            <label className="text-sm">
              Brand name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={brand.brandName || ''}
                disabled={!brand.whiteLabelEnabled}
                onChange={(e) =>
                  setBrand({ ...brand, brandName: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Primary color (#RRGGBB)
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                value={brand.brandPrimaryColor || '#4f46e5'}
                disabled={!brand.whiteLabelEnabled}
                onChange={(e) =>
                  setBrand({ ...brand, brandPrimaryColor: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Logo URL
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={brand.brandLogoUrl || ''}
                disabled={!brand.whiteLabelEnabled}
                onChange={(e) =>
                  setBrand({ ...brand, brandLogoUrl: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Report footer
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={brand.brandFooter || ''}
                disabled={!brand.whiteLabelEnabled}
                onChange={(e) =>
                  setBrand({ ...brand, brandFooter: e.target.value })
                }
              />
            </label>
            <button
              type="submit"
              disabled={loading || !brand.whiteLabelEnabled}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save branding
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
