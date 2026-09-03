import Link from "next/link";
import {
  createFoundationContext,
} from "@/modules/foundation/context";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { listProducts } from "@/modules/foundation/product-repository";
import { listSites } from "@/modules/foundation/site-repository";
import { GlwExistingDraftSeoRefresh } from "./GlwExistingDraftSeoRefresh";
import { GlwPageGenerationWorkspace } from "./GlwPageGenerationWorkspace";
import { getGlwN8nMcpConfigurationStatus } from "./n8n-mcp-adapter";
import { adaptProductForGeneration, adaptSiteForGeneration } from "./page-generation";

type GlwPagesCenterProps = {
  requestedOrganizationId?: string | null;
  requestedSiteId?: string | null;
};

export function GlwPagesCenter({
  requestedOrganizationId = null,
  requestedSiteId = null,
}: GlwPagesCenterProps = {}) {
  const context = createFoundationContext();
  const persistedSites = listSites();

  const requestedSite =
    requestedOrganizationId && requestedSiteId
      ? persistedSites.find(
          (site) =>
            site.siteId === requestedSiteId &&
            site.organizationId === requestedOrganizationId,
        ) ?? null
      : null;

  const effectiveOrganizationId =
    requestedSite?.organizationId ??
    context.selectedOrganizationId;

  const effectiveSiteId =
    requestedSite?.siteId ??
    context.selectedSiteId;

  const selectedOrganization =
    context.organizations.find(
      (organization) =>
        organization.id === effectiveOrganizationId,
    ) ?? null;

  const currentSites = persistedSites.filter(
    (site) =>
      site.organizationId === effectiveOrganizationId &&
      (
        requestedSite
          ? site.siteId === effectiveSiteId
          : true
      ),
  );

  const profiles = listIntegrationProfiles({
    organizationId: effectiveOrganizationId,
  });
  const availableSites = currentSites.map((site) =>
    adaptSiteForGeneration(
      site,
      profiles.filter(
        (profile) => profile.assignedSiteIds.includes(site.siteId),
      ).length,
    ),
  );

  const availableProducts = currentSites.flatMap((site) =>
    listProducts()
      .filter(
        (product) =>
          product.organizationId === effectiveOrganizationId &&
          product.assignedSiteIds.includes(site.siteId),
      )
      .map((product) => adaptProductForGeneration(product, site.siteId)),
  );
  const permissions = resolvePermissions(context.user.roles);
  const executionConfiguration = getGlwN8nMcpConfigurationStatus();
  const canPrepareRequest =
    permissions.has("sites:read") &&
    permissions.has("products:read") &&
    permissions.has("profiles:read");

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">GLW</p>
            <h1 className="mt-2 text-2xl font-black text-white">Page Studio</h1>
            <p className="mt-2 text-sm text-zinc-300">
              Create, preflight and generate WordPress draft pages for the selected Genesis site.
            </p>
          </div>
          <Link
            href="/glw"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-red-500 hover:text-white"
          >
            GLW Home
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-white">Workspace</h2>
          <p className="mt-2 text-sm text-zinc-300">
            {selectedOrganization?.name ?? "No organization selected"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Organization ID: {effectiveOrganizationId || "Unavailable"}
          </p>
        </article>

        <article className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-white">Site Content</h2>
          <p className="mt-2 text-sm text-zinc-300">
            {availableSites.length} sites and {availableProducts.length} site-assigned products are available.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Sites, products and publishing authority come from the current Genesis workspace.
          </p>
        </article>
      </section>

      {effectiveSiteId ? (
        <GlwExistingDraftSeoRefresh
          organizationId={effectiveOrganizationId}
          siteId={effectiveSiteId}
          defaultJobId="c0f2922e-d7b9-48e7-81a6-c4c79b4a938a"
        />
      ) : null}

      <GlwPageGenerationWorkspace
        sites={availableSites}
        products={availableProducts}
        canPrepareRequest={canPrepareRequest}
        executionConfigured={executionConfiguration.configured}
        executionWorkflowName="n8n MCP"
        requestRoles={context.user.roles}
        organizationId={effectiveOrganizationId}
      />
    </div>
  );
}
