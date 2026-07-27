import { NextResponse } from "next/server";
import { handleListPageBriefVersions } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ briefId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { briefId } = await context.params;
  return handleListPageBriefVersions(request, briefId);
}
