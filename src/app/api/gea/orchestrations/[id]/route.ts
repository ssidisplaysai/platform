import { handleGetOrchestration } from "@/lib/gea/orchestration-api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleGetOrchestration(request, id);
}
