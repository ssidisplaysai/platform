import { NextResponse } from "next/server";
import { handleApproveDraft } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleApproveDraft(request, draftId);
}
