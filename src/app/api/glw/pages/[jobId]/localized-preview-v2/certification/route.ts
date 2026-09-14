import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { captureDallasLocalizedPreviewV2, captureSanAntonioLocalizedComposition } from "@/modules/glw/localized-preview-v2-capture-service";
import { SAN_ANTONIO_LOCALIZED_JOB_ID } from "@/modules/glw/san-antonio-localized-composition-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const auth = authorizeRequest(request, "sites:update"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status }); const scope = resolveRequestScope(request); const { jobId } = await context.params; const body = await request.json().catch(() => null) as { operation?: string } | null;
  const exactDallas = jobId === "2ca74016-252b-4587-bf3c-ec9b7eb839c9" && body?.operation === "CAPTURE_LOCALIZED_PREVIEW_V2";
  const exactSanAntonio = jobId === SAN_ANTONIO_LOCALIZED_JOB_ID && body?.operation === "CAPTURE_SAN_ANTONIO_LOCALIZED_COMPOSITION_EVIDENCE_V1";
  if (!auth.roles.includes("platform_admin") || scope.organizationId !== "ssi" || scope.siteId !== "site-ssi-projectorenclosure" || (!exactDallas && !exactSanAntonio) || Object.keys(body ?? {}).some((key) => key !== "operation")) return NextResponse.json({ error: "Exact localized-preview capture authority required." }, { status: 403 });
  try { const result = exactSanAntonio ? await captureSanAntonioLocalizedComposition() : await captureDallasLocalizedPreviewV2(); return NextResponse.json({ ...result, artifactPreserved: true, regenerationPerformed: false, workflowExecuted: false, mutationPerformed: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false }, { status: result.reused ? 200 : 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message.split(":")[0] : "LOCALIZED_PREVIEW_CAPTURE_FAILED", artifactPreserved: true, regenerationPerformed: false, workflowExecuted: false, mutationPerformed: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false }, { status: 422 }); }
}