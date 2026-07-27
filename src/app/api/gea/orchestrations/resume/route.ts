import { handleResumeOrchestration } from "@/lib/gea/orchestration-api";

export async function POST(request: Request) {
  return handleResumeOrchestration(request);
}
