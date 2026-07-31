import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { getGenesisWorkflowEngine } from "@/platform/workflow";

export async function GET(): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
  }

  const workflow = getGenesisWorkflowEngine();
  const health = await workflow.healthSnapshot();

  return NextResponse.json({
    capability: "platform.workflow",
    metadata: workflow.capabilityMetadata(),
    health,
    readiness: workflow.getOperationalReadiness(),
  });
}
