import { handlePauseOrchestration } from "@/lib/gea/orchestration-api";

export async function POST(request: Request) {
  return handlePauseOrchestration(request);
}
