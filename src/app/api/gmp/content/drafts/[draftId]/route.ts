import { NextResponse } from "next/server";
import { handleGetContentDraft, handlePatchContentDraft } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleGetContentDraft(request, draftId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handlePatchContentDraft(request, draftId);
}
