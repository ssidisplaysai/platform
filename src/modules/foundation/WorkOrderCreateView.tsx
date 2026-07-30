export function WorkOrderCreateView() {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-500">Work Order Foundation</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Work Order</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Create manufacturing commitments from approved commerce lineage with immutable source references and deterministic revisions.
        </p>
      </header>

      <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
        <p>API endpoint: POST /api/work-orders</p>
        <p className="mt-2">Create from sales order endpoint: POST /api/work-orders/from-order/{'{orderId}'}</p>
        <p className="mt-2">Required permissions: work_orders:create</p>
        <p className="mt-2">Required scope headers: x-gcp-organization-id (and optional x-gcp-site-id)</p>
      </article>
    </section>
  );
}
