import { AppShell } from "@/components/layout/app-shell";

export default function InventoryMovementNewPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Movement Creation Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Create Inventory Movement</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Use POST /api/inventory/movements with authorized role and validated payload.
          </p>
        </header>
      </section>
    </AppShell>
  );
}
