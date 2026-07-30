export function ProductionJobCreateView() {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Production Job Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Production Job</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Create bounded execution-authorizing jobs from released work-order lineage with immutable upstream references and deterministic transitions.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
        <p>API endpoint: POST /api/production-jobs</p>
        <p className="mt-2">Create from work order endpoint: POST /api/production-jobs/from-work-order/{'{workOrderId}'}</p>
        <p className="mt-2">Required permissions: production_jobs:create</p>
        <p className="mt-2">Required scope headers: x-gcp-organization-id (and optional x-gcp-site-id)</p>
      </article>
    </section>
  );
}
