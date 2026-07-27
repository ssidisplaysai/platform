import { NextResponse } from "next/server";
import { handleGetSectionContent, handlePatchSectionContent } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ sectionContentId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { sectionContentId } = await context.params;
  return handleGetSectionContent(request, sectionContentId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { sectionContentId } = await context.params;
  return handlePatchSectionContent(request, sectionContentId);
}
