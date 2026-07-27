import { handleCancelOrchestration } from "@/lib/gea/orchestration-api";

export async function POST(request: Request) {
  return handleCancelOrchestration(request);
}
