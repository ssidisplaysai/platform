import { NextResponse } from "next/server";
import { handleExecutionTimeline } from "@/lib/gea/agent-api";

type RouteContext = { params: Promise<{ executionId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { executionId } = await context.params;
  return handleExecutionTimeline(request, executionId);
}
