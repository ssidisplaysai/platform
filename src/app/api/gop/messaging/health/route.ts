import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { getGenesisMessageBus } from "@/platform/messaging";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const bus = getGenesisMessageBus();
  const readiness = await bus.getOperationalReadiness();
  return NextResponse.json({
    capability: "platform.messaging",
    metadata: bus.capabilityMetadata(),
    health: bus.healthSnapshot(),
    readiness,
  });
}
