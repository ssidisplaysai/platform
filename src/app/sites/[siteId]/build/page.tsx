import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { createSiteContext } from "@/modules/foundation/context";
import { SiteBuildWorkflow } from "@/modules/foundation/SiteBuildWorkflow";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

export default async function SiteBuildPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params; const site = getSiteById(siteId);
  if (!site) return <AppShell><p className="p-6 text-zinc-300">Site not found.</p></AppShell>;
  const workspace = getSiteBuildWorkspace(site);
  const showContinuation = ["HOME_DESIGN_REVIEW", "SITE_VISUAL_REVIEW", "SITE_QA", "NAVIGATION_REVIEW", "WORDPRESS_MENU_SYNC", "PUBLICATION_READINESS", "PUBLICATION_AUTHORIZATION", "PUBLICATION_EXECUTION_REVIEW", "PUBLICATION_EXECUTING", "PUBLICATION_VERIFICATION", "COMPLETE"].includes(workspace.stage);
  return <AppShell resourceSite={createSiteContext(site)}>{showContinuation ? <section className="mb-6 border-l-4 border-red-600 bg-red-950/20 p-5"><p className="text-xs font-semibold uppercase text-red-300">Current Governed Stage</p><h1 className="mt-2 text-xl font-semibold text-white">{workspace.next.label}</h1><p className="mt-2 text-sm text-zinc-300">{workspace.next.detail}</p><Link href={workspace.next.route} className="mt-4 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white">{workspace.next.label}</Link></section> : null}<SiteBuildWorkflow initialWorkspace={workspace} /></AppShell>;
}