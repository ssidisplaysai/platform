import { handleOrchestrations } from "@/lib/gea/orchestration-api";

export async function GET(request: Request) {
  return handleOrchestrations(request);
}
