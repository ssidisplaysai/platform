import { AppShell } from "@/components/layout/app-shell";
import { getInventoryMovementById } from "@/modules/foundation/inventory-repository";

type PageProps = {
  params: Promise<{ movementId: string }>;
};

export default async function InventoryMovementDetailPage({ params }: PageProps) {
  const { movementId } = await params;
  const movement = getInventoryMovementById(movementId);

  if (!movement) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">Movement {movementId} not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Movement Detail</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{movement.movementType}</h1>
          <p className="mt-2 text-sm text-zinc-400">{movement.movementId}</p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <p>Product: {movement.productId}</p>
          <p>Source: {movement.sourceLocationId ?? "none"}</p>
          <p>Destination: {movement.destinationLocationId ?? "none"}</p>
          <p>Quantity: {movement.quantity} {movement.unitOfMeasure}</p>
          <p>Status: {movement.status}</p>
          <p>Reason: {movement.reasonCode}</p>
          <p>Requested: {movement.requestedAt}</p>
          <p>Completed: {movement.completedAt ?? "pending"}</p>
          <p>Reversed Movement ID: {movement.reversedMovementId ?? "none"}</p>
        </div>
      </section>
    </AppShell>
  );
}
