import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { buildProjectorEnclosureSitewideInventory } from "@/modules/foundation/projectorenclosure-sitewide-inventory-service";
import { getLatestProjectorEnclosureInventorySnapshot } from "@/modules/foundation/projectorenclosure-sitewide-inventory-repository";
import { getSiteById } from "@/modules/foundation/site-repository";

export async function GET(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId);
  if (!site || siteId !== "site-ssi-projectorenclosure" || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "ProjectorEnclosure scope required." }, { status: 403 });
  const snapshot = getLatestProjectorEnclosureInventorySnapshot(); return snapshot ? NextResponse.json(snapshot) : NextResponse.json({ error: "No inventory snapshot exists." }, { status: 404 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId); const body = await request.json().catch(() => null) as { operation?: string } | null;
  if (!site || siteId !== "site-ssi-projectorenclosure" || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "ProjectorEnclosure scope required." }, { status: 403 });
  if (body?.operation !== "BUILD_READ_ONLY_SITEWIDE_INVENTORY") return NextResponse.json({ error: "Explicit read-only inventory operation required." }, { status: 400 });
  const snapshot = await buildProjectorEnclosureSitewideInventory(site); return NextResponse.json(snapshot);
}