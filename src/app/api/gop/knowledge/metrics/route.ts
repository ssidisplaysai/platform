import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import {
  KNOWLEDGE_OBSERVABILITY_ACTIONS,
  authorizeKnowledgeObservability,
} from "@/lib/gop/knowledge-observability-authorization";
import { getGenesisKnowledgeRuntime } from "@/platform/knowledge";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const decision = authorizeKnowledgeObservability({
    session,
    action: KNOWLEDGE_OBSERVABILITY_ACTIONS.metrics,
    route: "/api/gop/knowledge/metrics",
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

  const runtime = await getGenesisKnowledgeRuntime();
  const observability = await runtime.observability();

  return NextResponse.json({
    capability: observability.capability,
    metadata: observability.metadata,
    metrics: observability.metrics,
    health: observability.health,
  });
}
