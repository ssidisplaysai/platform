import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { getGenesisContactRuntime } from "@/platform/contact";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
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
