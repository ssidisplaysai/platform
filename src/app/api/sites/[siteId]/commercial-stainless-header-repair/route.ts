import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { saveCommercialStainlessHeaderRepairReceipt } from "@/modules/foundation/commercial-stainless-header-repair-repository";
import { getSiteBuildWorkspace } from "@/modules/foundation/site-build-service";
import { getSiteById } from "@/modules/foundation/site-repository";
import { repairCommercialStainlessHeaderComposition } from "@/modules/foundation/wordpress-theme-shell-repair";

export const dynamic = "force-dynamic"; export const maxDuration = 60;
export async function POST(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:manage_integrations"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "platform_admin is required." }, { status: 403 });
  const scope = resolveRequestScope(request); const { siteId } = await context.params;
  if (scope.organizationId !== "rj-metal" || scope.siteId !== siteId || siteId !== "site-rj-metal-commercial-stainless-counters") return NextResponse.json({ error: "Exact Commercial Stainless scope required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { operation?: string; expectedHeaderHash?: string; beforeVisualCertificationId?: string } | null;
  if (body?.operation !== "APPLY_COMMERCIAL_STAINLESS_HEADER_REPAIR" || !body.expectedHeaderHash || body.beforeVisualCertificationId !== "visual-certification-ecb5e23a-c7af-4ff4-b8f1-0b64a0edfdd7" || Object.keys(body).some((key) => !["operation", "expectedHeaderHash", "beforeVisualCertificationId"].includes(key))) return NextResponse.json({ error: "Exact header repair authority is required." }, { status: 400 });
  const site = getSiteById(siteId); if (!site) return NextResponse.json({ error: "Site not found." }, { status: 404 });
  try { const workspace = getSiteBuildWorkspace(site); const page = workspace.currentAssembly?.pages.find((item) => item.pageRole === "HOME"); if (!page || !workspace.currentVisualAssembly || workspace.currentVisualAssembly.pageRevisionId !== page.pageRevisionId) throw new Error("HEADER_REPAIR_BODY_AUTHORITY_MISMATCH"); const repair = await repairCommercialStainlessHeaderComposition(site, body.expectedHeaderHash); const receipt = saveCommercialStainlessHeaderRepairReceipt({ contract: "commercial-stainless-header-repair-v1", organizationId: "rj-metal", siteId: "site-rj-metal-commercial-stainless-counters", beforeVisualCertificationId: body.beforeVisualCertificationId, headerTemplatePartId: repair.headerTemplatePartId, navigationId: repair.navigationId, beforeHeaderHash: repair.beforeHeaderHash, afterHeaderHash: repair.afterHeaderHash, footerHash: repair.footerHash, navigationHash: repair.navigationHash, bodyContentHash: page.contentFingerprint, compositionVersion: repair.compositionVersion, actor: "platform_admin", completedAt: new Date().toISOString(), bodyUpdated: false, footerUpdated: false, navigationUpdated: false, publicationWorkflowPerformed: false }); return NextResponse.json({ repair, receipt, mutationPerformed: true, bodyMutationPerformed: false, footerMutationPerformed: false, navigationMutationPerformed: false, publicationPerformed: false }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message.split(":")[0] : "HEADER_REPAIR_FAILED", mutationPerformed: false }, { status: 409 }); }
}