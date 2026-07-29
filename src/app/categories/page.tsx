import { AppShell } from "@/components/layout/app-shell";
import { listCategories } from "@/modules/foundation/product-repository";

export default function CategoriesPage() {
  const categories = listCategories();

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Category Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Category Registry</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Category hierarchy is bounded and validated for cycle prevention.
          </p>
        </header>

        <ul className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          {categories.map((category) => (
            <li key={category.categoryId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="font-semibold text-white">{category.name}</p>
              <p>{category.slug}</p>
              <p>Parent: {category.parentCategoryId ?? "root"}</p>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
