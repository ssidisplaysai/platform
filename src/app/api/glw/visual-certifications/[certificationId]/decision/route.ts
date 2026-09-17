import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import type { RenderedVisualOwnerDecisionState } from "@/modules/foundation/rendered-visual-certification";
import { decideRenderedVisualCertification, getRenderedVisualCertificationById, getRenderedVisualCertificationState } from "@/modules/foundation/rendered-visual-certification-repository";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ certificationId: string }> }) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "platform_admin is required." }, { status: 403 });
  const scope = resolveRequestScope(request); const { certificationId } = await context.params;
  if (!scope.organizationId || !scope.siteId) return NextResponse.json({ error: "Exact organization and site scope required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { operation?: string; decision?: string; note?: string } | null;
  if (body?.operation !== "DECIDE_VISUAL_CERTIFICATION" || !["APPROVED", "NEEDS_FIX"].includes(body.decision ?? "") || Object.keys(body).some((key) => !["operation", "decision", "note"].includes(key))) return NextResponse.json({ error: "Exact APPROVED or NEEDS_FIX visual decision required." }, { status: 400 });
  const certification = getRenderedVisualCertificationById({ organizationId: scope.organizationId, siteId: scope.siteId, certificationId });
  if (!certification) return NextResponse.json({ error: "Visual certification not found." }, { status: 404 });
  const current = getRenderedVisualCertificationState({ currentIdentity: certification.identity });
  if (current.certificationState !== "CURRENT" || current.certification?.certificationId !== certification.certificationId) return NextResponse.json({ error: "VISUAL_CERTIFICATION_STALE" }, { status: 409 });
  try { const decision = decideRenderedVisualCertification({ certificationId, decision: body.decision as Extract<RenderedVisualOwnerDecisionState, "APPROVED" | "NEEDS_FIX">, actor: "platform_admin", note: body.note, currentIdentity: certification.identity }); return NextResponse.json({ decision, publicationAuthorized: false, publicationPerformed: false, wordpressMutationPerformed: false, campaignMutationPerformed: false, activationPerformed: false, dispatchPerformed: false, generationPerformed: false, certificationPerformed: false }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "VISUAL_DECISION_FAILED" }, { status: 409 }); }
}