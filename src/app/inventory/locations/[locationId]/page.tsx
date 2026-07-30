import { AppShell } from "@/components/layout/app-shell";
import {
  evaluateLocationAvailability,
  getInventoryLocationById,
  listInventoryReservations,
  listInventoryStock,
  listInventoryMovements,
} from "@/modules/foundation/inventory-repository";

type PageProps = {
  params: Promise<{ locationId: string }>;
};

export default async function InventoryLocationDetailPage({ params }: PageProps) {
  const { locationId } = await params;
  const location = getInventoryLocationById(locationId);

  if (!location) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">Location {locationId} not found.</div>
      </AppShell>
    );
  }

  const stock = listInventoryStock().filter((entry) => entry.locationId === locationId);
  const reservations = listInventoryReservations().filter((entry) => entry.locationId === locationId);
  const movements = listInventoryMovements().filter((entry) => entry.sourceLocationId === locationId || entry.destinationLocationId === locationId).slice(0, 20);
  const summary = evaluateLocationAvailability(locationId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Inventory Location Detail</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{location.displayName}</h1>
          <p className="mt-2 text-sm text-zinc-400">{location.locationCode} - {location.locationType}</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <h2 className="text-lg font-semibold text-white">Identity and Capability</h2>
            <p className="mt-2">Lifecycle: {location.lifecycleState}</p>
            <p>Health: {location.healthStatus}</p>
            <p>Enabled: {location.enabled ? "Yes" : "No"}</p>
            <p>Fulfillment Capable: {location.fulfillmentCapable ? "Yes" : "No"}</p>
            <p>Reservation Capable: {location.reservationCapable ? "Yes" : "No"}</p>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <h2 className="text-lg font-semibold text-white">Inventory Summary</h2>
            <p className="mt-2">On Hand Total: {summary?.onHandTotal ?? 0}</p>
            <p>Reserved Total: {summary?.reservedTotal ?? 0}</p>
            <p>Available Total: {summary?.availableTotal ?? 0}</p>
            <p>Incoming Total: {summary?.incomingTotal ?? 0}</p>
            <p>Stock Status: {summary?.stockStatus ?? "unknown"}</p>
          </article>
        </div>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Product Stock Records</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {stock.map((entry) => (
              <li key={entry.inventoryRecordId}>{entry.productId} - on hand {entry.onHandQuantity}, available {entry.availableQuantity}</li>
            ))}
            {stock.length === 0 ? <li className="text-zinc-400">No stock records.</li> : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Reservation Totals</h2>
          <p className="mt-2 text-sm text-zinc-300">Active reservations: {reservations.filter((reservation) => reservation.status === "active").length}</p>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Recent Movements</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {movements.map((movement) => (
              <li key={movement.movementId}>{movement.completedAt ?? movement.requestedAt} - {movement.movementType} - qty {movement.quantity}</li>
            ))}
            {movements.length === 0 ? <li className="text-zinc-400">No movement activity.</li> : null}
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
