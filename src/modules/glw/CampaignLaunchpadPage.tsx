import Link from "next/link";
import { createFoundationContext } from "@/modules/foundation/context";
import { listProducts } from "@/modules/foundation/product-repository";
import { listSites } from "@/modules/foundation/site-repository";
import { resolveGlwAtomicLaunchExecutionCapability, resolveGlwLaunchExecutionCapability } from "./campaign-launch-capability";
import { CampaignLaunchpad } from "./CampaignLaunchpad";

export function CampaignLaunchpadPage() {
  const context = createFoundationContext();
  const launchExecutionAvailable = resolveGlwLaunchExecutionCapability({
    nodeEnvironment: process.env.NODE_ENV,
    syntheticFlag: process.env.GLW_LAUNCHPAD_SYNTHETIC_LAUNCH,
  });
  const atomicLaunchAvailable = resolveGlwAtomicLaunchExecutionCapability({
    nodeEnvironment: process.env.NODE_ENV,
    atomicFlag: process.env.GLW_LAUNCHPAD_ATOMIC_LAUNCH,
  });
  const sites = listSites().filter((site) => site.organizationId === context.selectedOrganizationId && site.canonicalUrl);
  const existingProducts = sites.flatMap((site) => listProducts()
    .filter((product) => product.organizationId === context.selectedOrganizationId && product.assignedSiteIds.includes(site.siteId))
    .map((product) => ({
      name: `${product.displayName} - ${site.displayName}`,
      url: new URL(product.siteAssignments.find((item) => item.siteId === site.siteId)?.siteSpecificSlug ?? product.slug, `${site.canonicalUrl}/`).toString(),
    })));
  return (
    <div className="space-y-6">
      <header className="border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">GLW / Campaigns</p>
            <h1 className="mt-2 text-2xl font-black text-white">Campaign Launchpad</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">Choose the footprint, identify the product, and let Genesis assess what can be launched safely.</p>
          </div>
          <Link href="/glw" className="w-fit border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-red-500 hover:text-white">GLW Home</Link>
        </div>
      </header>
      <CampaignLaunchpad organizationId={context.selectedOrganizationId} requestRoles={context.user.roles} existingProducts={existingProducts} launchExecutionAvailable={launchExecutionAvailable} atomicLaunchAvailable={atomicLaunchAvailable} />
    </div>
  );
}