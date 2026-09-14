import { NextRequest, NextResponse } from "next/server";

import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { certifyCommercialStainlessPage23LengthOptimization, certifyCommercialStainlessPage23MediaRepair, certifyCommercialStainlessWordPressWave1, inspectCommercialStainlessWordPressStaging, listCommercialStainlessPage23LengthEvidence, listCommercialStainlessPage23RepairEvidence, listCommercialStainlessWordPressStageRecords, stageCommercialStainlessPage23LengthOptimization, stageCommercialStainlessPage23MediaRepair, stageCommercialStainlessWordPressWave1, summarizeCommercialStainlessPage23LengthEvidence, summarizeCommercialStainlessPage23RepairEvidence, summarizeCommercialStainlessWordPressStageRecord, type CommercialStainlessPage23LengthGeometry, type CommercialStainlessPage23RepairVisualCertification, type CommercialStainlessWordPressCertificationResult } from "@/modules/foundation/commercial-stainless-wordpress-staging";
import { getSiteById } from "@/modules/foundation/site-repository";

type Context = { params: Promise<{ siteId: string }> };

async function scoped(request: NextRequest, context: Context) {
  const scope = resolveRequestScope(request);
  const { siteId } = await context.params;
  const site = getSiteById(siteId);
  return hasOrganizationScope(scope) && site && isRecordInScope({ recordOrganizationId: site.organizationId, recordSiteId: site.siteId, scope }) ? site : null;
}

function redactPreflight(preflight: Awaited<ReturnType<typeof inspectCommercialStainlessWordPressStaging>>) {
  return { ...preflight, items: preflight.items.map((item) => ({ ...item, rollbackEvidence: { ...item.rollbackEvidence, contentRaw: undefined } })) };
}

const summaries = () => listCommercialStainlessWordPressStageRecords().map(summarizeCommercialStainlessWordPressStageRecord);

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  try {
    return NextResponse.json({ preflight: redactPreflight(await inspectCommercialStainlessWordPressStaging(site)), records: summaries(), page23RepairEvidence: listCommercialStainlessPage23RepairEvidence().map(summarizeCommercialStainlessPage23RepairEvidence), page23LengthEvidence: listCommercialStainlessPage23LengthEvidence().map(summarizeCommercialStainlessPage23LengthEvidence), mutationPerformed: false, publicationMutation: false });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "COMMERCIAL_STAINLESS_STAGING_PREFLIGHT_FAILED" }, { status: 409 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:manage_integrations");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const site = await scoped(request, context);
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const body = await request.json().catch(() => null) as { confirm?: string; results?: CommercialStainlessWordPressCertificationResult[]; page23Visual?: CommercialStainlessPage23RepairVisualCertification; page23LengthVisual?: { certificationId: string; geometry: CommercialStainlessPage23LengthGeometry[]; noContentRemoved: boolean; noSectionRemoved: boolean; visualHierarchyPreserved: boolean; noClipping: boolean; noOverlap: boolean; mediaCropsValid: boolean; ctaFooterCollisionFree: boolean } } | null;
  if (!body || !["STAGE_COMMERCIAL_STAINLESS_WAVE_1_AUTOSAVES", "CERTIFY_COMMERCIAL_STAINLESS_WAVE_1_AUTOSAVES", "STAGE_COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_V1", "CERTIFY_COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_V1", "STAGE_COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_V1", "CERTIFY_COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_V1"].includes(body.confirm ?? "")) return NextResponse.json({ error: "Explicit Wave 1 autosave staging, certification, or Page 23 repair confirmation is required." }, { status: 400 });
  try {
    if (body.confirm === "CERTIFY_COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_V1" && body.page23LengthVisual) {
      return NextResponse.json({ evidence: summarizeCommercialStainlessPage23LengthEvidence(certifyCommercialStainlessPage23LengthOptimization(body.page23LengthVisual)), certificationPerformed: true, wordpressMutation: false, publicationMutation: false });
    }
    if (body.confirm === "STAGE_COMMERCIAL_STAINLESS_PAGE23_LENGTH_OPTIMIZATION_V1") {
      const result = await stageCommercialStainlessPage23LengthOptimization(site);
      return NextResponse.json({ record: summarizeCommercialStainlessWordPressStageRecord(result.record), evidence: summarizeCommercialStainlessPage23LengthEvidence(result.evidence), mutationPerformed: true, wordpressMutation: true, publicationMutation: false });
    }
    if (body.confirm === "CERTIFY_COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_V1" && body.page23Visual) {
      return NextResponse.json({ evidence: summarizeCommercialStainlessPage23RepairEvidence(certifyCommercialStainlessPage23MediaRepair(body.page23Visual)), certificationPerformed: true, wordpressMutation: false, publicationMutation: false });
    }
    if (body.confirm === "STAGE_COMMERCIAL_STAINLESS_PAGE23_MEDIA_REPAIR_V1") {
      const result = await stageCommercialStainlessPage23MediaRepair(site);
      return NextResponse.json({ record: summarizeCommercialStainlessWordPressStageRecord(result.record), evidence: summarizeCommercialStainlessPage23RepairEvidence(result.evidence), mutationPerformed: true, wordpressMutation: true, publicationMutation: false });
    }
    if (body.confirm === "CERTIFY_COMMERCIAL_STAINLESS_WAVE_1_AUTOSAVES") {
      const records = await certifyCommercialStainlessWordPressWave1(site, body.results ?? []);
      return NextResponse.json({ records: records.map(summarizeCommercialStainlessWordPressStageRecord), certificationPerformed: true, wordpressMutation: false, publicationMutation: false });
    }
    const records = await stageCommercialStainlessWordPressWave1(site);
    return NextResponse.json({ records: records.map(summarizeCommercialStainlessWordPressStageRecord), mutationPerformed: true, wordpressMutation: true, publicationMutation: false });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "COMMERCIAL_STAINLESS_WAVE_1_STAGING_FAILED", records: summaries(), publicationMutation: false }, { status: 409 });
  }
}