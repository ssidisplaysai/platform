import { NextResponse } from "next/server";
import { handleGetContentEligibility } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ pageId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { pageId } = await context.params;
  return handleGetContentEligibility(request, pageId);
}
