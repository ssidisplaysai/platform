import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import {
  DOCUMENT_OBSERVABILITY_ACTIONS,
  authorizeDocumentObservability,
} from "@/lib/gop/document-observability-authorization";
import { getGenesisDocumentRuntime } from "@/platform/documents";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const decision = authorizeDocumentObservability({
    session,
    action: DOCUMENT_OBSERVABILITY_ACTIONS.health,
    route: "/api/gop/documents/health",
  });
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: decision.reason,
        reasonCode: decision.reasonCode,
        authorizationMetrics: {
          deniedCount: decision.deniedCount,
        },
      },
      { status: 403 },
    );
  }

  const runtime = await getGenesisDocumentRuntime();
  const observability = await runtime.observability();

  return NextResponse.json({
    capability: observability.capability,
    metadata: observability.metadata,
    health: observability.health,
  });
}
