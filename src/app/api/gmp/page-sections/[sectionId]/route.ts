import { NextResponse } from "next/server";
import { handleDeleteSection, handlePatchSection } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ sectionId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { sectionId } = await context.params;
  return handlePatchSection(request, sectionId);
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { sectionId } = await context.params;
  return handleDeleteSection(request, sectionId);
}
