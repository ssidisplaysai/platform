import { NextResponse } from "next/server";
import { handleSubmitDraftReview } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleSubmitDraftReview(request, draftId);
}
