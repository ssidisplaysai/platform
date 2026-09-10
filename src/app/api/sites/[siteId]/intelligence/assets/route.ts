import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getIntegrationProfileById } from "@/modules/foundation/integration-profile-repository";
import { storeSiteIntelligenceAsset } from "@/modules/foundation/site-intelligence-asset-store";
import { addCreativeInput, ensureSiteIntelligenceWorkspace } from "@/modules/foundation/site-intelligence-repository";
import type { SiteAssetClassification } from "@/modules/foundation/site-intelligence";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };
const CLASSIFICATIONS = new Set<SiteAssetClassification>(["OWNER_APPROVED_PUBLISHABLE", "OWNER_SUPPLIED_REFERENCE", "EXTERNAL_INSPIRATION_ONLY", "COMPETITOR_REFERENCE_ONLY", "UNVERIFIED"]);

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params; const site = getSiteById(siteId);
  if (!hasOrganizationScope(scope) || !site || !isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope })) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const form = await request.formData(); const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0 || files.length > 10) return NextResponse.json({ error: "Upload between 1 and 10 files." }, { status: 400 });
  const classification = String(form.get("classification") ?? "OWNER_SUPPLIED_REFERENCE") as SiteAssetClassification;
  if (!CLASSIFICATIONS.has(classification)) return NextResponse.json({ error: "Invalid asset classification." }, { status: 400 });
  const total = files.reduce((sum, file) => sum + file.size, 0); if (total > 50 * 1024 * 1024) return NextResponse.json({ error: "Upload batch exceeds 50 MB." }, { status: 413 });
  const brand = site.profiles.brandProfileReference ? getIntegrationProfileById(site.profiles.brandProfileReference) : null;
  let workspace = ensureSiteIntelligenceWorkspace({ organizationId: site.organizationId, siteId: site.siteId, publicBrandIdentity: brand?.organizationId === site.organizationId ? brand.profileName.split(/\s+[—-]\s+/)[0] : site.displayName, actor: "site-owner" });
  const assets = [];
  try {
    for (const file of files) {
      const asset = storeSiteIntelligenceAsset({ organizationId: site.organizationId, siteId: site.siteId, originalFileName: file.name, mediaType: file.type, bytes: new Uint8Array(await file.arrayBuffer()), actor: "site-owner", classification, note: String(form.get("notes") ?? "") || null });
      workspace = addCreativeInput({ organizationId: site.organizationId, siteId: site.siteId, expectedRevision: workspace.revision, actor: "site-owner", reason: "Owner uploaded a classified creative input.", creativeInput: { inputId: asset.assetId, kind: file.type === "application/pdf" ? "TEXT" : "IMAGE", reference: asset.providerReference, sentiment: String(form.get("sentiment") ?? "NEUTRAL") as "LIKE" | "DISLIKE" | "NEUTRAL", classification, notes: asset.note, suppliedBy: asset.uploadedBy, suppliedAt: asset.uploadedAt, binaryAsset: asset } });
      assets.push(asset);
    }
    return NextResponse.json({ workspace, assets }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 422 }); }
}