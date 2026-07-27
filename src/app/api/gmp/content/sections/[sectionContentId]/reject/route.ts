import { NextResponse } from "next/server";
import { handleRejectSection } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ sectionContentId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { sectionContentId } = await context.params;
  return handleRejectSection(request, sectionContentId);
}
