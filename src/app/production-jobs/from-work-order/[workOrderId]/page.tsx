import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getWorkOrderById } from "@/modules/foundation/work-order-repository";

type PageProps = {
  params: Promise<{ workOrderId: string }>;
};

export default async function CreateProductionJobFromWorkOrderPage({ params }: PageProps) {
  const { workOrderId } = await params;
  const workOrder = getWorkOrderById(workOrderId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Production Job Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Production Job From Work Order</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Conversion endpoint: POST /api/production-jobs/from-work-order/{workOrderId}
          </p>
        </header>

        {!workOrder ? (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Work order {workOrderId} was not found.
          </article>
        ) : (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <p>Work Order: {workOrder.workOrderNumber}</p>
            <p className="mt-1">Status: {workOrder.status}</p>
            <p className="mt-1">Customer: {workOrder.customerReference}</p>
            <p className="mt-1">Revision: {workOrder.revision}</p>
            <p className="mt-3">
              Use conversion API to create the authoritative production-job record while preserving immutable upstream lineage.
            </p>
            <Link
              href="/production-jobs"
              className="mt-4 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Open Production Jobs
            </Link>
          </article>
        )}
      </section>
    </AppShell>
  );
}
