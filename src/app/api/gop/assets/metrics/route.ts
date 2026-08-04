import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { ASSET_OBSERVABILITY_ACTIONS, authorizeAssetObservability } from "@/lib/gop/asset-observability-authorization";
import { getGenesisAssetRuntime } from "@/platform/assets";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const decision = authorizeAssetObservability({
    session,
    action: ASSET_OBSERVABILITY_ACTIONS.metrics,
    route: "/api/gop/assets/metrics",
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

  const runtime = await getGenesisAssetRuntime();
  const observability = await runtime.observability();

  return NextResponse.json({
    capability: observability.capability,
    metadata: observability.metadata,
    metrics: observability.metrics,
    health: observability.health,
  });
}
