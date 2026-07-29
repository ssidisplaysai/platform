import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { listProducts } from "@/modules/foundation/product-repository";

export default function ProductsPage() {
  const products = listProducts();

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Product Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Product Registry Experience</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Govern bounded product and catalog records with deterministic readiness outcomes.
          </p>
          <div className="mt-4">
            <Link
              href="/products/new"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:border-red-500 hover:text-white"
            >
              New Product Foundation
            </Link>
          </div>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Products</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {products.map((product) => (
              <li key={product.productId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-white">{product.displayName}</p>
                    <p className="text-xs text-zinc-400">{product.sku} - {product.catalogStatus}</p>
                  </div>
                  <Link
                    href={`/products/${product.productId}`}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-red-500 hover:text-white"
                  >
                    View Product
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
