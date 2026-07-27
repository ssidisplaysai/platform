import { NextResponse } from "next/server";
import { handleToolExecutionDetail } from "@/lib/gea/tool-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleToolExecutionDetail(request, id);
}
