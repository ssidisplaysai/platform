import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { getGenesisNotificationEngine } from "@/platform/notifications/services/runtime";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const notifications = getGenesisNotificationEngine();
  const health = await notifications.healthSnapshot();
  const readiness = await notifications.getOperationalReadiness();
  const status = health.status === "HEALTHY" ? 200 : 503;

  return NextResponse.json({
    capability: "platform.notifications",
    metadata: notifications.capabilityMetadata(),
    health,
    readiness,
  }, { status });
}
