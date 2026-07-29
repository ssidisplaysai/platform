import { AppShell } from "@/components/layout/app-shell";
import { getProductById } from "@/modules/foundation/product-repository";

type PageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductSettingsPage({ params }: PageProps) {
  const { productId } = await params;
  const product = getProductById(productId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Product Settings Foundation</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{product?.displayName ?? "Unknown Product"}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Bounded editing surface for non-secret catalog references.
          </p>
        </header>

        {!product ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            Product was not found.
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
            <p>Stable Product ID: {product.productId}</p>
            <p>Organization: {product.organizationId} (reassignment restricted)</p>
            <p>SEO Profile Reference: {product.seoProfileReference ?? "Not configured"}</p>
            <p>Prompt Profile Reference: {product.promptProfileReference ?? "Not configured"}</p>
            <p>Business Genome Reference: {product.businessGenomeObjectReference ?? "Not mapped"}</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
