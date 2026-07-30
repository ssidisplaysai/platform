import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { createFoundationContext } from "@/modules/foundation/context";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { listProductActivity } from "@/modules/foundation/product-audit";
import { evaluateProductReadiness } from "@/modules/foundation/product-readiness";
import { getProductById } from "@/modules/foundation/product-repository";

type PageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { productId } = await params;
  const context = createFoundationContext();
  const permissions = resolvePermissions(context.user.roles);
  const product = getProductById(productId);

  if (!product) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
          Product {productId} was not found.
        </div>
      </AppShell>
    );
  }

  const readiness = evaluateProductReadiness({
    product,
    requiredPermission: "products:evaluate_readiness",
    permissions,
  });

  const activity = listProductActivity(product.productId);

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Product Detail</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{product.displayName}</h1>
          <p className="mt-2 text-sm text-zinc-400">{product.sku}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-zinc-700 px-2 py-1">{product.lifecycleState}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{product.catalogStatus}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{product.visibility}</span>
            <span className="rounded-full border border-zinc-700 px-2 py-1">{product.enabled ? "enabled" : "disabled"}</span>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-semibold text-white">Configuration</h2>
            <dl className="mt-3 space-y-2 text-sm text-zinc-300">
              <div><dt className="text-zinc-500">Product ID</dt><dd>{product.productId}</dd></div>
              <div><dt className="text-zinc-500">Organization</dt><dd>{product.organizationId}</dd></div>
              <div><dt className="text-zinc-500">Slug</dt><dd>{product.slug}</dd></div>
              <div><dt className="text-zinc-500">Primary Site</dt><dd>{product.primarySiteId ?? "Not assigned"}</dd></div>
              <div><dt className="text-zinc-500">Manufacturer</dt><dd>{product.manufacturerId ?? "Not assigned"}</dd></div>
              <div><dt className="text-zinc-500">Categories</dt><dd>{product.categoryIds.join(", ") || "None"}</dd></div>
            </dl>
          </article>

          <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-lg font-semibold text-white">Readiness</h2>
            <p className="mt-2 text-sm text-zinc-300">Status: {readiness.status}</p>
            <p className="text-sm text-zinc-300">Ready: {readiness.ready ? "Yes" : "No"}</p>
            <ul className="mt-3 space-y-1 text-xs text-amber-300">
              {readiness.blockingReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </article>
        </div>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Recent Product Activity</h2>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No product activity recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {activity.map((entry) => (
                <li key={entry.activityId}>{entry.createdAt} - {entry.type} - {entry.summary}</li>
              ))}
            </ul>
          )}
        </article>

        <div className="flex gap-3">
          <Link href={`/products/${product.productId}/settings`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Product Settings</Link>
          <Link href={`/products/${product.productId}/sites`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Site Assignments</Link>
          <Link href={`/products/${product.productId}/specifications`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-white">Specifications</Link>
        </div>
      </section>
    </AppShell>
  );
}
