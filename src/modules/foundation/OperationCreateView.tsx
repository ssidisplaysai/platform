export function OperationCreateView() {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Operation Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Operation</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Define a discrete manufacturing step from an authorized production job while preserving lineage and deterministic lifecycle control.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
        <p>API endpoint: POST /api/operations</p>
        <p className="mt-2">Create from production job endpoint: POST /api/operations/from-job/{'{productionJobId}'}</p>
        <p className="mt-2">Required permissions: operations:create</p>
        <p className="mt-2">Referenced work center and machine identifiers remain references only.</p>
      </article>
    </section>
  );
}
