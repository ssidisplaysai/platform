import { NextResponse } from "next/server";
import { handleApprovePageBrief } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ briefId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { briefId } = await context.params;
  return handleApprovePageBrief(request, briefId);
}
