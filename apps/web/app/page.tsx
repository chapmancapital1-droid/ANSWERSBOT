export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
          AI visibility for local businesses
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-slate-900">
          See if ChatGPT, Perplexity, and Gemini recommend you — then fix the gaps.
        </h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Answerspot monitors what AI platforms say about local service businesses, scores your
          visibility, and hands you plain-language fixes with copyable artifacts.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/onboard"
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Start free scan
          </a>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open dashboard
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Visibility Score', 'One number 0–100. How often you appear, rank, sentiment, citations.'],
          ['Answer Explorer', 'See the actual AI answers with your name and competitors highlighted.'],
          ['Fix-it recs', 'Plain English actions plus schema, copy, and review-response drafts.'],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
