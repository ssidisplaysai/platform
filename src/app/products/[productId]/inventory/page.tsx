import { AppShell } from "@/components/layout/app-shell";
import { evaluateInventoryAvailability, getProductInventorySummary } from "@/modules/foundation/inventory-repository";
import { getProductById } from "@/modules/foundation/product-repository";

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function ProductInventoryPage({ params }: PageProps) {
  const { productId } = await params;
  const product = getProductById(productId);

  if (!product) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">Product {productId} was not found.</div>
      </AppShell>
    );
  }

  const summary = getProductInventorySummary(productId);
  const availability = evaluateInventoryAvailability({
    organizationId: product.organizationId,
    productId,
    siteId: product.primarySiteId,
  });

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Product Inventory</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">{product.displayName}</h1>
          <p className="mt-2 text-sm text-zinc-400">{product.sku}</p>
        </header>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
          <h2 className="text-lg font-semibold text-white">Availability Summary</h2>
          <p className="mt-2">On Hand: {availability.onHandTotal}</p>
          <p>Reserved: {availability.reservedTotal}</p>
          <p>Available: {availability.availableTotal}</p>
          <p>Incoming: {availability.incomingTotal}</p>
          <p>Status: {availability.stockStatus}</p>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Location Breakdown</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {availability.locationSummaries.map((location) => (
              <li key={location.locationId}>{location.locationName} - available {location.availableQuantity}</li>
            ))}
            {availability.locationSummaries.length === 0 ? <li className="text-zinc-400">No location summaries available.</li> : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-lg font-semibold text-white">Reservations and Movements</h2>
          <p className="mt-2 text-sm text-zinc-300">Reservations: {summary.reservations.length}</p>
          <p className="text-sm text-zinc-300">Recent Movements: {summary.movements.length}</p>
        </article>
      </section>
    </AppShell>
  );
}
