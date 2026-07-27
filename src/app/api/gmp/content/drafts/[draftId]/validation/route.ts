import { NextResponse } from "next/server";
import { handleGetDraftValidation } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleGetDraftValidation(request, draftId);
}
