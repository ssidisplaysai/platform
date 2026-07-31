import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { getGenesisMessageBus } from "@/platform/messaging";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const bus = getGenesisMessageBus();
  return NextResponse.json({
    capability: "platform.messaging",
    metadata: bus.capabilityMetadata(),
    metrics: bus.getMetrics(),
    health: bus.healthSnapshot(),
    queue: bus.getQueueStats(),
    subscribers: bus.getSubscriberStats(),
    deadLetters: bus.getDeadLetters().length,
  });
}
