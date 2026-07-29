import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listInventoryReservations } from "@/modules/foundation/inventory-repository";

export default function InventoryReservationsPage() {
  const reservations = listInventoryReservations();

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Inventory Reservations</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Reservation Registry</h1>
          <p className="mt-2 text-sm text-zinc-400">Bounded hold and release records for inventory availability control.</p>
        </header>

        <ul className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          {reservations.map((reservation) => (
            <li key={reservation.reservationId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">{reservation.productId}</p>
                  <p className="text-xs text-zinc-400">{reservation.reservationId}</p>
                </div>
                <Link href={`/inventory/reservations/${reservation.reservationId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">View</Link>
              </div>
            </li>
          ))}
          {reservations.length === 0 ? <li className="text-zinc-400">No reservations recorded yet.</li> : null}
        </ul>
      </section>
    </AppShell>
  );
}
