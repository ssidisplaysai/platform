import { AppShell } from "@/components/layout/app-shell";
import { getProductById } from "@/modules/foundation/product-repository";

type PageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductSitesPage({ params }: PageProps) {
  const { productId } = await params;
  const product = getProductById(productId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Product Site Assignment Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{product?.displayName ?? "Unknown Product"}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Site assignment visibility and publication readiness are bounded and deterministic.
          </p>
        </header>

        {!product ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Product was not found.
          </div>
        ) : (
          <ul className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            {product.siteAssignments.map((assignment) => (
              <li key={assignment.siteId} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="font-semibold text-white">{assignment.siteId}</p>
                <p>Publication Status: {assignment.publicationStatus}</p>
                <p>Visibility: {assignment.visibility}</p>
                <p>Enabled: {assignment.enabledForSite ? "Yes" : "No"}</p>
              </li>
            ))}
            {product.siteAssignments.length === 0 ? (
              <li className="text-zinc-400">No site assignments configured.</li>
            ) : null}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
