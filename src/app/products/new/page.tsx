import { AppShell } from "@/components/layout/app-shell";

export default function NewProductPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Product Creation Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Add New Product (Bounded)</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Product creation is API-driven and enforces non-secret references only.
          </p>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          Use POST /api/products to create product records with bounded governance checks.
        </div>
      </section>
    </AppShell>
  );
}
