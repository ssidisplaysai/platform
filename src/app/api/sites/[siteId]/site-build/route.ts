import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { startSiteBuild } from "@/modules/foundation/site-generation-readiness-repository";
import { getSiteGenerationReadiness } from "@/modules/foundation/site-generation-readiness-service";
import { approveAllGeneratedPages, approveAllReadySiteDesigns, approveBuildDrafts, approveBuildPlan, assembleHomeVisualCanary, assembleRemainingSiteVisuals, createBuildWordPressDrafts, decideGeneratedPage, decideHomeVisualAssembly, decidePageImageCandidate, decideSiteVisualDesign, generateBuildDrafts, generateBuildPlan, generateFullSiteAssembly, generatePageImageCandidate, getSiteBuildWorkspace, reassembleSiteVisualDesign, regenerateGeneratedPage, rejectBuildPlan, reviseBuildPlan, updateBuildWordPressDraftContent } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };
async function scoped(request: NextRequest, context: Context) { const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId); return hasOrganizationScope(scope) && site && isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope }) ? site : null; }

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context); if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  return NextResponse.json({ workspace: getSiteBuildWorkspace(site), mutationPerformed: false });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context); if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string; certificationId?: string; instructions?: string; reason?: string; pageId?: string; slotId?: string; candidateId?: string; visualAssemblyId?: string } | null;
  const confirm = body?.confirm ?? "";
  try {
    if (confirm === "START_SITE_BUILD") {
      const result = getSiteGenerationReadiness(site);
      if (result.certification.status !== "CURRENT" || !result.certification.certification || body?.certificationId !== result.certification.certification.certificationId) return NextResponse.json({ error: "Current Generation Readiness certification is required." }, { status: 409 });
      startSiteBuild({ organizationId: site.organizationId, siteId: site.siteId, actor: "site-owner", certification: result.certification.certification });
    } else if (confirm === "GENERATE_BUILD_PLAN") generateBuildPlan(site, "site-owner");
    else if (confirm === "APPROVE_BUILD_PLAN") approveBuildPlan(site, "site-owner", body?.reason ?? "Owner approved the proposed build plan.");
    else if (confirm === "REQUEST_BUILD_PLAN_CHANGES") reviseBuildPlan(site, "site-owner", body?.instructions ?? "");
    else if (confirm === "REJECT_BUILD_PLAN") rejectBuildPlan(site, "site-owner", body?.reason ?? "Owner returned the build plan.");
    else if (confirm === "GENERATE_SITE_DRAFTS") generateBuildDrafts(site, "site-owner");
    else if (confirm === "APPROVE_SITE_DRAFTS") approveBuildDrafts(site, "site-owner");
    else if (confirm === "CREATE_WORDPRESS_DRAFTS") await createBuildWordPressDrafts(site);
    else if (confirm === "GENERATE_FULL_SITE") generateFullSiteAssembly(site, "site-owner", body?.instructions ?? "");
    else if (confirm === "APPROVE_GENERATED_PAGE") decideGeneratedPage(site, "site-owner", body?.pageId ?? "", "APPROVE");
    else if (confirm === "REQUEST_GENERATED_PAGE_CHANGES") decideGeneratedPage(site, "site-owner", body?.pageId ?? "", "REQUEST_CHANGES", body?.instructions ?? "");
    else if (confirm === "REGENERATE_GENERATED_PAGE") regenerateGeneratedPage(site, "site-owner", body?.pageId ?? "", body?.instructions ?? "");
    else if (confirm === "APPROVE_ALL_READY_PAGES") approveAllGeneratedPages(site, "site-owner");
    else if (confirm === "REQUEST_SITE_WIDE_CHANGES") generateFullSiteAssembly(site, "site-owner", body?.instructions ?? "");
    else if (confirm === "UPDATE_WORDPRESS_DRAFT_CONTENT") await updateBuildWordPressDraftContent(site);
    else if (confirm === "GENERATE_PAGE_IMAGE" || confirm === "REGENERATE_PAGE_IMAGE") await generatePageImageCandidate(site, "site-owner", body?.pageId ?? "", body?.slotId ?? "", body?.instructions ?? "");
    else if (confirm === "APPROVE_PAGE_IMAGE") decidePageImageCandidate(site, "site-owner", body?.candidateId ?? "", "APPROVE");
    else if (confirm === "REJECT_PAGE_IMAGE") decidePageImageCandidate(site, "site-owner", body?.candidateId ?? "", "REJECT");
    else if (confirm === "ASSEMBLE_HOME_VISUAL" || confirm === "REASSEMBLE_HOME_VISUAL") await assembleHomeVisualCanary(site, "site-owner", body?.instructions ?? "");
    else if (confirm === "APPROVE_HOME_VISUAL") decideHomeVisualAssembly(site, "site-owner", body?.visualAssemblyId ?? "", "APPROVE");
    else if (confirm === "REQUEST_HOME_VISUAL_CHANGES") decideHomeVisualAssembly(site, "site-owner", body?.visualAssemblyId ?? "", "REQUEST_CHANGES");
    else if (confirm === "ASSEMBLE_REMAINING_VISUALS") await assembleRemainingSiteVisuals(site, "site-owner");
    else if (confirm === "APPROVE_SITE_VISUAL") decideSiteVisualDesign(site, "site-owner", body?.visualAssemblyId ?? "", "APPROVE");
    else if (confirm === "REQUEST_SITE_VISUAL_CHANGES") decideSiteVisualDesign(site, "site-owner", body?.visualAssemblyId ?? "", "REQUEST_CHANGES");
    else if (confirm === "REASSEMBLE_SITE_VISUAL") await reassembleSiteVisualDesign(site, "site-owner", body?.visualAssemblyId ?? "", body?.instructions ?? "");
    else if (confirm === "APPROVE_ALL_READY_VISUALS") approveAllReadySiteDesigns(site, "site-owner");
    else return NextResponse.json({ error: "Explicit supported Site Build action is required." }, { status: 400 });
    return NextResponse.json({ workspace: getSiteBuildWorkspace(site), wordpressMutation: confirm === "CREATE_WORDPRESS_DRAFTS" || confirm === "UPDATE_WORDPRESS_DRAFT_CONTENT" || confirm === "ASSEMBLE_HOME_VISUAL" || confirm === "REASSEMBLE_HOME_VISUAL" || confirm === "ASSEMBLE_REMAINING_VISUALS", publicationMutation: false, siteEnabledMutation: false });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "SITE_BUILD_ACTION_FAILED" }, { status: 409 }); }
}