import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";
import { inspectWordPressThemeShell, repairWordPressThemeShell } from "@/modules/foundation/wordpress-theme-shell-repair";

type Context = { params: Promise<{ siteId: string }> };

async function scoped(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  return hasOrganizationScope(scope) && site && isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope }) ? site : null;
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try {
    const navigation = getSiteBuildWorkspace(site).currentNavigationReview;
    return NextResponse.json({ inspection: await inspectWordPressThemeShell(site), approvedNavigation: navigation ? { navigationReviewId: navigation.navigationReviewId, status: navigation.status, items: navigation.items, footerLinks: navigation.footerLinks } : null, mutationPerformed: false });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "THEME_SHELL_INSPECTION_FAILED" }, { status: 409 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string } | null;
  if (body?.confirm !== "REPAIR_APPROVED_THEME_SHELL") return NextResponse.json({ error: "Explicit approved theme-shell repair confirmation is required." }, { status: 400 });
  const navigation = getSiteBuildWorkspace(site).currentNavigationReview;
  if (!navigation || navigation.status !== "PUBLICATION_AUTHORIZED") return NextResponse.json({ error: "Authorized Genesis navigation authority is required." }, { status: 409 });
  try {
    const repair = await repairWordPressThemeShell(site, { items: navigation.items, footerLinks: navigation.footerLinks });
    return NextResponse.json({ repair, inspection: await inspectWordPressThemeShell(site), mutationPerformed: repair.navigationCreated || repair.headerUpdated || repair.footerUpdated });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "THEME_SHELL_REPAIR_FAILED" }, { status: 409 });
  }
}