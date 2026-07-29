import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listInventoryStock } from "@/modules/foundation/inventory-repository";
import { getProductById } from "@/modules/foundation/product-repository";

export default function InventoryPage() {
  const stock = listInventoryStock();

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Inventory Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Inventory and Availability</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Deterministic stock, reservation, movement, and reorder visibility.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/inventory/locations" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Locations</Link>
            <Link href="/inventory/movements" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Movements</Link>
            <Link href="/inventory/reservations" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Reservations</Link>
          </div>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Inventory List</h2>
          {stock.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No inventory records available.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {stock.map((record) => {
                const product = getProductById(record.productId);
                return (
                  <li key={record.inventoryRecordId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-white">{product?.displayName ?? record.productId}</p>
                        <p className="text-xs text-zinc-400">{record.skuSnapshot} @ {record.locationId}</p>
                      </div>
                      <div className="text-xs text-zinc-300">
                        <p>On Hand: {record.onHandQuantity}</p>
                        <p>Reserved: {record.reservedQuantity}</p>
                        <p>Available: {record.availableQuantity}</p>
                        <p>Incoming: {record.incomingQuantity}</p>
                        <p>Status: {record.stockStatus}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
