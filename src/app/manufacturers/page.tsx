import { AppShell } from "@/components/layout/app-shell";
import { listManufacturers } from "@/modules/foundation/product-repository";

export default function ManufacturersPage() {
  const manufacturers = listManufacturers();

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Manufacturer Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Manufacturer Registry</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Manufacturer references remain non-secret and bounded to organization scope.
          </p>
        </header>

        <ul className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          {manufacturers.map((manufacturer) => (
            <li key={manufacturer.manufacturerId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="font-semibold text-white">{manufacturer.displayName}</p>
              <p>{manufacturer.slug}</p>
              <p>Status: {manufacturer.status}</p>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
