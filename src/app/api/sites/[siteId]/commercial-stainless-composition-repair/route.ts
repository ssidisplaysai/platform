import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { executeCommercialStainlessCompositionRepair, inspectCommercialStainlessCompositionAuthority } from "@/modules/foundation/commercial-stainless-composition-repair";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: Promise<{ siteId: string }> };

function scoped(request: NextRequest, siteId: string) { const scope = resolveRequestScope(request); return scope.organizationId === "rj-metal" && scope.siteId === siteId && siteId === "site-rj-metal-commercial-stainless-counters"; }
export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { siteId } = await context.params; if (!scoped(request, siteId)) return NextResponse.json({ error: "Exact Commercial Stainless scope required." }, { status: 403 });
  try { const authority = await inspectCommercialStainlessCompositionAuthority(); return NextResponse.json({ pageRevisionId: authority.page.pageRevisionId, wordpressObjectId: authority.current.id, wordpressStatus: authority.current.status, contentHash: authority.current.contentHash, featuredMediaId: authority.current.featuredMediaId, templateIdentity: authority.current.template, navigationId: authority.shell.ownedNavigationId, headerTemplatePartId: authority.shell.header.id, footerTemplatePartId: authority.shell.footer.id, mutationPerformed: false }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message.split(":")[0] : "COMPOSITION_REPAIR_PREFLIGHT_FAILED", mutationPerformed: false }, { status: 409 }); }
}
export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.roles.includes("platform_admin")) return NextResponse.json({ error: "platform_admin is required." }, { status: 403 });
  const { siteId } = await context.params; if (!scoped(request, siteId)) return NextResponse.json({ error: "Exact Commercial Stainless scope required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { operation?: string; expectedPageRevisionId?: string; expectedBeforeCertificationId?: string } | null;
  if (body?.operation !== "APPLY_COMMERCIAL_STAINLESS_COMPOSITION_REPAIR" || !body.expectedPageRevisionId || !body.expectedBeforeCertificationId || Object.keys(body).some((key) => !["operation", "expectedPageRevisionId", "expectedBeforeCertificationId"].includes(key))) return NextResponse.json({ error: "Exact composition repair authority is required." }, { status: 400 });
  try { const result = await executeCommercialStainlessCompositionRepair({ actor: "platform_admin", expectedPageRevisionId: body.expectedPageRevisionId, expectedBeforeCertificationId: body.expectedBeforeCertificationId }); return NextResponse.json(result, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message.split(":")[0] : "COMPOSITION_REPAIR_FAILED", publicationPerformed: false, campaignMutationPerformed: false }, { status: 409 }); }
}