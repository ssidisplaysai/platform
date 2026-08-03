import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { getGenesisSchedulingEngine } from "@/platform/scheduling";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const scheduling = getGenesisSchedulingEngine();
  return NextResponse.json({
    capability: "platform.scheduling",
    metadata: scheduling.capabilityMetadata(),
    health: await scheduling.healthSnapshot(),
    readiness: scheduling.getOperationalReadiness(),
  });
}
