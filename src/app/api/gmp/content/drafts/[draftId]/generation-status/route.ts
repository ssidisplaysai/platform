import { NextResponse } from "next/server";
import { handleGetContentGenerationStatus } from "@/lib/gmp/content-api";

type RouteContext = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { draftId } = await context.params;
  return handleGetContentGenerationStatus(request, draftId);
}
