import { AppShell } from "@/components/layout/app-shell";
import { getInventoryReservationById } from "@/modules/foundation/inventory-repository";

type PageProps = {
  params: Promise<{ reservationId: string }>;
};

export default async function InventoryReservationDetailPage({ params }: PageProps) {
  const { reservationId } = await params;
  const reservation = getInventoryReservationById(reservationId);

  if (!reservation) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">Reservation {reservationId} not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Reservation Detail</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{reservation.productId}</h1>
          <p className="mt-2 text-sm text-zinc-400">{reservation.reservationId}</p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <p>Status: {reservation.status}</p>
          <p>Location: {reservation.locationId}</p>
          <p>Quantity: {reservation.quantity} {reservation.unitOfMeasure}</p>
          <p>Type: {reservation.reservationType}</p>
          <p>Expires: {reservation.expiresAt ?? "none"}</p>
          <p>Requested By: {reservation.requestedBy}</p>
          <p>Released At: {reservation.releasedAt ?? "not released"}</p>
          <p>Fulfilled At: {reservation.fulfilledAt ?? "not fulfilled"}</p>
        </div>
      </section>
    </AppShell>
  );
}
