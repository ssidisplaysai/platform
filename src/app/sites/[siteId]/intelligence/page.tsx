import { AppShell } from "@/components/layout/app-shell";
import { SiteIntelligenceWorkspace } from "@/modules/foundation/SiteIntelligenceWorkspace";
import { getIntegrationProfileById } from "@/modules/foundation/integration-profile-repository";
import { getSiteById } from "@/modules/foundation/site-repository";

type PageProps = { params: Promise<{ siteId: string }> };

export default async function SiteIntelligencePage({ params }: PageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  const brandProfile = site?.profiles.brandProfileReference
    ? getIntegrationProfileById(site.profiles.brandProfileReference)
    : null;
  const publicBrandIdentity = brandProfile?.organizationId === site?.organizationId
    ? brandProfile.profileName.split(/\s+[—-]\s+/)[0]?.trim() || site.displayName
    : site?.displayName ?? "";
  return <AppShell>{site ? <SiteIntelligenceWorkspace organizationId={site.organizationId} siteId={site.siteId} siteName={site.displayName} publicBrandIdentity={publicBrandIdentity} /> : <div className="border border-zinc-800 p-6 text-zinc-300">Site not found.</div>}</AppShell>;
}