import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { CONTACT_OBSERVABILITY_ACTIONS, authorizeContactObservability } from "@/lib/gop/contact-observability-authorization";
import { getGenesisContactRuntime } from "@/platform/contact";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const decision = authorizeContactObservability({
    session,
    action: CONTACT_OBSERVABILITY_ACTIONS.metrics,
    route: "/api/gop/contact/metrics",
  });
  if (!decision.allowed) {
    return NextResponse.json({
      error: decision.reason,
      reasonCode: decision.reasonCode,
      authorizationMetrics: {
        deniedCount: decision.deniedCount,
      },
    }, { status: 403 });
  }

  const runtime = await getGenesisContactRuntime();
  const observability = await runtime.observability();

  return NextResponse.json({
    capability: observability.capability,
    metadata: observability.metadata,
    metrics: observability.metrics,
    health: observability.health,
  });
}
