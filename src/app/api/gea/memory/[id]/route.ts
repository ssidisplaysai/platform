import { handleGetMemory } from "@/lib/gea/memory-api";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleGetMemory(request, id);
}
