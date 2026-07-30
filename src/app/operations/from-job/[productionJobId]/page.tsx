import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getProductionJobById } from "@/modules/foundation/production-job-repository";

type PageProps = {
  params: Promise<{ productionJobId: string }>;
};

export default async function CreateOperationFromJobPage({ params }: PageProps) {
  const { productionJobId } = await params;
  const productionJob = getProductionJobById(productionJobId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Operation Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Operation From Production Job</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Conversion endpoint: POST /api/operations/from-job/{productionJobId}
          </p>
        </header>

        {!productionJob ? (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Production job {productionJobId} was not found.
          </article>
        ) : (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <p>Production Job: {productionJob.productionJobNumber}</p>
            <p className="mt-1">Status: {productionJob.status}</p>
            <p className="mt-1">Work Order: {productionJob.lineage.workOrderId}</p>
            <p className="mt-3">Create an operation to define a discrete manufacturing step without executing work.</p>
            <Link
              href="/operations"
              className="mt-4 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Open Operations
            </Link>
          </article>
        )}
      </section>
    </AppShell>
  );
}
