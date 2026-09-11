import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWorkflow } from "@/modules/foundation/SiteBuildWorkflow";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function SiteBuildPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params; const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  return <AppShell resourceSite={createSiteContext(site)}><SiteBuildWorkflow initialWorkspace={workspace} /></AppShell>;
}