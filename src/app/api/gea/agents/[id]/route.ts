import { NextResponse } from "next/server";
import { handleGetAgent } from "@/lib/gea/agent-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetAgent(request, id);
}
