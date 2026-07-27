import { NextResponse } from "next/server";
import { handleGetPageBrief, handleUpdatePageBrief } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ briefId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { briefId } = await context.params;
  return handleGetPageBrief(request, briefId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { briefId } = await context.params;
  return handleUpdatePageBrief(request, briefId);
}
