import { NextResponse } from "next/server";
import { handleGetJobExecution } from "@/lib/gop/executions-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetJobExecution(id);
}
