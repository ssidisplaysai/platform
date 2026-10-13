import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, resolveRequestScope } from "@/modules/foundation/api-auth";
import { certifyCommercialStainlessCompositionRepair } from "@/modules/foundation/commercial-stainless-composition-repair";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  const auth = authorizeRequest(request, "sites:read"); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request); const { siteId } = await context.params;
  if (scope.organizationId !== "rj-metal" || scope.siteId !== siteId || siteId !== "site-rj-metal-commercial-stainless-counters") return NextResponse.json({ error: "Exact Commercial Stainless scope required." }, { status: 403 });
  try { return NextResponse.json(await certifyCommercialStainlessCompositionRepair()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message.split(":")[0] : "COMPOSITION_REPAIR_CERTIFICATION_FAILED", mutationPerformed: false }, { status: 409 }); }
}