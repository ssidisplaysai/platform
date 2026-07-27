import { NextResponse } from "next/server";
import { handleListSectionRevisions } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ sectionContentId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { sectionContentId } = await context.params;
  return handleListSectionRevisions(request, sectionContentId);
}
