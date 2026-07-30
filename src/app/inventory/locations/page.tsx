import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listInventoryLocations } from "@/modules/foundation/inventory-repository";

export default function InventoryLocationsPage() {
  const locations = listInventoryLocations();

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Inventory Locations</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Location Registry</h1>
          <p className="mt-2 text-sm text-zinc-400">Bounded location identity, lifecycle, capability, and health state.</p>
        </header>

        <ul className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          {locations.map((location) => (
            <li key={location.locationId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-white">{location.displayName}</p>
                  <p className="text-xs text-zinc-400">{location.locationCode} - {location.locationType}</p>
                </div>
                <Link href={`/inventory/locations/${location.locationId}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white">View Detail</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
