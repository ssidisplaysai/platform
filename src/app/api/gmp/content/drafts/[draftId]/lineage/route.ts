import { NextResponse } from "next/server";
import { handleGetDraftLineage } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleGetDraftLineage(request, draftId);
}
