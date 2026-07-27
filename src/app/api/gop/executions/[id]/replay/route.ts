import { NextResponse } from "next/server";
import { handleReplayExecution } from "@/lib/gop/executions-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleReplayExecution(request, id);
}
