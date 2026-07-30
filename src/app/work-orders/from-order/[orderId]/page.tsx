import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getSalesOrderById } from "@/modules/foundation/sales-order-repository";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function CreateWorkOrderFromOrderPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = getSalesOrderById(orderId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Work Order Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Work Order From Sales Order</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Conversion endpoint: POST /api/work-orders/from-order/{orderId}
          </p>
        </header>

        {!order ? (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Sales order {orderId} was not found.
          </article>
        ) : (
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <p>Order: {order.orderNumber}</p>
            <p className="mt-1">Status: {order.status}</p>
            <p className="mt-1">Customer: {order.customerReference}</p>
            <p className="mt-1">Revision: {order.revision}</p>
            <p className="mt-3">
              Use conversion API to create the authoritative work-order record while preserving immutable commerce lineage.
            </p>
            <Link
              href="/work-orders"
              className="mt-4 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
            >
              Open Work Orders
            </Link>
          </article>
        )}
      </section>
    </AppShell>
  );
}
