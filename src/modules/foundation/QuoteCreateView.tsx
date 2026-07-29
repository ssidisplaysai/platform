export function QuoteCreateView() {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Quote Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create New Quote</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Use the bounded API contract to create quote records with immutable line pricing snapshots,
          revision history, approval transitions, and conversion request stubs.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
        <p>API endpoint: POST /api/quotes</p>
        <p className="mt-2">Required permissions: quotes:create</p>
        <p className="mt-2">Required scope headers: x-gcp-organization-id (and optional x-gcp-site-id)</p>
      </article>
    </section>
  );
}
