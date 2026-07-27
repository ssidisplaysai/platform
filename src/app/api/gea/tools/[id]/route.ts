import { NextResponse } from "next/server";
import { handleGetTool } from "@/lib/gea/tool-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return handleGetTool(request, id);
}
