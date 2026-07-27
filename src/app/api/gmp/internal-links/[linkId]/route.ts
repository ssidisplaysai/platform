import { NextResponse } from "next/server";
import { handleDeleteInternalLink, handlePatchInternalLink } from "@/lib/gmp/page-api";

type RouteContext = { params: Promise<{ linkId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { linkId } = await context.params;
  return handlePatchInternalLink(request, linkId);
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  const { linkId } = await context.params;
  return handleDeleteInternalLink(request, linkId);
}
