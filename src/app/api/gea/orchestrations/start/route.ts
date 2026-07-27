import { handleStartOrchestration } from "@/lib/gea/orchestration-api";

export async function POST(request: Request) {
  return handleStartOrchestration(request);
}
