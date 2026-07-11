import Link from 'next/link';

export default function BillingSuccessPage({
  searchParams,
}: {
  searchParams: { mock?: string; session_id?: string };
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <div className="text-3xl">✓</div>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">You&apos;re on a trial</h1>
      <p className="mt-2 text-sm text-slate-600">
        {searchParams.mock
          ? 'Local mock activation — no Stripe charge. Re-scans and multi-business are unlocked.'
          : 'Stripe checkout completed. Your subscription is activating.'}
      </p>
      {searchParams.session_id && (
        <p className="mt-2 break-all text-xs text-slate-400">Session {searchParams.session_id}</p>
      )}
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white"
        >
          Open dashboard
        </Link>
        <Link href="/onboard" className="text-sm font-semibold text-brand-600">
          Scan another business
        </Link>
      </div>
    </div>
  );
}
