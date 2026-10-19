import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteAssemblyNativePreview } from "@/modules/foundation/SiteAssemblyNativePreview";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteIntelligenceWorkspace } from "@/modules/foundation/site-intelligence-repository";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function SiteBuildNativePreviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;

  const workspace = getSiteBuildWorkspace(site);
  const assembly = workspace.currentAssembly;
  const intelligence = getSiteIntelligenceWorkspace(site.siteId);
  const strategy = [...(intelligence?.strategyRevisions ?? [])].filter((item) => item.status === "APPROVED").sort((left, right) => right.revision - left.revision)[0] ?? null;
  const creative = [...(intelligence?.creativeRevisions ?? [])].filter((item) => item.status === "APPROVED").sort((left, right) => right.revision - left.revision)[0] ?? null;
  const approvedAssets = (intelligence?.creativeInputs ?? [])
    .filter((item) => item.binaryAsset && item.classification === "OWNER_APPROVED_PUBLISHABLE")
    .map((item) => ({
      inputId: item.inputId,
      kind: item.kind,
      classification: item.classification,
      fileName: item.binaryAsset!.originalFileName,
      assetId: item.binaryAsset!.assetId,
    }));
  const imageCandidates = [...workspace.imageCandidates]
    .filter((item) => item.status === "APPROVED" || item.status === "READY_FOR_OWNER_REVIEW")
    .sort((left, right) => right.revision - left.revision)
    .map((item) => ({
      candidateId: item.candidateId,
      pageId: item.pageId,
      slotId: item.slotId,
      placementHint: item.slotId.split("-").at(-1) ?? item.slotId,
      status: item.status,
    }));

  return (
    <AppShell resourceSite={createSiteContext(site)}>
      {assembly
        ? (
          <SiteAssemblyNativePreview
            site={{ organizationId: site.organizationId, siteId: site.siteId, displayName: site.displayName }}
            assembly={assembly}
            strategy={strategy}
            creative={creative}
            approvedAssets={approvedAssets}
            imageCandidates={imageCandidates}
          />
        )
        : <section className="border border-zinc-800 bg-zinc-950 p-6 text-zinc-300">No current Genesis assembly is available for native preview.</section>}
    </AppShell>
  );
}
