import { handleStreamJobEvents } from "@/lib/gop/events-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  return handleStreamJobEvents(request, id);
}
