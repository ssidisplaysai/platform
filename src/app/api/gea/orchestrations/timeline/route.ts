import { handleOrchestrationTimeline } from "@/lib/gea/orchestration-api";

export async function GET(request: Request) {
  return handleOrchestrationTimeline(request);
}
