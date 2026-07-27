import { handleOrchestrationApprovals } from "@/lib/gea/orchestration-api";

export async function GET(request: Request) {
  return handleOrchestrationApprovals(request);
}
