import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";
import { SiteVisualReviewWorkflow } from "@/modules/foundation/SiteVisualReviewWorkflow";

export default async function SiteDesignsPage({ params }: { params: Promise<{ siteId: string }> }) { const { siteId } = await params; const site = getSiteById(siteId); if (!site) return <AppShell><p>Site not found.</p></AppShell>; const workspace = getSiteBuildWorkspace(site); const pages = workspace.currentAssembly?.pages.filter((page) => page.pageRole !== "HOME").map((page) => ({ pageId: page.pageId, name: page.name, pageRole: page.pageRole, canonicalPath: page.canonicalPath })) ?? []; return <AppShell resourceSite={createSiteContext(site)}><SiteVisualReviewWorkflow initialAssemblies={workspace.remainingVisualAssemblies} pages={pages} initialSummary={workspace.remainingVisualSummary} site={{ organizationId: site.organizationId, siteId: site.siteId }} /></AppShell>; }
