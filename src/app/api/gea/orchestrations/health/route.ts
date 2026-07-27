import { handleOrchestrationHealth } from "@/lib/gea/orchestration-api";

export async function GET(request: Request) {
  return handleOrchestrationHealth(request);
}
